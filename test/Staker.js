const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
  const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

  describe("Staker",() => {
    const deployStaker = async () => {
        // Contracts are deployed using the first signer/account by default
        const [owner, user1, user2, user3 ] = await ethers.getSigners();

        const initialOwner = owner.address;

        // Reward Token deploy
        const erc20 = await ethers.getContractFactory("testRewardToken");
        const rewardToken = await erc20.deploy(initialOwner);

        await rewardToken.waitForDeployment();

        // Nft Token deploy
        const erc721 = await ethers.getContractFactory("testNFTToken");
        const stakingToken = await erc721.deploy(initialOwner);

        await stakingToken.waitForDeployment();

        // Staker deploy
        const Staker = await ethers.getContractFactory("StakerUpgradeable");

        // Tokens to give as an reward per block (e.g: 10 tokens per block)
        const rewardPerBlock = (10 * 1e18).toString();
        // Delay period in seconds 
        const FIVE_HOURS = (5*60*60).toString();
        const rewardDelayPeriod = FIVE_HOURS;
        // unbondingPeriod period in blocks
        const unbondingPeriod = 5;
        
        const staker = await upgrades.deployProxy(Staker,[initialOwner, rewardToken.target, stakingToken.target, rewardPerBlock, rewardDelayPeriod, unbondingPeriod])

        return { staker, owner, user1, user2, user3, rewardToken, stakingToken,rewardDelayPeriod, unbondingPeriod, rewardPerBlock };
    }
    describe("Deployment", () => {
        it("Should set the correct owner", async () => {
            const {staker,owner} = await loadFixture(deployStaker);

            expect(await staker.owner()).to.equal(owner.address);
        });

        it("Should initialize with correct parameters", async () => {
            const {staker,rewardToken,stakingToken, rewardPerBlock,rewardDelayPeriod, unbondingPeriod} = await loadFixture(deployStaker);

            expect(await staker.rewardToken()).to.equal(rewardToken.target);
            expect(await staker.stakingToken()).to.equal(stakingToken.target);
            expect(await staker.rewardPerBlock()).to.equal(rewardPerBlock);
            expect(await staker.rewardDelayPeriod()).to.equal(rewardDelayPeriod);
            expect(await staker.unbondingPeriod()).to.equal(unbondingPeriod);
        });
        it("should allow owner to set reward per block", async function () {
            const {staker,owner} = await loadFixture(deployStaker);
            await staker.setRewardPerBlock(ethers.parseUnits("2", 18));
            expect(await staker.rewardPerBlock()).to.equal(ethers.parseUnits("2", 18));
        });
        it("should revert if non-owner tries to set reward per block", async function () {
            const {staker,user1} = await loadFixture(deployStaker);
            await expect(staker.connect(user1).setRewardPerBlock(ethers.parseUnits("2", 18)))
              .to.be.revertedWithCustomError(staker,"OwnableUnauthorizedAccount");
        });
        it("should allow owner to pause and unpause the contract", async function () {
            const {staker,owner} = await loadFixture(deployStaker);
            await staker.pause();
            expect(await staker.paused()).to.be.true;
        
            await staker.unpause();
            expect(await staker.paused()).to.be.false;
        });
        it("should not allow staking when paused", async function () {
            const {staker,user1} = await loadFixture(deployStaker);
            await staker.pause();
            await expect(staker.connect(user1).stake([1]))
              .to.be.revertedWithCustomError(staker,"EnforcedPause");
        });
    });
    describe("Staking", () => {
        it("Should allow staking of NFTs", async () => {
            const {staker, user1, stakingToken, owner} = await loadFixture(deployStaker);

            // Mint NFTs to user1
            await stakingToken.connect(owner).safeMint(user1.address, 1);
            await stakingToken.connect(owner).safeMint(user1.address, 2);

            // Approve staker contract to manage user's NFTs
            await stakingToken.connect(user1).setApprovalForAll(staker.target, true);

            await expect(staker.connect(user1).stake([1, 2]))
            .to.emit(staker,"TokensStaked")
      
            const stakerInfo = await staker.stakerInfo(user1.address);
            expect(stakerInfo.totalStaked).to.equal(2);
        });
        it("Should not allow staking of zero tokens", async () => {
            const {staker, user1} = await loadFixture(deployStaker);
            await expect(staker.connect(user1).stake([])).to.be.revertedWith("Staking 0 tokens");
        });
        it("Should not allow staking token with approval",async () => {
            const {staker, user1, owner, stakingToken} = await loadFixture(deployStaker);
            // minted by different account
            await stakingToken.connect(owner).safeMint(owner.address,1);

            await expect(staker.connect(user1).stake([1])).to.be.revertedWithCustomError(stakingToken,"ERC721InsufficientApproval")
        })
    });
    describe("Withdrawing", () => {
        it("Should allow withdrawing of staked NFTs after request and unbonding period", async () => {
            const {stakingToken,owner,user1,staker,unbondingPeriod} = await loadFixture(deployStaker);
            // Mint NFTs and stake them
            await stakingToken.connect(owner).safeMint(user1.address, 1);
            await stakingToken.connect(owner).safeMint(user1.address, 2);
            await stakingToken.connect(user1).setApprovalForAll(staker.target, true);
            await staker.connect(user1).stake([1, 2]);

            await staker.connect(user1).requestWithdraw([1, 2]);

            // Continue mining to reach unbonding period
            for(let i = 0; i <= unbondingPeriod; i++) {
                await ethers.provider.send("evm_mine", []); // Mine a block
            }
      
            await expect(staker.connect(user1).withdraw([1, 2]))
              .to.emit(staker, "TokensWithdrawn");
      
            const stakerInfo = await staker.stakerInfo(user1.address);
            expect(stakerInfo.totalStaked).to.equal(0);
        });
        it("Should not allow withdrawing without request", async () => {
            const {staker, user1} = await loadFixture(deployStaker);

            await expect(staker.connect(user1).withdraw([1, 2])).to.be.revertedWith("Withdrawing more than staked");
        });
        it("should revert if withdrawing 0 tokens", async function () {
            const {staker, user1} = await loadFixture(deployStaker);
            
            await expect(staker.connect(user1).withdraw([]))
              .to.be.revertedWith("Withdrawing 0 tokens");
        });
    });
    describe("Rewards", () => {
        it("Should calculate and distribute rewards correctly", async () => {
            const {staker,user1, stakingToken,owner, rewardToken,rewardPerBlock} = await loadFixture(deployStaker);
            // Mint NFTs and stake them
            await stakingToken.connect(owner).safeMint(user1.address, 1);
            await stakingToken.connect(owner).safeMint(user1.address, 2);
            await stakingToken.connect(user1).setApprovalForAll(staker.target, true);
            await staker.connect(user1).stake([1, 2]);

            // making sure the staking contract has enough funds
            const amount = (100*1e18).toString();
            await rewardToken.connect(owner).mint(staker.target,amount);

            const blockBeforeSkipping = await ethers.provider.getBlockNumber();
            for(let i = 0; i < 2; i++){
                await ethers.provider.send("evm_mine", []); // Mine blocks to accumulate rewards
            }
            const rewards = await staker.connect(user1).getStakeInfo(user1.address);
            expect(rewards[1]).to.be.above(0);

            await expect(staker.connect(user1).claimRewards())
                .to.emit(staker, "RewardsClaimed")
        });
        it("Should not allow claiming rewards before delay period", async () => {
            const {staker,user1, stakingToken,owner, rewardToken,rewardPerBlock} = await loadFixture(deployStaker);
            // Mint NFTs and stake them
            await stakingToken.connect(owner).safeMint(user1.address, 1);
            await stakingToken.connect(owner).safeMint(user1.address, 2);
            await stakingToken.connect(user1).setApprovalForAll(staker.target, true);
            await staker.connect(user1).stake([1, 2]);

            // making sure the staking contract has enough funds
            const amount = (100*1e18).toString();
            await rewardToken.connect(owner).mint(staker.target,amount);

            for(let i = 0; i < 2; i++){
                await ethers.provider.send("evm_mine", []); // Mine blocks to accumulate rewards
            }
            await staker.connect(user1).getStakeInfo(user1.address);


            await staker.connect(user1).claimRewards();

            await expect(staker.connect(user1).claimRewards()).to.be.revertedWith(
              "Claiming not allowed yet. Please wait for the delay period."
            );
        });
    })
  })
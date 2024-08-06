const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Staking Contract", function () {

    const rewardsPerBlock = 10; // Initial rewards per block
    const rewardsPerBlockDay60 = 20; // Rewards per block after day 60
    const rewardsPerBlockDay180 = 30; // Rewards per block after day 180
    const blocksPerDay = 24; // As per the case

    async function mineBlocks(numBlocks) {
        for (let i = 0; i < numBlocks; i++) {
          await network.provider.send("evm_mine");
        }
        console.log(`Mined ${numBlocks} blocks`);
    }

    const deployStakingFixture = async () => {
        const [owner, userA, userB] = await ethers.getSigners();

        const initialOwner = owner.address;
        const rewardPerBlock = (10 * 1e18).toString(); // Tokens to give as an reward per block (e.g: 10 tokens per block)
        const FIVE_HOURS = (5*60*60).toString();  
        const rewardDelayPeriod = 0; // Delay period in seconds 
        const unbondingPeriod = 0; // unbondingPeriod period in blocks

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
        const staker = await upgrades.deployProxy(Staker,[initialOwner, rewardToken.target, stakingToken.target, rewardPerBlock, rewardDelayPeriod, unbondingPeriod]);
        await staker.waitForDeployment();

        return { staker, owner, userA, userB, rewardToken, stakingToken,rewardDelayPeriod, unbondingPeriod, rewardPerBlock };
    }

    // it("should calculate rewards correctly for UserA and UserB", async function () {
    //     const {staker, owner, userA, userB, stakingToken } = await loadFixture(deployStakingFixture);
    //     // Mint NFTs to user1
    //     await stakingToken.safeMint(userA.address, 1);
    //     await stakingToken.safeMint(userB.address, 2);

    //     // Approve staker contract to manage user's NFTs
    //     await stakingToken.connect(userA).setApprovalForAll(staker.target, true);
    //     await stakingToken.connect(userB).setApprovalForAll(staker.target, true);

    //     // UserA stakes 1 NFT on day 1
    //     await staker.connect(userA).stake([1]);
    
    //     // Fast forward to day 30 (mining blocks)
    //     await mineBlocks(29 * blocksPerDay);
    //     // UserB stakes 1 NFT on day 30
    //     await staker.connect(userB).stake([2]);
    
    //     // Fast forward to day 60 and update rewards to 20 per block (mining blocks)
    //     for (let i = 0; i < 30 * blocksPerDay; i++) {
    //         await ethers.provider.send("evm_mine");
    //     }
    //     await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay60);
    
    //     // Fast forward to day 120 (mining blocks)
    //     await mineBlocks(60 * blocksPerDay);

    //     // Calculate expected rewards up to day 120
    //     const userA_rewards_day120 = (29 * blocksPerDay * rewardsPerBlock) + (60 * blocksPerDay * rewardsPerBlockDay60);
    //     const userB_rewards_day120 = (60 * blocksPerDay * rewardsPerBlockDay60);
    
    //     // Get actual rewards
    //     const userA_actualRewards_day120 = await staker.getStakeInfo(userA.address);
    //     const userB_actualRewards_day120 = await staker.getStakeInfo(userB.address);

    //     expect(userA_actualRewards_day120[1]).to.equal(userA_rewards_day120);
    //     expect(userB_actualRewards_day120[1]).to.equal(userB_rewards_day120);
    
    //     await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay180);

    //     // Calculate expected rewards up to day 360
    //     const userA_rewards_day360 = userA_rewards_day120 + (180 * blocksPerDay * rewardsPerBlockDay180);
    //     const userB_rewards_day360 = userB_rewards_day120 + (180 * blocksPerDay * rewardsPerBlockDay180);
    
    //     // Get actual rewards
    //     const userA_actualRewards_day360 = await staker.getStakeInfo(userA.address);
    //     const userB_actualRewards_day360 = await staker.getStakeInfo(userB.address);
    
    //     expect(userA_actualRewards_day360[1]).to.equal(userA_rewards_day360);
    //     expect(userB_actualRewards_day360[1]).to.equal(userB_rewards_day360);
    // })
    describe("Scenario 1: Basic Rewards Calculation", function () {
        it("should calculate reward correctly for both users", async function () {
            const {staker, owner, userA, userB, stakingToken } = await loadFixture(deployStakingFixture);
    
            // Mint NFTs to user1
            await stakingToken.safeMint(userA.address, 1);
            await stakingToken.safeMint(userB.address, 2);
    
            // Approve staker contract to manage user's NFTs
            await stakingToken.connect(userA).setApprovalForAll(staker.target, true);
            await stakingToken.connect(userB).setApprovalForAll(staker.target, true);
    
            // UserA stakes 1 NFT on day 1
            await staker.connect(userA).stake([1]);
    
            // Fast forward to day 30 (mining blocks)
            await mineBlocks(30 * blocksPerDay);
            // UserB stakes 1 NFT on day 30
            await staker.connect(userB).stake([2]);
    
            // Fast forward to day 60 and update rewards to 20 per block (mining blocks)
            await mineBlocks(30 * blocksPerDay);
           
            // Updated reward per block
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay60);
    
            // Fast forward to day 120 (mining blocks)
            await mineBlocks(60 * blocksPerDay);
    
            const userA_info = await staker.stakerInfo(userA.address);
            const userB_info = await staker.stakerInfo(userB.address);
    
            const userA_stakeAtBlock = userA_info[2]
            const userB_stakeAtBlock = userB_info[2]
    
            const currentBlock_day120 = await ethers.provider.getBlockNumber();
    
            // Calculate blocks elapsed
            const userA_blocksElapsed_day120 = Number(currentBlock_day120) - Number(userA_stakeAtBlock);
            const userB_blocksElapsed_day120 = Number(currentBlock_day120) - Number(userB_stakeAtBlock);
    
            // Buffer means the blocks difference in calculation and actual
            const buffer_userA_day120 = (userA_blocksElapsed_day120 - 120 * blocksPerDay);
            const buffer_userB_day120 = (userB_blocksElapsed_day120 - 90 * blocksPerDay);
    
            const userA_rewards_day120 = (120 * blocksPerDay + buffer_userA_day120) * rewardsPerBlockDay60;
            const userB_rewards_day120 = (90 * blocksPerDay + buffer_userB_day120) * rewardsPerBlockDay60;
        
            // Get actual rewards
            const userA_actualRewards_day120 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day120 = await staker.getStakeInfo(userB.address);
    
            expect(userB_actualRewards_day120[1]).to.equal(userB_rewards_day120);
            expect(userA_actualRewards_day120[1]).to.equal(userA_rewards_day120);
    
            // Fast forward to day 180 (mining blocks)
            await mineBlocks(60 * blocksPerDay);
    
            // Updated reward per block
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay180);
    
            // Fast forward to day 360 (mining blocks)
            await mineBlocks(180 * blocksPerDay);
    
            const currentBlock_day360 = await ethers.provider.getBlockNumber();
    
            // Calculate blocks elapsed
            const userA_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userA_stakeAtBlock);
            const userB_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userB_stakeAtBlock);
    
            // Buffer means the blocks difference in calculation and actual
            const buffer_userA_day360 = (userA_blocksElapsed_day360 - 360 * blocksPerDay);
            const buffer_userB_day360 = (userB_blocksElapsed_day360 - 330 * blocksPerDay);
    
            const userA_rewards_day360 = (360 * blocksPerDay + buffer_userA_day360) * rewardsPerBlockDay180;
            const userB_rewards_day360 = (330 * blocksPerDay + buffer_userB_day360) * rewardsPerBlockDay180;
        
            // Get actual rewards
            const userA_actualRewards_day360 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day360 = await staker.getStakeInfo(userB.address);
    
            expect(userB_actualRewards_day360[1]).to.equal(userB_rewards_day360);
            expect(userA_actualRewards_day360[1]).to.equal(userA_rewards_day360);
        });
    });
    describe("Scenario 2: Reward Claim and Continuation", function () {
        it("should calculate reward correctly scenario 2", async function () {
            const {staker, owner, userA, userB, stakingToken, rewardToken } = await loadFixture(deployStakingFixture);
    
            // Mint NFTs to user1
            await stakingToken.safeMint(userA.address, 1);
            await stakingToken.safeMint(userB.address, 2);
    
            // Approve staker contract to manage user's NFTs
            await stakingToken.connect(userA).setApprovalForAll(staker.target, true);
            await stakingToken.connect(userB).setApprovalForAll(staker.target, true);
    
            // making sure the staking contract has enough funds
            const amount = (100*1e18).toString();
            await rewardToken.connect(owner).mint(staker.target,amount);
    
            // UserA stakes 1 NFT on day 1
            await staker.connect(userA).stake([1]);
    
            // Fast forward to day 30 (mining blocks)
            await mineBlocks(30 * blocksPerDay);
            // UserB stakes 1 NFT on day 30
            await staker.connect(userB).stake([2]);
    
            // Fast forward to day 60 and update rewards to 20 per block (mining blocks)
            await mineBlocks(30 * blocksPerDay);
           
            // Updated reward per block
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay60);
    
            // Fast forward to day 120 (mining blocks)
            await mineBlocks(60 * blocksPerDay);
    
            const userA_info_day120 = await staker.stakerInfo(userA.address);
            const userB_info_day120 = await staker.stakerInfo(userB.address);
    
            const userA_stakeAtBlock_day120 = userA_info_day120[2]
            const userB_stakeAtBlock_day120 = userB_info_day120[2]
    
            const currentBlock_day120 = await ethers.provider.getBlockNumber();
    
            // Calculate blocks elapsed
            const userA_blocksElapsed_day120 = Number(currentBlock_day120) - Number(userA_stakeAtBlock_day120);
            const userB_blocksElapsed_day120 = Number(currentBlock_day120) - Number(userB_stakeAtBlock_day120);
    
            // Buffer means the blocks difference in calculation and actual
            const buffer_userA_day120 = (userA_blocksElapsed_day120 - 120 * blocksPerDay);
            const buffer_userB_day120 = (userB_blocksElapsed_day120 - 90 * blocksPerDay);
            // console.log(`Buffer userA at 120 day ${buffer_userA_day120}`);
            // console.log(`Buffer userB at 120 day ${buffer_userB_day120}`);
    
            const userA_rewards_day120 = (120 * blocksPerDay + buffer_userA_day120) * rewardsPerBlockDay60;
            const userB_rewards_day120 = (90 * blocksPerDay + buffer_userB_day120) * rewardsPerBlockDay60;
            // console.log(`Calculation userA ${userA_rewards_day120}`);
            // console.log(`Calculation userB ${userB_rewards_day120}`);
        
            // Get actual rewards
            const userA_actualRewards_day120 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day120 = await staker.getStakeInfo(userB.address);
    
            expect(userB_actualRewards_day120[1]).to.equal(userB_rewards_day120);
            expect(userA_actualRewards_day120[1]).to.equal(userA_rewards_day120);
    
            // Claiming 
            await staker.connect(userA).claimRewards();
            await staker.connect(userB).claimRewards();
    
            // Fast forward to day 180 (mining blocks)
            await mineBlocks(60 * blocksPerDay);
    
            // Updated reward per block
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay180);
    
            // Fast forward to day 360 (mining blocks)
            await mineBlocks(180 * blocksPerDay);
    
            const currentBlock_day360 = await ethers.provider.getBlockNumber();
    
            const userA_info_day360 = await staker.stakerInfo(userA.address);
            const userB_info_day360 = await staker.stakerInfo(userB.address);
    
            const userA_stakeAtBlock_day360 = userA_info_day360[2]
            const userB_stakeAtBlock_day360 = userB_info_day360[2]
    
            // Calculate blocks elapsed
            const userA_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userA_stakeAtBlock_day360);
            const userB_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userB_stakeAtBlock_day360);
    
            // Buffer means the blocks difference in calculation and actual
            const buffer_userA_day360 = (userA_blocksElapsed_day360 - 240 * blocksPerDay);
            const buffer_userB_day360 = (userB_blocksElapsed_day360 - 240 * blocksPerDay);
            // console.log(`Buffer userA at 360 day ${buffer_userA_day360}`);
            // console.log(`Buffer userB at 360 day ${buffer_userB_day360}`);
    
            const userA_rewards_day360 = (240 * blocksPerDay + buffer_userA_day360) * rewardsPerBlockDay180;
            const userB_rewards_day360 = (240 * blocksPerDay + buffer_userB_day360) * rewardsPerBlockDay180;
            console.log(`Calculation userA at 360 day ${userA_rewards_day360}`);
            console.log(`Calculation userB at 360 day ${userB_rewards_day360}`);
        
            // Get actual rewards
            const userA_actualRewards_day360 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day360 = await staker.getStakeInfo(userB.address);
    
            expect(userB_actualRewards_day360[1]).to.equal(userB_rewards_day360);
            expect(userA_actualRewards_day360[1]).to.equal(userA_rewards_day360);
        });
    })
});
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Staking Contract", function () {

    const rewardsPerBlock = ethers.parseEther("10"); // Initial rewards per block
    const rewardsPerBlockDay60 = ethers.parseEther("20"); // Rewards per block after day 60
    const rewardsPerBlockDay180 = ethers.parseEther("30"); // Rewards per block after day 180
    const blocksPerDay = 24; // As per the case

    async function mineBlocks(numBlocks) {
        for (let i = 0; i < numBlocks; i++) {
          await network.provider.send("evm_mine");
        }
        console.log(`Mined ${numBlocks} blocks`);
    }

    // Helper functions to improve readability
    async function calculateBlocksElapsed(stakeAtBlock) {
        const currentBlock = await ethers.provider.getBlockNumber();
        return Number(currentBlock) - Number(stakeAtBlock);
    }
    
    async function calculateRewardsDay120(userA_blocksElapsed, userB_blocksElapsed) {
        const buffer_userA_day120 = userA_blocksElapsed - 120 * blocksPerDay;
        const buffer_userB_day120 = userB_blocksElapsed - 90 * blocksPerDay;
    
        const userA_rewards_day120 = BigInt(60 * blocksPerDay) * (rewardsPerBlockDay60) + BigInt(60 * blocksPerDay + buffer_userA_day120) * (rewardsPerBlock);
        const userB_rewards_day120 = BigInt(60 * blocksPerDay) * (rewardsPerBlockDay60) + BigInt(30 * blocksPerDay + buffer_userB_day120) * (rewardsPerBlock);
    
        return [userA_rewards_day120, userB_rewards_day120];
    }
    
    async function calculateBlocksElapsedDay360(userA_stakeAtBlock, userB_stakeAtBlock) {
        const currentBlock_day360 = await ethers.provider.getBlockNumber();
    
        const userA_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userA_stakeAtBlock);
        const userB_blocksElapsed_day360 = Number(currentBlock_day360) - Number(userB_stakeAtBlock);
    
        return [userA_blocksElapsed_day360, userB_blocksElapsed_day360];
    }
    
    async function calculateRewardsDay360(userA_blocksElapsed, userB_blocksElapsed) {
        const buffer_userA_day360 = userA_blocksElapsed - 360 * blocksPerDay;
        const buffer_userB_day360 = userB_blocksElapsed - 330 * blocksPerDay;

        console.log(`Buffer userA Day360 ${buffer_userA_day360}`)
        console.log(`Buffer userB Day360 ${buffer_userB_day360}`)
    
        const userA_rewards_day360 = BigInt(180 * blocksPerDay) * rewardsPerBlockDay180 +
            BigInt((120 * blocksPerDay + 1)) * rewardsPerBlockDay60 +
            BigInt(60 * blocksPerDay + 2) * rewardsPerBlock;
    
        const userB_rewards_day360 = BigInt(180 * blocksPerDay) * rewardsPerBlockDay180 +
            BigInt(120 * blocksPerDay + 1) * rewardsPerBlockDay60 +
            BigInt(30 * blocksPerDay + 1) * rewardsPerBlock;
    
        return [userA_rewards_day360, userB_rewards_day360];
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

    describe("Scenario 1: Basic Rewards Calculation", function () {
        it("should calculate reward correctly for both users", async function () {
            const { staker, owner, userA, userB, stakingToken } = await loadFixture(deployStakingFixture);
        
            // Mint NFTs to users
            await stakingToken.safeMint(userA.address, 1);
            console.log(`User A (${userA.address}) minted token with ID 1`);
        
            await stakingToken.safeMint(userB.address, 2);
            console.log(`User B (${userB.address}) minted token with ID 2`);
        
            // Approve staker contract to manage user's NFTs
            await stakingToken.connect(userA).setApprovalForAll(staker.target, true);
            console.log(`User A (${userA.address}) approved token with ID 1 to Staker contract ${staker.target}`);
        
            await stakingToken.connect(userB).setApprovalForAll(staker.target, true);
            console.log(`User B (${userB.address}) approved token with ID 2 to Staker contract ${staker.target}`);
        
            // User A stakes 1 NFT on day 1
            await staker.connect(userA).stake([1]);
            console.log(`User A (${userA.address}) staked token with ID 1`);
        
            // Fast forward to day 30 (mining blocks) and then User B stakes 1 NFT
            await mineBlocks(30 * blocksPerDay);
            await staker.connect(userB).stake([2]);
            console.log(`User B (${userB.address}) staked token with ID 2`);
        
            // Fast forward to day 60 and update rewards per block
            await mineBlocks(30 * blocksPerDay);
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay60);
            console.log(`Owner (${owner.address}) updated reward per block to ${rewardsPerBlockDay60}`);
        
            // Fast forward to day 120 (mining blocks)
            await mineBlocks(60 * blocksPerDay);
        
            // Get staking info for both users
            const userA_info = await staker.stakerInfo(userA.address);
            const userB_info = await staker.stakerInfo(userB.address);
        
            console.log(`User A info: ${String(userA_info)}`);
            console.log(`User B info: ${String(userB_info)}`);
        
            // Calculate the blocks elapsed for both users
            const userA_blocksElapsed_day120 = await calculateBlocksElapsed(userA_info[2]);
            const userB_blocksElapsed_day120 = await calculateBlocksElapsed(userB_info[2]);
        
            console.log(`User A blocks elapsed: ${userA_blocksElapsed_day120}`);
            console.log(`User B blocks elapsed: ${userB_blocksElapsed_day120}`);
        
            // Calculate the rewards for both users
            const [userA_rewards_day120, userB_rewards_day120] = await calculateRewardsDay120(userA_blocksElapsed_day120, userB_blocksElapsed_day120);
        
            console.log(`Expected User A rewards: ${userA_rewards_day120}`);
            console.log(`Expected User B rewards: ${userB_rewards_day120}`);
        
            // Validate the calculated rewards against the actual rewards from the contract
            const userA_actualRewards_day120 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day120 = await staker.getStakeInfo(userB.address);
        
            expect(userA_actualRewards_day120[1]).to.equal(userA_rewards_day120);
            expect(Number(String(userB_actualRewards_day120[1]) / 1e18)).to.equal(Number(String(userB_rewards_day120) / 1e18));
        
            // Fast forward to day 180 and update reward per block
            await mineBlocks(60 * blocksPerDay);
            await staker.connect(owner).setRewardPerBlock(rewardsPerBlockDay180);
        
            // Fast forward to day 360 (mining blocks)
            await mineBlocks(180 * blocksPerDay);
        
            // Calculate blocks elapsed and rewards for day 360
            const [userA_blocksElapsed_day360, userB_blocksElapsed_day360] = await calculateBlocksElapsedDay360(userA_info[2], userB_info[2]);
        
            console.log(`User A blocks elapsed for day 360: ${userA_blocksElapsed_day360}`);
            console.log(`User B blocks elapsed for day 360: ${userB_blocksElapsed_day360}`);
        
            const [userA_rewards_day360, userB_rewards_day360] = await calculateRewardsDay360(userA_blocksElapsed_day360, userB_blocksElapsed_day360);
        
            console.log(`Expected User A rewards for day 360: ${userA_rewards_day360}`);
            console.log(`Expected User B rewards for day 360: ${userB_rewards_day360}`);
        
            // Validate the calculated rewards against the actual rewards from the contract
            const userA_actualRewards_day360 = await staker.getStakeInfo(userA.address);
            const userB_actualRewards_day360 = await staker.getStakeInfo(userB.address);
        
            expect(userA_actualRewards_day360[1]).to.equal(userA_rewards_day360);
            expect(userB_actualRewards_day360[1]).to.equal(userB_rewards_day360);
        });
        
    });
});
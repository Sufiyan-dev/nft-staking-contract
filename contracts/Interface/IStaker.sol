// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.20;

interface IStaker {
    /**
     * @dev Emitted when a set of token IDs are staked.
     * @param staker The address of the user who is staking the tokens.
     * @param tokenIds An array of token IDs that the user has staked.
     */
    event TokensStaked(address indexed staker, uint256[] indexed tokenIds);

    /**
     * @dev Emitted when a set of staked token IDs are withdrawn.
     * @param staker The address of the user who is unstaking the tokens.
     * @param tokenIds An array of token IDs that the user has unstaked.
     */
    event TokensWithdrawn(address indexed staker, uint256[] indexed tokenIds);

    event TokensRequestedWithdraw(address indexed staker, uint256[] indexed tokenIds);

    /**
     * @dev Emitted when a staker claims their staking rewards.
     * @param staker The address of the user claiming the rewards.
     * @param rewardAmount The amount of rewards claimed.
     */
    event RewardsClaimed(address indexed staker, uint256 rewardAmount);

    /**
     * @dev Emitted when the contract admin updates the time unit.
     * @param oldTimeUnit The previous value of the time unit.
     * @param newTimeUnit The new value of the time unit.
     */
    event UpdatedTimeUnit(uint256 oldTimeUnit, uint256 newTimeUnit);

    /**
     * @dev Emitted when the contract admin updates the rewards per unit time.
     * @param oldRewardsPerUnitTime The previous value of rewards per unit time.
     * @param newRewardsPerUnitTime The new value of rewards per unit time.
     */
    event UpdatedRewardsPerUnitTime(
        uint256 oldRewardsPerUnitTime,
        uint256 newRewardsPerUnitTime
    );

    // Enum to define the status of a staked token
    enum StakingStatus { Staked, RequestedWithdraw, Withdrawn }


    /**
     * @dev Staker Info. Which stores staker's details 
     * @param amountStaked 
     * @param conditionIdOflastUpdate 
     * @param timeOfLastUpdate block number when update the unclaimed reward.
     * @param unclaimedRewards 
     */
    struct Staker {
        uint64 totalStaked;
        uint64 totalRequestUnstake;
        uint128 lastRewardUpdateBlock; 
        uint256 unclaimedRewards;
        uint256 lastClaimTime;
        uint256 stakingConditionId;
    }

    /**
     * @dev Stakers token info, which store details for a specific token
     * @param staker 
     * @param hasRequestedWithdraw 
     * @param timeAtRequested 
     */
    struct StakerToken {
        address staker;
        uint128 blockAtRequested;
        StakingStatus status;
    }

    struct StakingCondition {
        uint256 rewardPerBlock;
        uint256 createdAt;
    }

    /**
     * @notice Allows a user to stake multiple ERC721 tokens.
     * @param tokenIds An array of token IDs to be staked.
     */
    function stake(uint256[] calldata tokenIds) external;

    /**
     * @notice Allows a user to request withdraw on previously staked tokens.
     * @param tokenIds An array of token IDs to be requested for withdrawn.
     */
    function requestWithdraw(uint256[] calldata tokenIds) external;

    /**
     * @notice Allows a user to withdraw previously staked tokens.
     * @param tokenIds An array of token IDs to be withdrawn.
     */
    function withdraw(uint256[] calldata tokenIds) external;

    /**
     * @notice Allows a user to claim their accumulated staking rewards.
     */
    function claimRewards() external;

    /**
     * @notice Retrieves the staking information for a specific user.
     * @param staker The address of the user whose staking information is queried.
     * @return _tokensStaked An array of token IDs that the user has staked.
     * @return _reward The total amount of rewards accumulated by the user.
     */
    function getStakeInfo(
        address staker
    ) external view returns (uint256[] memory _tokensStaked, uint256 _reward);
}

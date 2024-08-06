# StakerUpgradeable Contract

## Overview
The StakerUpgradeable contract is an upgradeable smart contract that facilitates the staking of ERC721 tokens and rewards users with ERC20 tokens based on the staking duration. The contract supports functionalities including staking, withdrawing, requesting withdrawal, and claiming rewards. It leverages several OpenZeppelin contracts for security and upgradeability.

## Inheritance
The contract inherits from the following OpenZeppelin contracts and interfaces:

- Initializable: For upgradeable contracts with initializable constructors.
- PausableUpgradeable: Provides an emergency stop mechanism.
- OwnableUpgradeable: Ownership control.
- UUPSUpgradeable: Upgradeability mechanism.
- ReentrancyGuardUpgradeable: Prevents reentrant calls.
- IERC721Receiver: Handles the receipt of ERC721 tokens.
- IStaker: Custom interface for staking functionality.

## State Variables
- rewardToken: Address of the ERC20 token used as rewards.
- stakingToken: Address of the ERC721 token that can be staked.
- rewardDelayPeriod: Minimum period between consecutive reward claims.
- unbondingPeriod: The period that staked tokens must be held before they can be withdrawn.
- rewardPerBlock: The reward amount distributed per block for each staked token.
- indexedTokens: List of all token IDs ever staked.
- isIndexed: Mapping from token ID to a boolean indicating whether the token is indexed.
- stakerTokenInfo: Mapping from token ID to StakerToken struct containing staking information.
- stakerInfo: Mapping from staker address to Staker struct containing staking details.

## Structs
- StakerToken: Contains information about individual staked tokens, including the staker's address and the token's status.
- Staker: Contains information about a staker, including total staked tokens, unclaimed rewards, last reward update block, total requested unstake, and last claim time.

## Modifiers
- onlyOwner: Ensures that certain functions can only be called by the contract owner.

## Events
- TokensStaked(address indexed staker, uint256[] tokenIds): Emitted when tokens are staked.
- TokensWithdrawn(address indexed staker, uint256[] tokenIds): Emitted when tokens are withdrawn.
- TokensRequestedWithdraw(address indexed staker, uint256[] tokenIds): Emitted when a withdrawal request is made.
- RewardsClaimed(address indexed staker, uint256 rewards): Emitted when rewards are claimed.

## Functions
### Initialization and Upgrade
- constructor(): Disables initializers to prevent uninitialized contract deployment.
- initialize(...): Initializes the contract with the initial owner, reward token, staking token, reward per block, reward delay period, and unbonding period.
- _authoriz eUpgrade(...): Authorizes upgrades to the contract, restricted to the owner.

### Administrative Functions
- pause(): Pauses the contract, restricting certain operations.
- unpause(): Unpauses the contract, allowing all operations.
- setRewardPerBlock(uint256): Sets the reward per block. Only callable by the owner.
- setRewardDelayPeriod(uint256): Sets the reward delay period. Only callable by the owner.
- setUnbondingPeriod(uint256): Sets the unbonding period. Only callable by the owner.

### Staking Functions
- stake(uint256[] calldata): Allows users to stake specified ERC721 tokens.
- withdraw(uint256[] calldata): Allows users to withdraw specified staked tokens after the unbonding period.
- claimRewards(): Allows users to claim their accumulated rewards.
- requestWithdraw(uint256[] calldata): Requests withdrawal of specified staked tokens.

### View Functions
- getStakeInfo(address): Retrieves the staking information for a specific user, including staked tokens and accumulated rewards.

### Internal Functions
- _stake(uint256[] calldata): Internal function to handle staking logic.
- _withdraw(uint256[] calldata): Internal function to handle withdrawal logic.
- _requestWithdraw(uint256[] calldata): Internal function to handle withdrawal request logic.
- _claimRewards(): Internal function to handle rewards claim logic.
- _availableRewards(address): Internal function to calculate the available rewards for a user.
- _updateUnclaimedRewardsForStaker(address): Updates unclaimed rewards for a staker.
- _calculateRewards(address): Calculates the rewards for a staker based on the staked tokens and blocks elapsed.
- _mintRewards(address, uint256): Mints the calculated rewards to the staker.

### ERC721 Receiver Function
- onERC721Received(address, address, uint256, bytes calldata): Handles the receipt of ERC721 tokens and confirms the transfer.

## Optimizations
- Gas Efficiency:
The contract uses Math.tryAdd and Math.tryMul to prevent overflows and optimize gas usage.
Indexed tokens are maintained to efficiently manage and retrieve staked token data.
- Batch Operations:
Functions like stake, withdraw, and requestWithdraw handle multiple token IDs in a single transaction, reducing the number of transactions required and saving gas.
- Reentrancy Guard:
The contract employs the ReentrancyGuardUpgradeable to prevent reentrancy attacks, ensuring state changes are properly handled before external calls.
- Upgradeable Contract:
The contract is upgradeable via the UUPS (Universal Upgradeable Proxy Standard) pattern, allowing for future enhancements without changing the contract address.

## Security Considerations
- Access Control:
Only the contract owner can perform administrative functions such as pausing the contract, setting reward rates, and authorizing upgrades.
- Pausable Contract:
The PausableUpgradeable feature allows the contract owner to pause and unpause the contract in case of an emergency.
- Reentrancy Protection:
The use of ReentrancyGuardUpgradeable ensures that functions like stake, withdraw, and claimRewards are protected against reentrancy attacks.
- Safe Transfers:
The contract uses IERC20 and IERC721 interfaces for safe token transfers, ensuring compliance with ERC standards and preventing errors during transfers.
- Strict State Management:
The contract includes checks for ensuring the correct status of tokens and users, preventing unauthorized actions such as withdrawing more tokens than staked or claiming rewards too frequently.
- Validation of Rewards:
The contract checks the contract balance before minting rewards to ensure there are enough tokens to distribute, preventing underflow and unauthorized reward claims.

## Staking Contract Tests

### Scenarios - Reward

1. **Scenario 1: Basic Rewards Calculation**
   - Tests the basic reward calculation over different time periods without any intermediate reward claims.
   - Steps:
     1. Deploy contracts.
     2. Mint and approve NFTs for users.
     3. UserA stakes on day 1.
     4. Advance time to day 30 and UserB stakes.
     5. Advance time to day 60, update rewards, and check rewards on day 120.
     6. Advance time to day 180, update rewards, and check rewards on day 360.

2. **Scenario 2: Reward Claim and Continuation**
   - Tests reward calculation and the effect of claiming rewards partway through the staking period.
   - Steps:
     1. Deploy contracts.
     2. Mint and approve NFTs for users.
     3. Ensure the staking contract has funds.
     4. UserA stakes on day 1.
     5. Advance time to day 30 and UserB stakes.
     6. Advance time to day 60, update rewards, and check rewards on day 120.
     7. Both users claim rewards.
     8. Advance time to day 180, update rewards, and check rewards on day 360.

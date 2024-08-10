// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.20;

import "./Interface/IStaker.sol";
import "./Interface/IERC721.sol";
import "./Interface/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract StakerUpgradeable is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC721Receiver,
    IStaker
{
    address public rewardToken;
    address public stakingToken;
    uint256 public rewardDelayPeriod;
    uint256 public unbondingPeriod;
    uint256 private currentStakinConditionId;

    // @dev List of token-ids ever staked
    uint256[] public indexedTokens;

    // @dev Mapping from token-id to whether it is indexed or not.
    mapping(uint256 => bool) public isIndexed;

    /**
     * @notice Mapping from token id to stake token info
     */
    mapping(uint256 => StakerToken) public stakerTokenInfo;

    /**
     * @notice Mapping from staker to staker info
     */
    mapping(address => Staker) public stakerInfo;

    /**
     * @notice Mapping from condition Id to staking condition.
     */
    mapping(uint256 => StakingCondition) public stakingConditions;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address _rewardToken,
        address _stakingToken,
        uint256 _rewardPerBlock,
        uint256 _rewardDelayPeriod,
        uint256 _unbondingPeriod
    ) public initializer {
        __Pausable_init();
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        rewardToken = _rewardToken;
        stakingToken = _stakingToken;
        rewardDelayPeriod = _rewardDelayPeriod;
        unbondingPeriod = _unbondingPeriod;

        uint256 nextStakingConditionId = ++currentStakinConditionId;

        stakingConditions[nextStakingConditionId] = StakingCondition({
            rewardPerBlock: _rewardPerBlock,
            createdAt: block.number
        });

    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {

        StakingCondition memory condition = stakingConditions[currentStakinConditionId];
        require(_rewardPerBlock != condition.rewardPerBlock, "reward unchanged.");

        uint256 nextStakingConditionId = ++currentStakinConditionId;

        _setStakingCondition(_rewardPerBlock,nextStakingConditionId);
    }

    function setRewardDelayPeriod(uint256 _rewardDelayPeriod) external onlyOwner {
        rewardDelayPeriod = _rewardDelayPeriod;
    }

    function setUnbondingPeriod(uint256 _unbondingPeriod) external onlyOwner {
        unbondingPeriod = _unbondingPeriod;
    }

    function stake(uint256[] calldata _tokenIds) external nonReentrant whenNotPaused {
        _stake(_tokenIds);
    }

    function withdraw(uint256[] calldata _tokenIds) external nonReentrant whenNotPaused {
        _withdraw(_tokenIds);
    }

    function claimRewards() external nonReentrant whenNotPaused {
        _claimRewards();
    }

    function requestWithdraw(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        _requestWithdraw(tokenIds);
    }

    /**
     * @notice Retrieves the staking information for a specific user.
     * @param staker The address of the user whose staking information is queried.
     * @return _tokensStaked An array of token IDs that the user has staked.
     * @return _reward The total amount of rewards accumulated by the user.
     */
    function getStakeInfo(
        address staker
    ) external view returns (uint256[] memory _tokensStaked, uint256 _reward) {
        uint256[] memory _indexedTokens = indexedTokens;
        bool[] memory _isStakerToken = new bool[](_indexedTokens.length);
        uint256 indexedTokenCount = _indexedTokens.length;
        uint256 stakerTokenCount = 0;

        for (uint256 i = 0; i < indexedTokenCount; i++) {
            _isStakerToken[i] = stakerTokenInfo[_indexedTokens[i]].staker == staker;
            if (_isStakerToken[i]) stakerTokenCount += 1;
        }

        _tokensStaked = new uint256[](stakerTokenCount);
        uint256 count = 0;
        for (uint256 i = 0; i < indexedTokenCount; i++) {
            if (_isStakerToken[i]) {
                _tokensStaked[count] = _indexedTokens[i];
                count += 1;
            }
        }

        _reward = _availableRewards(staker);
    }

    function _stake(uint256[] calldata _tokenIds) internal virtual {
        uint64 len = uint64(_tokenIds.length);
        require(len != 0, "Staking 0 tokens");

        address _stakingToken = stakingToken;
        address _caller = _msgSender();

        if (stakerInfo[_caller].totalStaked > 0) {
            _updateUnclaimedRewardsForStaker(_caller);
        } else {
            stakerInfo[_caller].lastRewardUpdateBlock = uint128(block.number);
            stakerInfo[_caller].stakingConditionId = currentStakinConditionId;
        }
        for (uint256 i = 0; i < len; ++i) {
            IERC721(_stakingToken).safeTransferFrom(
                _caller,
                address(this),
                _tokenIds[i]
            );

            stakerTokenInfo[_tokenIds[i]].staker = _caller;
            if (!isIndexed[_tokenIds[i]]) {
                isIndexed[_tokenIds[i]] = true;
                indexedTokens.push(_tokenIds[i]);
            }
        }
        stakerInfo[_caller].totalStaked += len;

        emit TokensStaked(_caller, _tokenIds);
    }

    function _withdraw(uint256[] calldata _tokenIds) internal virtual {
        address _caller = _msgSender();
        uint256 _amountStaked = stakerInfo[_caller].totalRequestUnstake;
        uint64 len = uint64(_tokenIds.length);
        require(len != 0, "Withdrawing 0 tokens");
        require(_amountStaked >= len, "Withdrawing more than staked");

        address _stakingToken = stakingToken;

        stakerInfo[_caller].totalRequestUnstake -= len;

        for (uint256 i = 0; i < len; ++i) {
            require(
                stakerTokenInfo[_tokenIds[i]].staker == _caller,
                "Not staker"
            );
            require(
                stakerTokenInfo[_tokenIds[i]].status ==
                    StakingStatus.RequestedWithdraw,
                "Invalid token status"
            );

            uint256 _blockAtRequested = stakerTokenInfo[_tokenIds[i]]
                .blockAtRequested;
            (bool noAddOverflow, uint256 releaseBlock) = Math.tryAdd(
                _blockAtRequested,
                unbondingPeriod
            );
            // Overflow check
            require(
                noAddOverflow,
                "Overflow occurred while calculating release block"
            );
            require(
                block.number >= releaseBlock,
                "Token is still in the unbonding period"
            );

            stakerTokenInfo[_tokenIds[i]].staker = address(0);
            stakerTokenInfo[_tokenIds[i]].status = StakingStatus.Withdrawn;
            IERC721(_stakingToken).safeTransferFrom(
                address(this),
                _caller,
                _tokenIds[i]
            );
        }

        emit TokensWithdrawn(_caller, _tokenIds);
    }

    function _requestWithdraw(uint256[] calldata _tokenIds) internal virtual {
        address _caller = _msgSender();
        uint256 _amountStaked = stakerInfo[_caller].totalStaked;
        uint64 len = uint64(_tokenIds.length);
        require(len != 0, "Requesting withdraw of 0 tokens");
        require(
            _amountStaked >= len,
            "Requesting withdraw of more than staked"
        );

        _updateUnclaimedRewardsForStaker(_caller);

        stakerInfo[_caller].totalStaked -= len;
        stakerInfo[_caller].totalRequestUnstake += len;

        for (uint256 i = 0; i < len; ++i) {
            require(
                stakerTokenInfo[_tokenIds[i]].staker == _caller,
                "Not staker"
            );
            require(
                stakerTokenInfo[_tokenIds[i]].status == StakingStatus.Staked,
                "Invalid token status"
            );

            stakerTokenInfo[_tokenIds[i]].status = StakingStatus
                .RequestedWithdraw;
            stakerTokenInfo[_tokenIds[i]].blockAtRequested = uint128(
                block.number
            );
        }

        emit TokensRequestedWithdraw(_caller, _tokenIds);
    }

    function _claimRewards() internal virtual {
        address _caller = _msgSender();
        uint256 currentTime = block.timestamp;
        require(
            currentTime >= stakerInfo[_caller].lastClaimTime + rewardDelayPeriod,
            "Claiming not allowed yet. Please wait for the delay period."
        );
        uint256 rewards = stakerInfo[_caller].unclaimedRewards +
            _calculateRewards(_caller);

        require(rewards != 0, "No rewards");

        stakerInfo[_caller].lastRewardUpdateBlock = uint128(block.number);
        stakerInfo[_caller].unclaimedRewards = 0;
        stakerInfo[_caller].lastClaimTime = block.timestamp;
        stakerInfo[_caller].stakingConditionId = currentStakinConditionId;
        

        _mintRewards(_caller, rewards);

        emit RewardsClaimed(_caller, rewards);
    }

    function _availableRewards(
        address _user
    ) internal view virtual returns (uint256 _rewards) {
        if (stakerInfo[_user].totalStaked == 0) {
            _rewards = stakerInfo[_user].unclaimedRewards;
        } else {
            _rewards =
                stakerInfo[_user].unclaimedRewards +
                _calculateRewards(_user);
        }
    }

    /// @dev Update unclaimed rewards for a users. Called for every state change for a user.
    function _updateUnclaimedRewardsForStaker(
        address _staker
    ) internal virtual {
        uint256 rewards = _calculateRewards(_staker);
        stakerInfo[_staker].unclaimedRewards += rewards;
        stakerInfo[_staker].lastRewardUpdateBlock = uint128(block.number);
        stakerInfo[_staker].stakingConditionId = currentStakinConditionId;
    }

    /**
     * @dev Calculate rewards for a staker.
     * 
     * @param _staker staker address to calculate reward for
     */
    function _calculateRewards(
        address _staker
    ) internal view virtual returns (uint256 _rewards) {
        Staker memory staker = stakerInfo[_staker];

        uint256 _stakerConditionId = staker.stakingConditionId;
        uint256 _currentConditionId = currentStakinConditionId;

        uint256 startTime = staker.lastRewardUpdateBlock;

        for(uint256 i = _stakerConditionId; i<= _currentConditionId; i++){
            StakingCondition memory condition = stakingConditions[i];

            uint256 endTime = i == _currentConditionId ? block.number : stakingConditions[i+1].createdAt;
            (bool noOverflowProduct, uint256 rewardsProduct) = Math.tryMul((endTime - startTime) * staker.totalStaked, condition.rewardPerBlock);
            require(noOverflowProduct, "Reward calculation overflow");
            (bool noOverflowSum, uint256 rewardsSum) = Math.tryAdd(_rewards, rewardsProduct);
            require(noOverflowSum, "Rewards sum overflow");
            _rewards = rewardsSum;
            startTime = endTime;
        }

    }

    /// @dev Set staking conditions.
    function _setStakingCondition(uint256 _rewardsPerBlock,uint256 nextCoditionId) internal virtual {
        require(_rewardsPerBlock != 0, "reward can't be 0");

        stakingConditions[nextCoditionId] = StakingCondition({
            rewardPerBlock: _rewardsPerBlock,
            createdAt: block.number
        });
    }

    /**
     *  @dev Transfer ERC20 rewards to the staker.
     *
     *  @param _staker    Address for which to calculated rewards.
     *  @param _rewards   Amount of tokens to be given out as reward.
     */
    function _mintRewards(address _staker, uint256 _rewards) internal virtual {
        uint256 contractBalance = IERC20(rewardToken).balanceOf(address(this));
        require(
            contractBalance >= _rewards,
            "Insufficient contract balance for rewards"
        );

        // Transfer rewards to the staker
        bool success = IERC20(rewardToken).transfer(_staker, _rewards);
        require(success, "Reward transfer failed");
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

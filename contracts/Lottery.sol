// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/KeeperCompatible.sol'; //imports BOTH compatibleInterface & keeperBase

error Lottery__SendMoreETH();
error Lottery__TransferFailed();
error Lottery__LotteryNotOpen();
error error_LotteryUpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 lotteryState
);

/**
 *   @title A sample lottery contract
 *   @author DEFIdaniel
 *   @notice This contract is for an untamperable, decentralized contract
 *   @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // Type declarations
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_interval;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    uint256 private s_lastTimeStamp;
    address private s_recentWinner;
    LotteryState private s_lotteryState;

    // Events
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    // Functions
    constructor(
        address vrfCoordinatorV2, //external contract address. need MOCKS to work
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    // Functions
    function enterLottery() public payable {
        //require(msg.value > i_entranceFee) //other option. not Gas efficient - revert is cheaper
        if (msg.value < i_entranceFee) {
            revert Lottery__SendMoreETH();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__LotteryNotOpen();
        }
        s_players.push(payable(msg.sender)); //need to typecast address as payable
        emit LotteryEnter(msg.sender);
    }

    /**
     *   @dev This function uses chainlink keeper node calls
     *   When it returns true, can execute the lottery function
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        // IF all these are met below, it's time to run the lottery
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, '0x0');
    }

    /**
     * @dev Once `checkUpkeep` is returning `true`, this function is called
     * and it kicks off a Chainlink VRF call to get a random winner.
     */
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep(''); //pass blank calldata
        if (!upkeepNeeded) {
            revert error_LotteryUpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 s_requestId = i_vrfCoordinator.requestRandomWords( //requestID stores a lot of the request's info for use
            i_gasLane, //aka keyHash in docs - gives max price you'll pay for gas
            i_subscriptionId, //subscription for contract funding the request
            REQUEST_CONFIRMATIONS, //block confirmations required
            i_callbackGasLimit, //gas limit you're willing to max out on
            NUM_WORDS //how many random numbers you want
        );
        emit RequestedLotteryWinner(s_requestId);
    }

    /**
     *   @dev Function the Chainlink VRF calls to send money to a random winner
     */
    function fulfillRandomWords(
        uint256, /*requestID*/
        uint256[] memory randomWords //not providing requestID
    ) internal override {
        // remainder will be between 0 and array.length, which will perfectly allow a random selection to fit the array
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];

        //reset
        s_recentWinner = recentWinner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

        //payout
        (bool success, ) = recentWinner.call{value: address(this).balance}(''); //sends all contract value to the recent winner
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    // Pure & View Functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 playerIndex) public view returns (address) {
        return s_players[playerIndex];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}

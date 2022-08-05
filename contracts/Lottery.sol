//enter the lottery
//pick random winner (verifiable)
//winner selected every X minutes (fully automated)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/KeeperCompatible.sol'; //imports BOTH compatibleInterface & keeperBase

error Lottery__SendMoreETH();
error Lottery__TransferFailed();
error Lottery__LotteryNotOpen();

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // Type declarations
    enum LotteryState {
        OPEN,
        CALCULATING
    } //is creating a uint256 0=open, 1=calculating

    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    //Lottery Variables
    address private s_recentWinner;
    LotteryState private s_lotteryState;

    // Events
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
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

    function checkUpKeep(
        bytes calldata /*checkData*/
    ) external override {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
    }

    //2 steps for contract fulfillment to make it more secure
    //Step1: requestRandomWords (number); Step2: use number to choose a winner

    function requestRandomWinner() external {
        s_lotteryState = LotteryState.CALCULATING;
        //list of params required by chainlink function
        uint256 s_requestId = i_vrfCoordinator.requestRandomWords( //requestID stores a lot of the request's info for use
            i_gasLane, //aka keyHash in docs - gives max price you'll pay for gas
            i_subscriptionId, //subscription for contract funding the request
            REQUEST_CONFIRMATIONS, //block confirmations required
            i_callbackGasLimit, //gas limit you're willing to max out on
            NUM_WORDS //how many random numbers you want
        );
        emit RequestedLotteryWinner(s_requestId);
    }

    // function from the chainlink contract we're calling
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
}

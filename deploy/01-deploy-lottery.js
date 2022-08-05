const { network, ethers } = require('hardhat')
const { developmentchains, networkConfig } = require('../helper-hardhat-config')

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther('30')
//need to fund the chainlink subscription, use LINK on real networks

module.exports = async function (getNamedAccounts, deployments) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (developmentchains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address

        //programatically create chainlink subscription for contract
        const createSubTx = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await createSubTx.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Mock = networkConfig[chainId]['vrfCoordinatorV2']
        subscriptionId = networkConfig[chainId]['subscriptionId']
    }
    const entranceFee = networkConfig[chainId]['entranceFee']
    const gasLane = networkConfig[chainId]['gasLane']
    const callbackGasLimit = networkConfig[chainId]['callbackGasLimit']
    const interval = networkConfig[chainId]['interval']
    const constructorArgs = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const lottery = await deploy('Lottery', {
        from: deployer,
        args: constructorArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
}

// constructor(
//     address vrfCoordinatorV2, //external contract address. need MOCKS to work
//     uint256 entranceFee,
//     bytes32 gasLane,
//     uint64 subscriptionId,
//     uint32 callbackGasLimit,
//     uint256 interval

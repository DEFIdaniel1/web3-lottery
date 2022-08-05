const { network } = require('hardhat')

const { getNamedAccounts } = require('hardhat')

module.exports = async function (getNAmedAccounts, deployments) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const lottery = await deploy('Lottery', {
        from: deployer,
        args: [],
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

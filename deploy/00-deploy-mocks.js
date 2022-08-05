const { developmentChains } = require('../helper-hardhat-config')

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    //only want to deploy on devChains
    if (developmentChains.includes(network.name)) {
        log('Local network detected. Deploying mocks...')
    }
}

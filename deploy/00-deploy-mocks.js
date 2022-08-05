const { developmentChains } = require('../helper-hardhat-config')
const { ethers } = require('hardhat')

const BASE_FEE = ethers.utils.parseEther('0.25') // premium = 0.25 LINK per request
const GAS_PRICE_LINK = 1e9 // 1000000000 //variable LINK/gas based on chain's gas fees since CL is paying for requests

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]

    //only want to deploy on devChains
    if (developmentChains.includes(network.name)) {
        log('Local network detected. Deploying mocks...')
        await deploy('VRFCoordinatorV2Mock', {
            from: deployer,
            log: true,
            args: args,
        })
        log('Mocks deployed!')
        log('----------------------------------')
    }
}
module.exports.tags = ['all', 'mocks']

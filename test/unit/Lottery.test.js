const { assert } = require('chai')
const { network, ethers, getNamedAccounts } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Lottery Unit Tests', async function () {
          let lottery, vrfCoordinatorV2Mock
          const chainId = network.config.chainId

          beforeEach(async function () {
              const { deployer } = await getNamedAccounts()
              await deployments.fixture('all')
              lottery = await ethers.getContract('Lottery', deployer)
              vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer)
          })
          describe('constructor', async function () {
              //ideally want 1 assert per "it"
              it('lottery state is OPEN', async function () {
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(lotteryState.toString(), '0')
              })
              it('interval sets correctly', async function () {
                  const interval = await lottery.getInterval()
                  const expectedInterval = networkConfig[chainId]['interval']
                  assert.equal(interval, expectedInterval)
              })
          })
      })

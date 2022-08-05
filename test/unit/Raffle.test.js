const { assert } = require('chai')
const { getNamedAccounts, deployments, ethers } = require('hardhat')
const { describe, it } = require('node:test')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Lottery Unit Tests', async function () {
          let lottery, vrfCoodinatorV2Mock
          const chainId = network.config.chainId

          beforeEach(async function () {
              const { deployer } = await getNamedAccounts()
              await deployments.fixture('all')
              lottery = await ethers.getContract('Lottery', deployer)
              vrfCoodinatorV2Mock = await ethers.getContract('VRFCoodinatorV2Mock', deployer)
          })
          describe('constructor', async function () {
              //ideally want 1 assert per "it"
              it('lottery state is OPEN', async function () {
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(raffleState.toString(), '0')
              })
              it('interval sets correctly', async function () {
                  const interval = await lottery.getInterval()
                  const expectedInterval = networkConfig[chainId]['interval']
                  assert.equal(interval, expectedInterval)
              })
          })
      })

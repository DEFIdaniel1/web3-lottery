const { assert, expect } = require('chai')
const { network, ethers, getNamedAccounts } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Lottery Unit Tests', async function () {
          let lottery, vrfCoordinatorV2Mock, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture('all')
              lottery = await ethers.getContract('Lottery', deployer)
              vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer)
              lotteryEntranceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
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
          describe('enterLottery', async function () {
              it.only('function executes when enough ETH is sent and is added to contract balance', async function () {
                  let testValue = ethers.utils.parseEther('0.1')
                  await lottery.enterLottery({ value: testValue })
                  const lotteryBalance = await lottery.getBalance()
                  expect(lotteryBalance.toString(), testValue)
              })
              it("reverts when minimum payment isn't met", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWithCustomError(
                      lottery,
                      'Lottery__SendMoreETH'
                  )
              })
              it('records players when they enter', async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  const playerFromContract = await lottery.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it('emits LotterEnter event on enter', async function () {
                  await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
                      lottery, //specify contract
                      'LotteryEnter' //specify event to emit
                  )
              })
              it('reverts when lottery is NOT open', async function () {
                  //must first meet conditions for checkUpkeep to return true
                  await lottery.enterLottery({ value: lotteryEntranceFee }) //need value and players
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]) //timePassed must be > interval
                  await network.provider.send('evm_mine', []) //mine 1 extra block

                  //pretend to be chainlink keeper since checkUpkeep should return true now
                  await lottery.checkUpkeep([]) //don't actually need to run this
                  await lottery.performUpkeep([]) //pass empty callData []
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWithCustomError(lottery, 'Lottery__LotteryNotOpen')
              })
          })
      })

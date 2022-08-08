const { assert, expect } = require('chai')
const { network, ethers, getNamedAccounts } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Lottery Unit Tests', function () {
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
          describe('constructor', function () {
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
          describe('enterLottery', function () {
              it('function executes when enough ETH is sent and is added to contract balance', async function () {
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
          describe('checkUpkeep', function () {
              it("returns false if people haven't sent ETH", async function () {
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, false) //should be false
              })
              it('returns false if lottery is NOT open', async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  await lottery.performUpkeep('0x') //0x is hh shorthand for a blank object
                  const lotteryState = await lottery.getLotteryState()
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(lotteryState.toString(), '1') //1 = calculating in the enum
                  assert.equal(upkeepNeeded, false) //should be false
              })
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() - 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(upkeepNeeded, false)
              })
              it('returns true if enough time has passed, has players, eth, and is open', async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe('performUpkeep', function () {
              it('can only run if checkUpkeep is true', async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  const tx = await lottery.performUpkeep([])
                  assert(tx) // assert
              })
              it('reverts when checkUpkee is false', async function () {
                  await expect(lottery.performUpkeep([])).to.be.revertedWithCustomError(
                      lottery,
                      'error_LotteryUpkeepNotNeeded'
                  )
              })
              it('updates lotteryState, emits event, and calls VRFCoordinator', async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  const performUpkeepTx = await lottery.performUpkeep([])
                  const txReceipt = await performUpkeepTx.wait(1)
                  const requestId = await txReceipt.events[1].args.requestId //2nd event b/c chainlink contract also emits event first
                  const lotteryState = await lottery.getLotteryState()
                  assert(requestId.toNumber() > 0)
                  assert.equal(lotteryState, 1) //1 is CALCULATING status
              })
          })
      })

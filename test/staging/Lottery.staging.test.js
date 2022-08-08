const { assert, expect } = require('chai')
const { network, ethers, getNamedAccounts } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

developmentChains.includes(network.name)
    ? //skip if on dev chain
      describe.skip
    : describe('Lottery staging Tests', function () {
          let lottery, deployer, lotteryEntranceFee

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract('Lottery', deployer)
              lotteryEntranceFee = await lottery.getEntranceFee()
              const accounts = await ethers.getSigners()
          })
          describe('fulfillRandomWords', function () {
              it('works with live chainlink keepers and chainlink VRF, we get a random winner', async function () {
                  const startingTimeStamp = await lottery.getLastTimeStamp()
                  //setup listener before we enter lottery, just in case blockchain moves too fast
                  await new Promise(async (resolve, reject) => {
                      lottery.once('WinnerPicked', async () => {
                          console.log('WinnerPicked event fired!')
                          try {
                              //add asserts here
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.getLastTimeStamp()

                              await expect(lottery.getPlayer(0).to.be.reverted) //b/c no players when reset
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(lotteryState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      await lottery.enterLottery({ value: lotteryEntranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance()
                      //rest of code WONT complete without listener finishing listening
                  })
              })
          })
      })

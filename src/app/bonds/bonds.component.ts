import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import { ModalBondDetailsComponent } from './modal-bond-details/modal-bond-details.component';
import { ModalBuyYieldTokenComponent } from './modal-buy-yield-token/modal-buy-yield-token.component';
import {
  FunderPool,
  Deposit,
  FundedDeposit,
  FundableDeposit,
  Funding,
  Fundingv3,
  DPool,
} from './interface';
import { Timer } from '../timer';

const mockFunder = {
  totalMPHEarned: 123,
  pools: [
    {
      address: '0xb5EE8910A93F8A450E97BE0436F36B9458106682',
      fundings: [
        {
          nftID: 1,
          recordedFundedDepositAmount: 100,
          recordedMoneyMarketIncomeIndex: 1,
          initialFundedDepositAmount: 200,
          fundedDeficitAmount: 10,
          totalInterestEarned: 7,
          mphRewardEarned: 10,
        },
      ],
    },
  ],
  totalInterestByPool: [
    {
      pool: {
        stablecoin: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
      totalDeficitFunded: 100,
      totalRecordedFundedDepositAmount: 100,
      totalInterestEarned: 20,
    },
  ],
};

@Component({
  selector: 'app-bonds',
  templateUrl: './bonds.component.html',
  styleUrls: ['./bonds.component.css'],
})
export class BondsComponent implements OnInit {
  allPoolList: DPool[];
  funderPools: FunderPool[];
  totalMPHEarned: BigNumber;
  totalDeficitFundedUSD: BigNumber;
  totalCurrentDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;

  selectedPool: DPool;
  floatingRatePrediction: BigNumber;
  numDepositsToFund: string;
  numFundableDeposits: number;
  fundableDeposits: FundableDeposit[];
  debtToFundToken: BigNumber;
  debtToFundUSD: BigNumber;
  amountToEarnOnToken: BigNumber;
  amountToEarnOnUSD: BigNumber;
  mphRewardAmount: BigNumber;
  estimatedProfitToken: BigNumber;
  estimatedROI: BigNumber;
  estimatedProfitUSD: BigNumber;
  loadingCalculator: boolean;
  mphPriceUSD: BigNumber;
  mphROI: BigNumber;
  averageMaturationTime: BigNumber;
  medianMaturationTime: BigNumber;
  depositListIsCollapsed: boolean;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
  }

  loadData(loadUser: boolean, loadGlobal: boolean): void {
    // ***********
    // V3 CODE
    // ***********

    let funderID;
    if (this.wallet.connected && !this.wallet.watching) {
      funderID = this.wallet.userAddress.toLowerCase();
    } else if (this.wallet.watching) {
      funderID = this.wallet.watchedAddress.toLowerCase();
    } else {
      funderID = '';
    }

    const queryString = gql`
      {
        ${
          loadUser
            ? `funder(id: "${funderID}") {
          address
          pools {
            address
            fundings(where: { active: true }, orderBy: nftID) {
              id
              nftID
              totalSupply
              principalPerToken
              fundedDeficitAmount
              totalInterestEarned
              totalRefundEarned
              totalMPHEarned
              recordedMoneyMarketIncomeIndex
              deposit {
                id
                amount
                maturationTimestamp
              }
            }
          }

        }`
            : ''
        }
        ${
          loadGlobal
            ? `dpools {
          id
          address
          surplus
          oneYearInterestRate
          oracleInterestRate
          poolFunderRewardMultiplier
        }`
            : ''
        }
      }
    `;

    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    // ***********
    // V2 CODE
    // ***********

    //const funderID = this.wallet.connected ? this.wallet.userAddress.toLowerCase() : '';
    // let funderID;
    // if (this.wallet.connected && !this.wallet.watching) {
    //   funderID = this.wallet.userAddress.toLowerCase();
    // } else if (this.wallet.watching) {
    //   funderID = this.wallet.watchedAddress.toLowerCase();
    // } else {
    //   funderID = '';
    // }
    // const queryString = gql`
    //   {
    //     ${
    //       loadUser
    //         ? `funder(id: "${funderID}") {
    //       totalMPHEarned
    //       pools {
    //         id
    //         address
    //         fundings(where: { funder: "${funderID}", active: true }, orderBy: nftID) {
    //           id
    //           pool {
    //             address
    //             oracleInterestRate
    //             moneyMarketIncomeIndex
    //             poolFunderRewardMultiplier
    //           }
    //           fromDepositID
    // 					toDepositID
    //           nftID
    //           recordedFundedDepositAmount
    //           recordedMoneyMarketIncomeIndex
    //           initialFundedDepositAmount
    //           fundedDeficitAmount
    //           totalInterestEarned
    //           mphRewardEarned
    //           refundAmount
    //           creationTimestamp
    //         }
    //       }
    //       totalInterestByPool {
    //         pool {
    //           id
    //           stablecoin
    //         }
    //         totalDeficitFunded
    //         totalRecordedFundedDepositAmount
    //         totalInterestEarned
    //       }
    //     }`
    //         : ''
    //     }
    //     ${
    //       loadGlobal
    //         ? `dpools {
    //       id
    //       address
    //       surplus
    //       unfundedDepositAmount
    //       oneYearInterestRate
    //       oracleInterestRate
    //       poolFunderRewardMultiplier
    //       latestDeposit: deposits(orderBy: nftID, orderDirection: desc, first: 1) {
    //         nftID
    //       }
    //     }`
    //         : ''
    //     }
    //   }
    // `;
    // request(
    //   this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
    //   queryString
    // ).then((data: QueryResult) => this.handleData(data));
    //
    // this.helpers.getMPHPriceUSD().then((price) => {
    //   this.mphPriceUSD = price;
    // });
  }

  async handleData(data: QueryResult) {
    // ***********
    // V3 CODE
    // ***********
    //console.log(data);
    const funder = data.funder;
    const dpools = data.dpools;
    let stablecoinPriceCache = {};

    if (funder) {
      //console.log(funder);
      const funderPools: FunderPool[] = [];
      Promise.all(
        funder.pools.map(async (pool) => {
          if (pool.fundings.length == 0) return;

          const lens = this.contract.getNamedContract('DInterestLens');
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const poolContract = this.contract.getContract(
            pool.address,
            'DInterest'
          );

          // get stablecoin price in USD
          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          let yieldToken;
          await poolContract.methods
            .fundingMultitoken()
            .call()
            .then((yieldTokenAddress) => {
              console.log(yieldTokenAddress);
              yieldToken = this.contract.getContract(
                yieldTokenAddress,
                'FundingMultitoken'
              );
            });

          const fundings: Array<FundedDeposit> = [];

          for (const funding in pool.fundings) {
            const yieldTokenBalance = new BigNumber(
              await yieldToken.methods
                .balanceOf(funder.address, pool.fundings[funding].nftID)
                .call()
            ).div(this.constants.PRECISION);

            if (yieldTokenBalance.gt(0)) {
              console.log(pool.fundings[funding]);
              const yieldTokenPercentage = yieldTokenBalance.div(
                pool.fundings[funding].totalSupply
              );
              //console.log(yieldTokenPercentage.toString());

              // calculate amount of deposit earning yield
              const earnYieldOn = yieldTokenBalance.div(
                pool.fundings[funding].principalPerToken
              );

              // calculate amount of yield earned
              let yieldEarned = new BigNumber(0);

              // some will have been accrued, which is equally split among yield token holders
              await lens.methods
                .accruedInterestOfFunding(
                  pool.address,
                  pool.fundings[funding].nftID
                )
                .call()
                .then((result) => {
                  const totalAccruedInterest = new BigNumber(result).div(
                    this.constants.PRECISION
                  );
                  const funderAccruedInterest =
                    totalAccruedInterest.times(yieldTokenPercentage);
                  yieldEarned = yieldEarned.plus(funderAccruedInterest);
                });

              // some will have been paid out already
              // @dev this value will potentially include the refund amount
              await yieldToken.methods
                .accumulativeDividendOf(
                  pool.fundings[funding].nftID,
                  stablecoin,
                  funder.address
                )
                .call()
                .then((result) => {
                  const funderDistributedInterest = new BigNumber(result).div(
                    this.constants.PRECISION
                  );
                  console.log(funderDistributedInterest.toString());
                  yieldEarned = yieldEarned.plus(funderDistributedInterest);
                });

              const fundingObj: FundedDeposit = {
                maturationTimestamp:
                  pool.fundings[funding].deposit.maturationTimestamp,
                countdownTimer: new Timer(
                  pool.fundings[funding].deposit.maturationTimestamp,
                  'down'
                ),
                yieldTokenBalance: yieldTokenBalance,
                yieldTokenBalanceUSD: new BigNumber(0),
                earnYieldOn: earnYieldOn,
                earnYieldOnUSD: earnYieldOn.times(stablecoinPrice),
                yieldEarned: yieldEarned,
                yieldEarnedUSD: yieldEarned.times(stablecoinPrice),
                refundedAmount: new BigNumber(
                  pool.fundings[funding].totalRefundEarned
                ),
                refundedAmountUSD: new BigNumber(0),
                mphRewardsEarned: new BigNumber(
                  pool.fundings[funding].totalMPHEarned
                ),
                mphRewardsEarnedUSD: new BigNumber(0),
              };
              fundingObj.countdownTimer.start();
              fundings.push(fundingObj);
            }
          }

          const funderPool: FunderPool = {
            poolInfo: poolInfo,
            fundings: fundings,
          };
          funderPools.push(funderPool);
        })
      ).then(() => {
        this.funderPools = funderPools;
        //console.log(this.funderPools);
      });
    }

    if (dpools) {
      const allPoolList = new Array<DPool>(0);
      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          if (!poolInfo) {
            return;
          }

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // get MPH reward amount
          // const mphRewardPerTokenPerSecond = new BigNumber(
          //   pool.poolFunderRewardMultiplier
          // );
          //
          // const poolContract = this.contract.getPool(poolInfo.name);
          // const latestFundedDeposit = +(await poolContract.methods
          //   .latestFundedDepositID()
          //   .call());
          // const latestDeposit = pool.latestDeposit.length
          //   ? +pool.latestDeposit[0].nftID
          //   : 0;
          const dpoolObj: DPool = {
            name: poolInfo.name,
            address: poolInfo.address,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            stablecoinDecimals: poolInfo.stablecoinDecimals,
            iconPath: poolInfo.iconPath,
            surplus: new BigNumber(pool.surplus),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(
              100
            ),
            // latestFundedDeposit: latestFundedDeposit,
            // latestDeposit: latestDeposit,
            // unfundedDepositAmount: new BigNumber(pool.unfundedDepositAmount),
            // mphRewardPerTokenPerSecond: mphRewardPerTokenPerSecond,
            oracleInterestRate: new BigNumber(pool.oracleInterestRate)
              .times(this.constants.YEAR_IN_SEC)
              .times(100),
            poolFunderRewardMultiplier: new BigNumber(
              pool.poolFunderRewardMultiplier
            ),
          };
          allPoolList.push(dpoolObj);
        })
      ).then(() => {
        this.allPoolList = allPoolList;
        console.log(this.allPoolList);
        this.selectPool(0);
      });
    }

    // ***********
    // V2 CODE
    // ***********

    // const funder = data.funder;
    // const dpools = data.dpools;
    // let stablecoinPriceCache = {};
    //
    // if (funder) {
    //   // update totalMPHEarned
    //   this.totalMPHEarned = new BigNumber(funder.totalMPHEarned);
    //
    //   // process funding list
    //   const funderPools: FunderPool[] = [];
    //   Promise.all(
    //     funder.pools.map(async (pool) => {
    //       if (pool.fundings.length == 0) return;
    //       const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
    //       const stablecoin = poolInfo.stablecoin.toLowerCase();
    //       let stablecoinPrice = stablecoinPriceCache[stablecoin];
    //       if (!stablecoinPrice) {
    //         stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
    //         stablecoinPriceCache[stablecoin] = stablecoinPrice;
    //       }
    //       const fundings: Array<Funding> = [];
    //       for (const funding of pool.fundings) {
    //         const fundingObj: Funding = {
    //           id: funding.id,
    //           fromDepositID: funding.fromDepositID,
    //           toDepositID: funding.toDepositID,
    //           pool: {
    //             address: funding.pool.address,
    //             oracleInterestRate: new BigNumber(
    //               funding.pool.oracleInterestRate
    //             )
    //               .times(this.constants.YEAR_IN_SEC)
    //               .times(100),
    //             moneyMarketIncomeIndex: new BigNumber(
    //               funding.pool.moneyMarketIncomeIndex
    //             ),
    //             poolFunderRewardMultiplier: new BigNumber(
    //               funding.pool.poolFunderRewardMultiplier
    //             ),
    //           },
    //           nftID: funding.nftID,
    //           deficitToken: new BigNumber(funding.fundedDeficitAmount),
    //           deficitUSD: new BigNumber(funding.fundedDeficitAmount).times(
    //             stablecoinPrice
    //           ),
    //           currentDepositToken: new BigNumber(
    //             funding.recordedFundedDepositAmount
    //           ),
    //           currentDepositUSD: new BigNumber(
    //             funding.recordedFundedDepositAmount
    //           ).times(stablecoinPrice),
    //           interestEarnedToken: new BigNumber(funding.totalInterestEarned),
    //           interestEarnedUSD: new BigNumber(
    //             funding.totalInterestEarned
    //           ).times(stablecoinPrice),
    //           mphRewardEarned: new BigNumber(funding.mphRewardEarned),
    //           refundAmountToken: new BigNumber(funding.refundAmount),
    //           refundAmountUSD: new BigNumber(funding.refundAmount).times(
    //             stablecoinPrice
    //           ),
    //           recordedMoneyMarketIncomeIndex: new BigNumber(
    //             funding.recordedMoneyMarketIncomeIndex
    //           ),
    //           creationTimestamp: +funding.creationTimestamp,
    //         };
    //         fundings.push(fundingObj);
    //       }
    //
    //       const funderPool: FunderPool = {
    //         poolInfo: poolInfo,
    //         fundings: fundings,
    //       };
    //       funderPools.push(funderPool);
    //     })
    //   ).then(() => {
    //     this.funderPools = funderPools;
    //   });
    //
    //   // compute overall statistics
    //   let totalDeficitFundedUSD = new BigNumber(0);
    //   let totalCurrentDepositUSD = new BigNumber(0);
    //   let totalInterestUSD = new BigNumber(0);
    //   Promise.all(
    //     funder.totalInterestByPool.map(async (totalInterestEntity) => {
    //       let stablecoinPrice =
    //         stablecoinPriceCache[totalInterestEntity.pool.stablecoin];
    //       if (!stablecoinPrice) {
    //         stablecoinPrice = await this.helpers.getTokenPriceUSD(
    //           totalInterestEntity.pool.stablecoin
    //         );
    //         stablecoinPriceCache[totalInterestEntity.pool.stablecoin] =
    //           stablecoinPrice;
    //       }
    //
    //       const poolDeficitFundedUSD = new BigNumber(
    //         totalInterestEntity.totalDeficitFunded
    //       ).times(stablecoinPrice);
    //       const poolCurrentDepositUSD = new BigNumber(
    //         totalInterestEntity.totalRecordedFundedDepositAmount
    //       ).times(stablecoinPrice);
    //       const poolInterestUSD = new BigNumber(
    //         totalInterestEntity.totalInterestEarned
    //       ).times(stablecoinPrice);
    //       totalDeficitFundedUSD =
    //         totalDeficitFundedUSD.plus(poolDeficitFundedUSD);
    //       totalCurrentDepositUSD = totalCurrentDepositUSD.plus(
    //         poolCurrentDepositUSD
    //       );
    //       totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
    //     })
    //   ).then(() => {
    //     this.totalDeficitFundedUSD = totalDeficitFundedUSD;
    //     this.totalCurrentDepositUSD = totalCurrentDepositUSD;
    //     this.totalInterestUSD = totalInterestUSD;
    //   });
    // }
    //
    // if (dpools) {
    //   const allPoolList = new Array<DPool>(0);
    //   Promise.all(
    //     dpools.map(async (pool) => {
    //       const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
    //
    //       if (!poolInfo) {
    //         return;
    //       }
    //
    //       const stablecoin = poolInfo.stablecoin.toLowerCase();
    //       let stablecoinPrice = stablecoinPriceCache[stablecoin];
    //       if (!stablecoinPrice) {
    //         stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
    //         stablecoinPriceCache[stablecoin] = stablecoinPrice;
    //       }
    //
    //       // get MPH reward amount
    //       const mphRewardPerTokenPerSecond = new BigNumber(
    //         pool.poolFunderRewardMultiplier
    //       );
    //
    //       const poolContract = this.contract.getPool(poolInfo.name);
    //       const latestFundedDeposit = +(await poolContract.methods
    //         .latestFundedDepositID()
    //         .call());
    //       const latestDeposit = pool.latestDeposit.length
    //         ? +pool.latestDeposit[0].nftID
    //         : 0;
    //       const dpoolObj: DPool = {
    //         name: poolInfo.name,
    //         address: poolInfo.address,
    //         protocol: poolInfo.protocol,
    //         stablecoin: poolInfo.stablecoin,
    //         stablecoinSymbol: poolInfo.stablecoinSymbol,
    //         stablecoinDecimals: poolInfo.stablecoinDecimals,
    //         iconPath: poolInfo.iconPath,
    //         surplus: new BigNumber(pool.surplus),
    //         oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(
    //           100
    //         ),
    //         latestFundedDeposit: latestFundedDeposit,
    //         latestDeposit: latestDeposit,
    //         unfundedDepositAmount: new BigNumber(pool.unfundedDepositAmount),
    //         mphRewardPerTokenPerSecond: mphRewardPerTokenPerSecond,
    //         oracleInterestRate: new BigNumber(pool.oracleInterestRate)
    //           .times(this.constants.YEAR_IN_SEC)
    //           .times(100),
    //       };
    //       allPoolList.push(dpoolObj);
    //     })
    //   ).then(() => {
    //     this.allPoolList = allPoolList;
    //     this.selectPool(0);
    //   });
    // }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.totalDeficitFundedUSD = new BigNumber(0);
      this.totalCurrentDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalMPHEarned = new BigNumber(0);
      this.funderPools = [];
    }

    if (resetGlobal) {
      this.floatingRatePrediction = new BigNumber(0);
      this.allPoolList = [];
      this.numDepositsToFund = 'All';
      this.numFundableDeposits = 0;
      this.fundableDeposits = [];
      this.debtToFundToken = new BigNumber(0);
      this.debtToFundUSD = new BigNumber(0);
      this.amountToEarnOnToken = new BigNumber(0);
      this.amountToEarnOnUSD = new BigNumber(0);
      this.mphRewardAmount = new BigNumber(0);
      this.estimatedProfitToken = new BigNumber(0);
      this.estimatedProfitUSD = new BigNumber(0);
      this.estimatedROI = new BigNumber(0);
      this.loadingCalculator = true;
      this.mphPriceUSD = new BigNumber(0);
      this.mphROI = new BigNumber(0);
      this.averageMaturationTime = new BigNumber(0);
      this.medianMaturationTime = new BigNumber(0);
      this.depositListIsCollapsed = true;
    }
  }

  openBondDetailsModal(selectedFunderPool, selectedFunding) {
    // const modalRef = this.modalService.open(ModalBondDetailsComponent, {
    //   windowClass: 'fullscreen',
    // });
    // modalRef.componentInstance.funderPool = selectedFunderPool;
    // modalRef.componentInstance.funding = selectedFunding;
    // modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;
  }

  async selectPool(poolIdx: number) {
    this.selectedPool = this.allPoolList[poolIdx];
    //const selectedPoolContract = this.contract
    //console.log(this.selectedPool);

    // this.numFundableDeposits = Math.min(
    //   this.selectedPool.latestDeposit - this.selectedPool.latestFundedDeposit,
    //   20
    // );
    //
    const poolID = this.selectedPool.address.toLowerCase();
    const now = Math.floor(Date.now() / 1e3);

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.selectedPool.stablecoin
    );

    const queryString = gql`
      {
        dpool(id: "${poolID}") {
          id
          poolFunderRewardMultiplier
          deposits(
            where: {
              amount_gt: "${this.constants.DUST_THRESHOLD}",
              maturationTimestamp_gt: "${now}"
            }
          ) {
            id
            nftID
            amount
            virtualTokenTotalSupply
            interestRate
            feeRate
            maturationTimestamp
            funding {
              id
              active
              fundedDeficitAmount
              totalSupply
              principalPerToken
            }
          }
        }
      }
    `;
    // const queryString = gql`
    //   {
    //     dpool(id: "${poolID}") {
    //       id
    //       moneyMarketIncomeIndex
    //       deposits(where: { nftID_gt: ${this.selectedPool.latestFundedDeposit} }, orderBy: nftID) {
    //         nftID
    //         amount
    //         active
    //         maturationTimestamp
    //         interestEarned
    //         initialMoneyMarketIncomeIndex
    //       }
    //     }
    //   }
    // `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then(async (data: FundableDepositsQuery) => {
      const fundableDeposits = [];
      const pool = this.contract.getPool(this.selectedPool.name);
      const lens = this.contract.getNamedContract('DInterestLens');
      //console.log(lens);

      // get MPH APY
      const mphFunderRewardMultiplier = new BigNumber(
        data.dpool.poolFunderRewardMultiplier
      );
      //console.log(mphFunderRewardMultiplier.toString());
      // const mphAPY = mphFunderRewardMintMultiplier
      //   .times(this.mphPriceUSD)
      //   .times(this.constants.YEAR_IN_SEC)
      //   .div(stablecoinPrice)
      //   .times(100);
      // console.log(mphAPY.toString());

      for (const deposit of data.dpool.deposits) {
        //const poolContract = this.contract.getPool(this.selectedPool.name);
        // NEW STUFF

        const virtualTokenTotalSupply = new BigNumber(
          deposit.virtualTokenTotalSupply
        );
        const interestRate = new BigNumber(deposit.interestRate);
        const feeRate = new BigNumber(deposit.feeRate);

        const totalPrincipal = virtualTokenTotalSupply
          .div(interestRate.plus(1))
          .times(interestRate.plus(feeRate).plus(1));
        //console.log(totalPrincipal.toString());

        // END NEW STUFF

        const depositAmount = new BigNumber(deposit.amount);

        // const principalAmount = depositAmount.times(
        //   new BigNumber(deposit.interestRate)
        //     .plus(new BigNumber(deposit.feeRate))
        //     .plus(1)
        // );

        let surplus;
        await lens.methods
          .surplusOfDeposit(this.selectedPool.address, deposit.nftID)
          .call()
          .then((result) => {
            if (result.isNegative === true) {
              surplus = new BigNumber(result.surplusAmount)
                .div(this.constants.PRECISION)
                .negated();
            } else {
              surplus = new BigNumber(result.surplusAmount).div(
                this.constants.PRECISION
              );
            }
          });

        // deposit hasn't been funded yet
        // @dev yield tokens available will equal the total principal of the deposit
        if (deposit.funding === null) {
          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: deposit.maturationTimestamp,
            countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
            unfundedDepositAmount: depositAmount,
            unfundedDepositAmountUSD: depositAmount.times(stablecoinPrice),
            yieldTokensAvailable: totalPrincipal,
            yieldTokensAvailableUSD: totalPrincipal
              .minus(depositAmount)
              .times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          parsedDeposit.countdownTimer.start();
          fundableDeposits.push(parsedDeposit);
        }

        // deposit has been partially funded and has a negative surplus
        else if (surplus.lt(0)) {
          const supply = deposit.funding.totalSupply;
          const principalPerToken = deposit.funding.principalPerToken;
          const unfundedPrincipalAmount = totalPrincipal.minus(
            supply * principalPerToken
          );
          const unfundedDepositAmount = unfundedPrincipalAmount.plus(surplus);
          const yieldTokensAvailable =
            unfundedPrincipalAmount.div(principalPerToken);

          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: deposit.maturationTimestamp,
            countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
            unfundedDepositAmount: unfundedDepositAmount,
            unfundedDepositAmountUSD:
              unfundedDepositAmount.times(stablecoinPrice),
            yieldTokensAvailable: yieldTokensAvailable,
            yieldTokensAvailableUSD: yieldTokensAvailable
              .minus(unfundedDepositAmount)
              .times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          parsedDeposit.countdownTimer.start();
          fundableDeposits.push(parsedDeposit);
        }

        // sort deposits by maturation timestamp
        fundableDeposits.sort((a, b) => {
          return a.maturationTimestamp - b.maturationTimestamp;
        });
      }
      this.fundableDeposits = fundableDeposits;
      //console.log(this.fundableDeposits);

      // const moneyMarketIncomeIndex = new BigNumber(
      //   data.dpool.moneyMarketIncomeIndex
      // );
      // for (const deposit of data.dpool.deposits) {
      //   const surplus = moneyMarketIncomeIndex
      //     .div(deposit.initialMoneyMarketIncomeIndex)
      //     .minus(1)
      //     .times(deposit.amount)
      //     .minus(deposit.interestEarned);
      //   const parsedDeposit: Deposit = {
      //     nftID: deposit.nftID,
      //     amount: new BigNumber(deposit.amount),
      //     active: deposit.active,
      //     maturationTimestamp: deposit.maturationTimestamp,
      //     interestEarned: new BigNumber(deposit.interestEarned),
      //     surplus: surplus,
      //   };
      //   fundableDeposits.push(parsedDeposit);
      // }
      // this.fundableDeposits = fundableDeposits;
      //
      // this.updateNumDepositsToFund(this.numFundableDeposits + 1);
      this.floatingRatePrediction = this.selectedPool.oracleInterestRate;
      this.updateEstimatedROI();
    });
  }

  selectedPoolHasDebt(): boolean {
    if (!this.selectedPool) {
      return false;
    }
    return this.selectedPool.surplus.lt(0);
  }

  updateFloatingRatePrediction(newPrediction: number) {
    this.floatingRatePrediction = new BigNumber(newPrediction);
    this.updateEstimatedROI();
  }

  async updateNumDepositsToFund(newNum: number) {
    // const readonlyWeb3 = this.wallet.readonlyWeb3();
    // const poolContract = this.contract.getPool(
    //   this.selectedPool.name,
    //   readonlyWeb3
    // );
    // if (newNum >= this.numFundableDeposits) {
    //   // fund all deposits
    //   this.numDepositsToFund = 'All';
    //   this.debtToFundToken = this.selectedPool.surplus.times(-1);
    //   this.amountToEarnOnToken = this.selectedPool.unfundedDepositAmount;
    // } else {
    //   this.numDepositsToFund = newNum.toString();
    //   let debtToFundToken = new BigNumber(0);
    //   let amountToEarnOnToken = new BigNumber(0);
    //   for (const deposit of this.fundableDeposits.slice(0, newNum)) {
    //     if (deposit.active) {
    //       debtToFundToken = debtToFundToken.plus(deposit.surplus.times(-1));
    //       amountToEarnOnToken = amountToEarnOnToken.plus(deposit.amount);
    //     } else {
    //       const depositObj = await poolContract.methods
    //         .getDeposit(deposit.nftID)
    //         .call();
    //       const finalSurplus = new BigNumber(depositObj.finalSurplusAmount)
    //         .times(depositObj.finalSurplusIsNegative ? -1 : 1)
    //         .div(Math.pow(10, this.selectedPool.stablecoinDecimals));
    //       debtToFundToken = debtToFundToken.plus(finalSurplus.times(-1));
    //     }
    //   }
    //   this.debtToFundToken = debtToFundToken;
    //   this.amountToEarnOnToken = amountToEarnOnToken;
    // }
    // const stablecoinPrice = await this.helpers.getTokenPriceUSD(
    //   this.selectedPool.stablecoin
    // );
    // this.debtToFundUSD = this.debtToFundToken.times(stablecoinPrice);
    // this.amountToEarnOnUSD = this.amountToEarnOnToken.times(stablecoinPrice);
    //
    // // compute weighted average maturation time and MPH reward amount
    // const deposits =
    //   newNum >= this.numFundableDeposits
    //     ? this.fundableDeposits
    //     : this.fundableDeposits.slice(0, newNum);
    // let totalMaturationTime = new BigNumber(0);
    // let numDepositsWithDebt = 0;
    // let mphRewardAmount = new BigNumber(0);
    // const now = Math.floor(Date.now() / 1e3);
    // for (const deposit of deposits) {
    //   const timeTillMaturation = deposit.maturationTimestamp - now;
    //   if (!deposit.active || timeTillMaturation < 0) continue;
    //   totalMaturationTime = totalMaturationTime.plus(timeTillMaturation);
    //   mphRewardAmount = mphRewardAmount.plus(
    //     this.selectedPool.mphRewardPerTokenPerSecond
    //       .times(deposit.amount)
    //       .times(timeTillMaturation)
    //   );
    //   numDepositsWithDebt += 1;
    // }
    // this.averageMaturationTime =
    //   numDepositsWithDebt == 0
    //     ? new BigNumber(0)
    //     : totalMaturationTime
    //         .div(numDepositsWithDebt)
    //         .div(this.constants.DAY_IN_SEC);
    // this.mphRewardAmount = mphRewardAmount;
    // this.mphROI = this.mphRewardAmount
    //   .times(this.mphPriceUSD)
    //   .div(this.debtToFundUSD)
    //   .times(100);
    // if (this.mphROI.isNaN()) {
    //   this.mphROI = new BigNumber(0);
    // }
    //
    // // compute median maturation time
    // const median = (values) => {
    //   if (values.length === 0) return 0;
    //
    //   values.sort(function (a, b) {
    //     return a - b;
    //   });
    //
    //   var half = Math.floor(values.length / 2);
    //
    //   if (values.length % 2) return values[half];
    //
    //   return (values[half - 1] + values[half]) / 2.0;
    // };
    // this.medianMaturationTime = new BigNumber(
    //   median(
    //     deposits
    //       .filter((x) => x.active && x.maturationTimestamp - now > 0)
    //       .map((x) => x.maturationTimestamp - now)
    //   )
    // ).div(this.constants.DAY_IN_SEC);
    //
    // this.updateEstimatedROI();
  }

  async updateEstimatedROI() {
    const estimatedFloatingRate = this.floatingRatePrediction.div(100);
    const mphFunderRewardMultiplier = new BigNumber(
      this.selectedPool.poolFunderRewardMultiplier
    );
    const now = Date.now() / 1e3;

    for (const deposit of this.fundableDeposits) {
      // calculate APR
      const debtToFund = deposit.yieldTokensAvailableUSD;
      const estimatedInterest = deposit.unfundedDepositAmountUSD
        .times(estimatedFloatingRate)
        .times(deposit.maturationTimestamp - now)
        .div(this.constants.YEAR_IN_SEC);
      const estimatedProfit = estimatedInterest.minus(debtToFund);
      const estimatedAPR = estimatedProfit.div(debtToFund).times(100);
      deposit.estimatedAPR = estimatedAPR;

      // calculate MPH APR
      const estimatedInterestToken = deposit.unfundedDepositAmount
        .times(Math.pow(10, this.selectedPool.stablecoinDecimals))
        .times(estimatedFloatingRate)
        .times(deposit.maturationTimestamp - now)
        .div(this.constants.YEAR_IN_SEC);
      const mphReward = estimatedInterestToken
        .times(mphFunderRewardMultiplier)
        .div(this.constants.PRECISION);
      const mphRewardUSD = mphReward.times(this.mphPriceUSD);
      const mphRewardAPR = mphRewardUSD.div(debtToFund).times(100);
      deposit.mphRewardsAPR = mphRewardAPR;
    }
    this.loadingCalculator = false;
  }

  getDepositsToFundByMaturationTime() {
    // const now = Math.floor(Date.now() / 1e3);
    // const newNum =
    //   this.numDepositsToFund === 'All'
    //     ? this.numFundableDeposits
    //     : +this.numDepositsToFund;
    // const deposits =
    //   newNum >= this.numFundableDeposits
    //     ? this.fundableDeposits
    //     : this.fundableDeposits.slice(0, newNum);
    // return deposits
    //   .filter((x) => x.active && x.maturationTimestamp - now > 0)
    //   .sort((a, b) => {
    //     return a.maturationTimestamp - b.maturationTimestamp;
    //   });
  }

  timestampToDateString(timestampSec: number): string {
    // return new Date(timestampSec * 1e3).toLocaleDateString();
    return 'hello';
  }

  buyYieldTokens(deposit: FundableDeposit) {
    const modalRef = this.modalService.open(ModalBuyYieldTokenComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.deposit = deposit;
  }

  buyBond() {
    // const modalRef = this.modalService.open(ModalBuyYieldTokenComponent, {
    //   windowClass: 'fullscreen',
    // });
    // const pool = this.contract.getPool(this.selectedPool.name);
    // const stablecoin = this.contract.getPoolStablecoin(this.selectedPool.name);
    // const stablecoinPrecision = Math.pow(
    //   10,
    //   this.selectedPool.stablecoinDecimals
    // );
    // const debtToFund = this.helpers.processWeb3Number(
    //   this.debtToFundToken.times(stablecoinPrecision)
    // );
    // let func;
    // if (this.numDepositsToFund === 'All') {
    //   // Fund all deposits
    //   func = pool.methods.fundAll();
    // } else {
    //   // Fund a selection of deposits
    //   func = pool.methods.fundMultiple(
    //     this.selectedPool.latestFundedDeposit + +this.numDepositsToFund
    //   );
    // }
    // this.wallet.sendTxWithToken(
    //   func,
    //   stablecoin,
    //   this.selectedPool.address,
    //   debtToFund,
    //   () => {},
    //   () => {},
    //   (error) => {
    //     this.wallet.displayGenericError(error);
    //   }
    // );
  }

  canContinue() {
    // return (
    //   this.wallet.connected &&
    //   this.selectedPoolHasDebt() &&
    //   this.debtToFundToken.gt(0)
    // );
  }
}

interface QueryResult {
  funder: {
    address: string;
    pools: {
      address: string;
      fundings: {
        id: number;
        nftID: number;
        totalSupply: number;
        principalPerToken: number;
        fundedDeficitAmount: number;
        totalInterestEarned: number;
        totalRefundEarned: number;
        totalMPHEarned: number;
        recordedMoneyMarketIncomeIndex: number;
        deposit: {
          id;
          amount: number;
          maturationTimestamp: number;
        };
      }[];
    }[];
  };
  dpools: {
    id: string;
    address: string;
    surplus: number;
    oneYearInterestRate: number;
    oracleInterestRate: number;
    poolFunderRewardMultiplier: BigNumber;
  }[];
}

interface FundableDepositsQuery {
  dpool: {
    id: string;
    poolFunderRewardMultiplier: BigNumber;
    deposits: {
      id: string;
      nftID: string;
      amount: BigNumber;
      virtualTokenTotalSupply: BigNumber;
      interestRate: BigNumber;
      feeRate: BigNumber;
      maturationTimestamp: number;
      funding: Fundingv3;
    }[];
  };
}

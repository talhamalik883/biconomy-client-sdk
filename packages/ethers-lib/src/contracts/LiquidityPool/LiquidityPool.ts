import {
  LiquidityPoolContract,
  LiquidityPoolDepositAndCallArgs,
  ITransactionResult
} from '@biconomy-sdk/core-types'
import { BiconomyLiquidityPool } from '../../../typechain/src/ethers-v5/CrossChain'
import { toTxResult } from '../../utils'

export class LiquidityPool implements LiquidityPoolContract {
  constructor(public contract: BiconomyLiquidityPool) {}

  async depositAndCall(args: LiquidityPoolDepositAndCallArgs): Promise<ITransactionResult> {
    const result = await this.contract.depositAndCall(args)
    return toTxResult(result)
  }
}

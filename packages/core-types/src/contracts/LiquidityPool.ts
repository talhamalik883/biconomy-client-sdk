import type { LiquidityPoolDepositAndCallArgs } from 'liquidity-pool.types'
import type { ITransactionResult } from 'transaction.types'

export interface LiquidityPoolContract {
  depositAndCall(args: LiquidityPoolDepositAndCallArgs): Promise<ITransactionResult>
}

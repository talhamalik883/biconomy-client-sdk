import type { BigNumberish } from 'ethers'

export type LiquidityPoolDetails = {}

export class LiquidityPoolUtils {
  // TODO: Implement
  async preDepositCheck(
    tokenAddress: string,
    fromAddress: string,
    fromChainId: number,
    toChainId: number,
    amount: BigNumberish
  ): Promise<{
    status: boolean
    reason?: string
  }> {
    return { status: true }
  }

  async getSupportedTokens(chaindId: string): Promise<LiquidityPoolDetails[]> {
    return []
  }

  async getPoolInformation() {}
}

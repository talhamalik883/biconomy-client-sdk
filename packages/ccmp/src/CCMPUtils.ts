import { GasFeePaymentArgsStruct } from '@biconomy-sdk/core-types'
import { BytesLike } from 'ethers'

export class CCMPUtils {
  //TODO: Implement this
  async getGasFeeEstimate(
    from: string,
    to: string,
    calldata: BytesLike,
    chainId: number,
    feeTokenAddress: string
  ): Promise<GasFeePaymentArgsStruct> {
    return {
      relayer: '0x0000000000000000000000000000000000000000',
      feeTokenAddress,
      feeAmount: 0
    }
  }
}

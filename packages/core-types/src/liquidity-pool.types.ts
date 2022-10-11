import type { BigNumberish } from '@ethersproject/bignumber'
import type {
  CCMPMessagePayloadStruct,
  GasFeePaymentArgsStruct,
  RouterAdaptor,
  BytesLike
} from 'ccmp.types'

export type LiquidityPoolDepositAndCallArgs = {
  toChainId: BigNumberish
  tokenAddress: string // Can be Native
  receiver: string
  amount: BigNumberish
  tag: string
  payloads: CCMPMessagePayloadStruct[]
  gasFeePaymentArgs: GasFeePaymentArgsStruct
  adaptorName: RouterAdaptor
  routerArgs: BytesLike
  hyphenArgs: BytesLike[]
}

export interface TokenTransferArgsBase {
  fromChainId: number
  toChainId: number
  tokenAddress: string // Can be Native
  receiver: string
  amount: BigNumberish
  tag: string
  payloads: CCMPMessagePayloadStruct[]
  adaptorName: RouterAdaptor
  routerArgs?: any
}

export interface TokenTransferViaWormholeArgs extends TokenTransferArgsBase {
  adaptorName: 'wormhole'
  routerArgs: {
    consistencyLevel: number
  }
}
export interface TokenTransferViaAxelarArgs extends TokenTransferArgsBase {
  adaptorName: 'axelar'
  routerArgs?: null
}
export interface TokenTransferViaAbacusArgs extends TokenTransferArgsBase {
  adaptorName: 'abacus'
  routerArgs?: null
}

export interface OptionalTokenTransferArgs {
  minAmount?: BigNumberish
  reclaimerEoa?: string
}

export interface EstimateTransferFeeResponse {
  gasFee: GasFeePaymentArgsStruct
  transferFee: BigNumberish
  transferFeePercentage: number
  reward: BigNumberish
  netTransferFee: BigNumberish
  amountToGet: BigNumberish
}

export type TokenTransferArgs =
  | TokenTransferViaWormholeArgs
  | TokenTransferViaAbacusArgs
  | TokenTransferViaAxelarArgs

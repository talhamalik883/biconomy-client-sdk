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

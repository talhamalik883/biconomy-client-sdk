import { BigNumber, BigNumberish } from '@ethersproject/bignumber'

export type Bytes = ArrayLike<number>
export type BytesLike = Bytes | string

export type RouterAdaptor = 'wormhole' | 'axelar' | 'abacus'

export type GasFeePaymentArgsStruct = {
  feeTokenAddress: string
  feeAmount: BigNumberish
  relayer: string
}

export type CCMPMessagePayloadStruct = {
  to: string
  _calldata: BytesLike
}

export type CCMPMessagePayloadStructOutput = [string, string] & {
  to: string
  _calldata: string
}

export type CCMPMessageStruct = {
  sender: string
  sourceGateway: string
  sourceAdaptor: string
  sourceChainId: number
  destinationGateway: string
  destinationChainId: number
  nonce: BigNumberish
  routerAdaptor: RouterAdaptor
  gasFeePaymentArgs: GasFeePaymentArgsStruct
  payload: CCMPMessagePayloadStruct[]
}
import { ContractTransaction } from '@ethersproject/contracts'
import { BaseTransactionResult } from '@gnosis.pm/safe-core-sdk-types'

export const JsonRpcVersion = '2.0'

export interface ProviderRpcError extends Error {
  message: string
  code?: number
  data?: { [key: string]: any }
}
export interface JsonRpcRequest {
  jsonrpc?: string
  id?: number
  method: string
  params?: any[]
}

export const permittedJsonRpcMethods = [
  'net_version',
  'eth_chainId',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getCode',
  'eth_estimateGas',
  'eth_gasPrice',
]

export interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result: any
  error?: ProviderRpcError
}

export type JsonRpcResponseCallback = (error?: ProviderRpcError, response?: JsonRpcResponse) => void

export type JsonRpcHandlerFunc = (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => void


export interface JsonRpcHandler {
  sendAsync: JsonRpcHandlerFunc
}

export type JsonRpcFetchFunc = (method: string, params?: any[], chainId?: number) => Promise<any>

// EIP-1193 function signature
export type JsonRpcRequestFunc = (request: { method: string; params?: any[] }, chainId?: number) => Promise<any>

export type JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => JsonRpcHandlerFunc

export interface JsonRpcMiddlewareHandler {
  sendAsyncMiddleware: JsonRpcMiddleware
}


export interface EthersTransactionOptions {
  from?: string
  gasLimit?: number | string
  gasPrice?: number | string
}

export interface EthersTransactionResult extends BaseTransactionResult {
  transactionResponse: ContractTransaction
  options?: EthersTransactionOptions
}

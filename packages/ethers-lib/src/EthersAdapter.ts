import { TransactionResponse } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { BigNumber } from '@ethersproject/bignumber'
import { Provider, JsonRpcProvider } from '@ethersproject/providers'
import {
  Eip3770Address,
  EthAdapter,
  EthAdapterTransaction,
  GetContractProps,
  SmartWalletContract
} from '@biconomy-sdk/core-types'
import { validateEip3770Address } from '@gnosis.pm/safe-core-sdk-utils'
import { ethers, logger } from 'ethers'
import {
  getMultiSendContractInstance,
  getMultiSendCallOnlyContractInstance,
  getSmartWalletContractInstance,
  getSmartWalletFactoryContractInstance
} from './contracts/contractInstancesEthers'
import SmartWalletProxyFactoryEthersContract from './contracts/SmartWalletFactory/SmartWalletProxyFactoryEthersContract'
import MultiSendEthersContract from './contracts/MultiSend/MultiSendEthersContract'
import MultiSendCallOnlyEthersContract from './contracts/MultiSendCallOnly/MultiSendCallOnlyEthersContract'
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResponseCallback,
  permittedJsonRpcMethods
} from 'types'

type Ethers = typeof ethers

export interface EthersAdapterConfig {
  /** ethers - Ethers v5 library */
  ethers: Ethers
  /** signer - Ethers signer */
  signer: Signer

  provider: JsonRpcProvider
}

class EthersAdapter implements EthAdapter {
  #ethers: Ethers
  #signer: Signer
  #provider: JsonRpcProvider

  constructor({ ethers, signer, provider }: EthersAdapterConfig) {
    if (!ethers) {
      throw new Error('ethers property missing from options')
    }
    if (!signer.provider) {
      throw new Error('Signer must be connected to a provider')
    }
    this.#signer = signer
    this.#provider = provider
    //this.#provider = signer.provider
    this.#ethers = ethers
  }

  // Review
  getProvider(): JsonRpcProvider {
    return this.#provider
  }

  getSigner(): Signer {
    return this.#signer
  }

  async getEip3770Address(fullAddress: string): Promise<Eip3770Address> {
    const chainId = await this.getChainId()
    return validateEip3770Address(fullAddress, chainId)
  }

  async getBalance(address: string): Promise<BigNumber> {
    return BigNumber.from(await this.#provider.getBalance(address))
  }

  async getChainId(): Promise<number> {
    return (await this.#provider.getNetwork()).chainId
  }

  getSmartWalletContract({ chainId, singletonDeployment }: GetContractProps): SmartWalletContract {
    const contractAddress = singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid Safe Proxy contract address')
    }
    return getSmartWalletContractInstance(contractAddress, this.#provider)
  }

  getMultiSendContract({
    chainId,
    singletonDeployment
  }: GetContractProps): MultiSendEthersContract {
    const contractAddress = singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid Multi Send contract address')
    }
    return getMultiSendContractInstance(contractAddress, this.#provider)
  }

  getMultiSendCallOnlyContract({
    chainId,
    singletonDeployment
  }: GetContractProps): MultiSendCallOnlyEthersContract {
    const contractAddress = singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid Multi Send contract address')
    }
    return getMultiSendCallOnlyContractInstance(contractAddress, this.#provider)
  }

  getSmartWalletFactoryContract({
    chainId,
    singletonDeployment
  }: GetContractProps): SmartWalletProxyFactoryEthersContract {
    const contractAddress = singletonDeployment?.networkAddresses[chainId]
    if (!contractAddress) {
      throw new Error('Invalid Safe Proxy Factory contract address')
    }
    return getSmartWalletFactoryContractInstance(contractAddress, this.#provider)
  }

  async getContractCode(address: string): Promise<string> {
    return this.#provider.getCode(address)
  }

  async isContractDeployed(address: string): Promise<boolean> {
    const contractCode = await this.#provider.getCode(address)
    return contractCode !== '0x'
  }

  async getTransaction(transactionHash: string): Promise<TransactionResponse> {
    return this.#provider.getTransaction(transactionHash)
  }

  async getSignerAddress(): Promise<string> {
    return this.#signer.getAddress()
  }

  signMessage(message: string): Promise<string> {
    const messageArray = this.#ethers.utils.arrayify(message)
    return this.#signer.signMessage(messageArray)
  }

  // Review
  async estimateGas(transaction: EthAdapterTransaction): Promise<number> {
    return (await this.#provider.estimateGas(transaction)).toNumber()
  }

  call(transaction: EthAdapterTransaction): Promise<string> {
    return this.#provider.call(transaction)
  }

  sendAsync = async (
    request: JsonRpcRequest,
    callback: JsonRpcResponseCallback,
    chainId?: number
  ) => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id!,
      result: null
    }

    try {
      // only allow public json rpc method to the provider when user is not logged in, aka signer is not set
      if (
        (!this.#signer || this.#signer === null) &&
        !permittedJsonRpcMethods.includes(request.method)
      ) {
        // throw new Error(`not logged in. ${request.method} is unavailable`)
        throw 'Err Required Signer'
      }

      // wallet signer
      const signer = this.#signer
      if (!signer) throw new Error('WalletRequestHandler: wallet signer is not configured')

      // fetch the provider for the specific chain, or undefined will select defaultChain
      const provider = await this.#provider
      if (!provider)
        throw new Error(
          `WalletRequestHandler: wallet provider is not configured for chainId ${chainId}`
        )

      switch (request.method) {
        case 'net_version': {
          const result = await provider.send('net_version', [])
          response.result = result
          break
        }

        case 'eth_chainId': {
          const result = await provider.send('eth_chainId', [])
          response.result = result
          break
        }

        case 'eth_accounts': {
          const walletAddress = await signer.getAddress()
          response.result = [walletAddress]
          break
        }

        case 'eth_getBalance': {
          const [accountAddress, blockTag] = request.params!
          const walletBalance = await provider.getBalance(accountAddress, blockTag)
          response.result = walletBalance.toHexString()
          break
        }

        case 'eth_sendTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendtransaction
          const [transactionParams] = request.params!

          let txnHash = ''
          // prompter is null, so we'll send from here
          const txnResponse = await signer.sendTransaction(transactionParams)
          txnHash = txnResponse.hash

          if (txnHash) {
            response.result = txnHash
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTransaction': {
          // https://eth.wiki/json-rpc/API#eth_signTransaction
          const [transaction] = request.params!
          const sender = this.#ethers.utils.getAddress(transaction.from)

          if (sender !== (await signer.getAddress())) {
            throw new Error('sender address does not match wallet')
          }
          // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
          // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
          //
          // TODO: verify serializing / transporting the SignedTransaction object works as expected, most likely however
          // we will want to resolveProperties the bignumber values to hex strings
          response.result = await signer.signTransaction(transaction)

          break
        }

        case 'eth_getTransactionCount': {
          const address = this.#ethers.utils.getAddress(request.params![0] as string)
          const tag = request.params![1]

          const walletAddress = this.#ethers.utils.getAddress(await signer.getAddress())

          if (address === walletAddress) {
            const count = await signer.getTransactionCount(tag)
            response.result = this.#ethers.BigNumber.from(count).toHexString()
          } else {
            const count = await provider.getTransactionCount(address, tag)
            response.result = this.#ethers.BigNumber.from(count).toHexString()
          }
          break
        }

        case 'eth_blockNumber': {
          response.result = await provider.getBlockNumber()
          break
        }

        case 'eth_getBlockByNumber': {
          response.result = await provider.getBlock(
            request.params![0] /* , jsonRpcRequest.params[1] */
          )
          break
        }

        case 'eth_getBlockByHash': {
          response.result = await provider.getBlock(
            request.params![0] /* , jsonRpcRequest.params[1] */
          )
          break
        }

        case 'eth_getTransactionByHash': {
          response.result = await provider.getTransaction(request.params![0])
          break
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params!
          response.result = await provider.call(transactionObject, blockTag)
          break
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params!
          response.result = await provider.getCode(contractAddress, blockTag)
          break
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params!
          response.result = await provider.estimateGas(transactionObject)
          break
        }

        case 'eth_gasPrice': {
          const gasPrice = await provider.getGasPrice()
          response.result = gasPrice.toHexString()
          break
        }

        default: {
          // NOTE: provider here will be chain-bound if chainId is provided
          const providerResponse = await provider.send(request.method, request.params!)
          response.result = providerResponse
        }
      }
    } catch (err) {
      console.log(err)
      // See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1193.md#rpc-errors
      response.result = null
      // response.error = {
      //   ...new Error(err),
      //   code: 4001
      // }
    }

    callback(undefined, response)
  }
}

export default EthersAdapter
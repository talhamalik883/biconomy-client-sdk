import { BigNumber, BigNumberish } from 'ethers'
import { Provider } from '@ethersproject/providers'
import { UserOperation } from '@biconomy-sdk/core-types'
import { ClientConfig } from './ClientConfig'

import {
  EntryPointContractV101,
  SmartWalletFactoryV101,
  SmartWalletContractV101
} from '@biconomy-sdk/ethers-lib'
import { TransactionDetailsForUserOp } from './TransactionDetailsForUserOp'
import { resolveProperties } from 'ethers/lib/utils'
import { PaymasterAPI } from './PaymasterAPI'
import { getRequestId } from '@biconomy-sdk/common'
import { ZERO_ADDRESS } from '@biconomy-sdk/core-types'
/**
 * Base class for all Smart Wallet ERC-4337 Clients to implement.
 * Subclass should inherit 5 methods to support a specific wallet contract:
 *
 * - getWalletInitCode - return the value to put into the "initCode" field, if the wallet is not yet deployed. should create the wallet instance using a factory contract.
 * - getNonce - return current wallet's nonce value
 * - encodeExecute - encode the call from entryPoint through our wallet to the target contract.
 * - signRequestId - sign the requestId of a UserOp.
 *
 * The user can use the following APIs:
 * - createUnsignedUserOp - given "target" and "calldata", fill userOp to perform that operation from the wallet.
 * - createSignedUserOp - helper to call the above createUnsignedUserOp, and then extract the requestId and sign it
 */

// Note: Resembles SmartAccount methods itself. Could be sperated out across smart-account & || transactions || new package and reclaim

export abstract class BaseWalletAPI {
  private senderAddress!: string
  private isPhantom = true
  // entryPoint connected to "zero" address. allowed to make static calls (e.g. to getSenderAddress)
  // private readonly entryPointView: EntryPoint

  /**
   * subclass MAY initialize to support custom paymaster
   */
  paymasterAPI?: PaymasterAPI

  /**
   * our wallet contract.
   * should support the "execFromSingleton" and "nonce" methods
   */
  walletContract!: SmartWalletContractV101

  /**
   * base constructor.
   * subclass SHOULD add parameters that define the owner (signer) of this wallet
   * @param provider - read-only provider for view calls
   * @param entryPointAddress - the entryPoint to send requests through (used to calculate the request-id, and for gas estimations)
   * @param walletAddress. may be empty for new wallet (using factory to determine address)
   */
  protected constructor(
    readonly provider: Provider,
    readonly entryPoint: EntryPointContractV101,
    readonly clientConfig: ClientConfig,
    readonly walletAddress?: string
  ) {
    // factory "connect" define the contract address. the contract "connect" defines the "from" address.
    // this.entryPointView = EntryPoint__factory.connect(entryPointAddress, provider).connect(ethers.constants.AddressZero)
    this.paymasterAPI = new PaymasterAPI(
      clientConfig.signingServiceUrl,
      clientConfig.dappId,
      clientConfig.paymasterAddress
    )
  }

  // based on provider chainId we maintain smartWalletContract..
  async _getWalletContract(): Promise<SmartWalletContractV101> {
    if (this.walletContract == null) {
      this.walletContract = SmartWalletFactoryV101.connect(
        await this.getWalletAddress(),
        this.provider
      )
    }
    return this.walletContract
  }

  async init(): Promise<this> {
    await this.getWalletAddress()
    return this
  }

  /**
   * return the value to put into the "initCode" field, if the wallet is not yet deployed.
   * this value holds the "factory" address, followed by this wallet's information
   */
  abstract getWalletInitCode(): Promise<string>

  /**
   * return current wallet's nonce.
   */
  abstract getNonce(batchId: number): Promise<BigNumber>

  /**
   * encode the call from entryPoint through our wallet to the target contract.
   * @param target
   * @param value
   * @param data
   */
  abstract encodeExecute(
    target: string,
    value: BigNumberish,
    data: string,
    isDelegateCall: boolean
  ): Promise<string>

  /**
   * sign a userOp's hash (requestId).
   * @param requestId
   */
  abstract signRequestId(requestId: string): Promise<string>

  /**
   * check if the wallet is already deployed.
   */
  async checkWalletPhantom(): Promise<boolean> {
    if (!this.isPhantom) {
      // already deployed. no need to check anymore.
      return this.isPhantom
    }
    const senderAddressCode = await this.provider.getCode(this.getWalletAddress())
    if (senderAddressCode.length > 2) {
      console.log(`SimpleWallet Contract already deployed at ${this.senderAddress}`)
      this.isPhantom = false
    } else {
      // console.log(`SimpleWallet Contract is NOT YET deployed at ${this.senderAddress} - working in "phantom wallet" mode.`)
    }
    return this.isPhantom
  }

  /**
   * calculate the wallet address even before it is deployed
   */
  async getCounterFactualAddress(): Promise<string> {
    const initCode = await this.getWalletInitCode()
    // use entryPoint to query wallet address (factory can provide a helper method to do the same, but
    // this method attempts to be generic
    return await this.entryPoint.callStatic.getSenderAddress(initCode)
  }

  /**
   * return initCode value to into the UserOp.
   * (either deployment code, or empty hex if contract already deployed)
   */
  async getInitCode(): Promise<string> {
    if (await this.checkWalletPhantom()) {
      return await this.getWalletInitCode()
    }
    return '0x'
  }

  /**
   * return maximum gas used for verification.
   * NOTE: createUnsignedUserOp will add to this value the cost of creation, if the wallet is not yet created.
   */
  async getVerificationGasLimit(): Promise<BigNumberish> {
    return 100000
  }

  /**
   * should cover cost of putting calldata on-chain, and some overhead.
   * actual overhead depends on the expected bundle size
   */
  async getPreVerificationGas(userOp: Partial<UserOperation>): Promise<number> {
    console.log(userOp)
    const bundleSize = 1
    const cost = 21000
    // TODO: calculate calldata cost
    const preVerificationGas = Math.floor(cost / bundleSize)
    console.log('preVerificationGas ', Math.floor(preVerificationGas))
    return Math.floor(preVerificationGas)
  }

  async encodeUserOpCallDataAndGasLimit(
    detailsForUserOp: TransactionDetailsForUserOp
  ): Promise<{ callData: string; callGasLimit: BigNumber }> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    function parseNumber(a: any): BigNumber | null {
      if (a == null || a === '') return null
      return BigNumber.from(a.toString())
    }

    if (detailsForUserOp && detailsForUserOp.target === '' && detailsForUserOp.data === '') {
      return {
        callData: '0x',
        callGasLimit: BigNumber.from('21000')
      }
    }

    const value = parseNumber(detailsForUserOp.value) ?? BigNumber.from(0)
    const callData = await this.encodeExecute(
      detailsForUserOp.target,
      value,
      detailsForUserOp.data,
      detailsForUserOp.isDelegateCall || false
    )

    /*const callData = (await this._getWalletContract()).encodeFunctionData('execFromEntryPoint', [
      detailsForUserOp.target,
      value,
      detailsForUserOp.data,
      0,
      300000
    ])*/

    const callGasLimit =
      parseNumber(detailsForUserOp.gasLimit) ??
      (await this.provider.estimateGas({
        from: this.entryPoint.address,
        to: this.getWalletAddress(),
        data: callData
      }))

    return {
      callData,
      callGasLimit
    }
  }

  /**
   * return requestId for signing.
   * This value matches entryPoint.getRequestId (calculated off-chain, to avoid a view call)
   * @param userOp userOperation, (signature field ignored)
   */
  async getRequestId(userOp: UserOperation): Promise<string> {
    const op = await resolveProperties(userOp)
    console.log('op ', op)
    const chainId = await this.provider.getNetwork().then((net) => net.chainId)
    console.log('chainId ', chainId)
    return getRequestId(op, this.entryPoint.address, chainId)
  }

  /**
   * return the wallet's address.
   * this value is valid even before deploying the wallet.
   */
  async getWalletAddress(): Promise<string> {
    if (this.senderAddress == null) {
      if (this.walletAddress != null) {
        this.senderAddress = this.walletAddress
      } else {
        this.senderAddress = await this.getCounterFactualAddress()
      }
    }
    return this.senderAddress
  }

  /**
   * create a UserOperation, filling all details (except signature)
   * - if wallet is not yet created, add initCode to deploy it.
   * - if gas or nonce are missing, read them from the chain (note that we can't fill gaslimit before the wallet is created)
   * @param info
   */
  async createUnsignedUserOp(info: TransactionDetailsForUserOp): Promise<UserOperation> {
    const { callData, callGasLimit } = await this.encodeUserOpCallDataAndGasLimit(info)
    const initCode = await this.getInitCode()
    console.log('initCode ', initCode)

    let verificationGasLimit = BigNumber.from(await this.getVerificationGasLimit())
    if (initCode.length > 2) {
      // add creation to required verification gas
      // using entry point static for gas estimation
      const entryPointStatic = this.entryPoint.connect(ZERO_ADDRESS)
      const initGas = await entryPointStatic.estimateGas.getSenderAddress(initCode, {
        from: ZERO_ADDRESS
      })
      verificationGasLimit = verificationGasLimit.add(initGas)
    }

    let { maxFeePerGas, maxPriorityFeePerGas } = info
    if (maxFeePerGas == null || maxPriorityFeePerGas == null) {
      const feeData = await this.provider.getFeeData()
      if (maxFeePerGas == null) {
        maxFeePerGas = feeData.maxFeePerGas ?? undefined
      }
      if (maxPriorityFeePerGas == null) {
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? undefined
      }
    }

    const partialUserOp: any = {
      sender: await this.getWalletAddress(),
      nonce: await this.getNonce(0), // TODO: add batchid as param
      initCode,
      callData,
      callGasLimit,
      verificationGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas
    }

    partialUserOp.paymasterAndData =
      this.paymasterAPI == null ? '0x' : await this.paymasterAPI.getPaymasterAndData(partialUserOp)
    return {
      ...partialUserOp,
      preVerificationGas: this.getPreVerificationGas(partialUserOp),
      signature: ''
    }
  }

  /**
   * Sign the filled userOp.
   * @param userOp the UserOperation to sign (with signature field ignored)
   */
  async signUserOp(userOp: UserOperation): Promise<UserOperation> {
    console.log('inside signUserOp')
    const requestId = await this.getRequestId(userOp)
    const signature = await this.signRequestId(requestId)
    return {
      ...userOp,
      signature
    }
  }

  /**
   * helper method: create and sign a user operation.
   * @param info transaction details for the userOp
   */
  async createSignedUserOp(info: TransactionDetailsForUserOp): Promise<UserOperation> {
    return await this.signUserOp(await this.createUnsignedUserOp(info))
  }
}

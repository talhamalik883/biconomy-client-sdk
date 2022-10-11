import { ethers } from 'ethers'
import type { BytesLike } from 'ethers'
import type SmartAccount from '@biconomy-sdk/smart-account'
import type TransactionManager from '@biconomy-sdk/transactions'
import type { LiquidityPool } from '@biconomy-sdk/ethers-lib/src/contracts/LiquidityPool/LiquidityPool'
import {
  IWalletTransaction,
  TokenTransferArgs,
  OptionalTokenTransferArgs,
  EstimateTransferFeeResponse
} from '@biconomy-sdk/core-types'
import type { LiquidityPoolUtils } from './LiquidityPoolUtils'
import type { CCMPUtils } from './CCMPUtils'
import type NodeClient from '@biconomy-sdk/node-client'

class ChainIdNotSupportedError extends Error {
  constructor(chainId: number) {
    super(`ChainId ${chainId} is not supported`)
  }
}

class PreDepositCheckFailedError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, PreDepositCheckFailedError.prototype)
  }
}

export class DepositAndCallManager {
  abiCoder = new ethers.utils.AbiCoder()

  // TODO: Figure out how to bootstrap this from internal configuration
  constructor(
    readonly supportedChains: number[] = [],
    readonly transactionManager: TransactionManager,
    readonly chaindToLiquidityPool: Record<number, LiquidityPool>,
    readonly liquidityPoolUtils: LiquidityPoolUtils,
    readonly ccmpUtils: CCMPUtils,
    readonly nodeClient: NodeClient
  ) {}

  async createDepositAndCallTransaction(
    account: SmartAccount,
    tokenTransferArgs: TokenTransferArgs,
    optionalTransferArgs: OptionalTokenTransferArgs = {}
  ): Promise<IWalletTransaction> {
    // TODO: Users should not need to specify which adaptor to use, we should automatiaally select the best one by calling an api
    //       but it should also be override-able?
    const liquidityPool = this.chaindToLiquidityPool[tokenTransferArgs.toChainId]
    if (!liquidityPool) {
      throw new Error('Liquidity pool not found for chain ' + tokenTransferArgs.toChainId)
    }

    // Call preDepositCheck API to check preconditions like sufficient liquidity, etc
    const { status: preDepositCheckStatus, reason: preDepositCheckFailureReason } =
      await this.liquidityPoolUtils.preDepositCheck(
        tokenTransferArgs.tokenAddress,
        account.address,
        tokenTransferArgs.fromChainId,
        tokenTransferArgs.toChainId,
        tokenTransferArgs.amount
      )

    if (!preDepositCheckStatus) {
      throw new PreDepositCheckFailedError(
        preDepositCheckFailureReason || 'Pre deposit check failed with unknown error'
      )
    }

    const { gasFee: gasFeePaymentArgs } = await this.estimateTransferFee(
      account.address,
      tokenTransferArgs,
      optionalTransferArgs
    )

    // TODO: Verify possible adaptors
    const hyphenArgs = this.getHyphenArgs(optionalTransferArgs)

    const depositAndCallCalldata = liquidityPool.contract.interface.encodeFunctionData(
      'depositAndCall',
      [
        {
          ...tokenTransferArgs,
          hyphenArgs,
          routerArgs: this.getRouterArgs(tokenTransferArgs),
          gasFeePaymentArgs
        }
      ]
    )

    // TODO: How do I select if I want to use SCW or AA Flow?
    // TODO: Prepend approve call if approval is insufficient
    const transaction = this.transactionManager.createTransactionBatch({
      // TODO: How do i decide version
      version: '1.0.1',
      transactions: [
        {
          to: liquidityPool.contract.address,
          value: 0,
          data: depositAndCallCalldata
        }
      ],
      batchId: 1,
      chainId: tokenTransferArgs.toChainId
    })

    return transaction
  }

  async estimateTransferFee(
    fromAddress: string,
    tokenTransferArgs: TokenTransferArgs,
    optionalTransferArgs: OptionalTokenTransferArgs = {}
  ): Promise<EstimateTransferFeeResponse> {
    return this.nodeClient.getTokenTransferFeeEstimate({
      fromAddress,
      tokenTransferArgs,
      optionalTransferArgs
    })
  }

  private getHyphenArgs(args?: OptionalTokenTransferArgs): BytesLike[] {
    if (args?.minAmount && args?.reclaimerEoa) {
      return [this.abiCoder.encode(['uint256', 'address'], [args.minAmount, args.reclaimerEoa])]
    }

    return []
  }

  private getRouterArgs(args: TokenTransferArgs): BytesLike {
    if (args.adaptorName === 'wormhole') {
      return this.abiCoder.encode(['uint256'], [args.routerArgs.consistencyLevel])
    }
    return this.abiCoder.encode(['uint256'], [0])
  }
}

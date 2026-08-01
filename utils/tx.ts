import { Transaction, type TransactionResponse } from 'ethers';

/**
 * `SignatureVerify.report` recovers the signer from `keccak256(message)`, so
 * `message` has to be the transaction exactly as it was signed — that is, the
 * serialized transaction without its signature.
 */
export const getUnsignedSerializedTx = (tx: TransactionResponse): string => {
  switch (tx.type) {
    case 0:
      return Transaction.from({
        type: 0,
        to: tx.to,
        nonce: tx.nonce,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        data: tx.data,
        value: tx.value,
        chainId: tx.chainId,
      }).unsignedSerialized;
    case 2:
      return Transaction.from({
        type: 2,
        to: tx.to,
        nonce: tx.nonce,
        gasLimit: tx.gasLimit,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        data: tx.data,
        value: tx.value,
        chainId: tx.chainId,
      }).unsignedSerialized;
    default:
      throw new Error(`Unsupported tx type: ${tx.type}`);
  }
};

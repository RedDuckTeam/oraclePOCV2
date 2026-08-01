import { ethers, network } from 'hardhat';

import { getEnvVars, getWsRpcUrl, Network } from '../config';
import { getUnsignedSerializedTx } from '../utils/tx';

const { SIGNATURE_VERIFY_ADDRESS, FORBIDDEN_ADDRESSES } = getEnvVars();

if (!SIGNATURE_VERIFY_ADDRESS) {
  throw new Error('Set SIGNATURE_VERIFY_ADDRESS in .env');
}
if (FORBIDDEN_ADDRESSES.length === 0) {
  throw new Error('Set FORBIDDEN_ADDRESSES in .env (comma-separated)');
}

// `tx.to` comes back checksummed, while .env is written by hand — compare lowercased.
const forbiddenAddresses = new Set(
  FORBIDDEN_ADDRESSES.map((address) => address.toLowerCase()),
);

const wsProvider = new ethers.WebSocketProvider(
  getWsRpcUrl(network.name as Network),
  network.config.chainId,
);

console.log(
  `Watching ${network.name} for txs to ${forbiddenAddresses.size} forbidden address(es).`,
);

wsProvider.on('block', async (blockNumber: number) => {
  console.log(`Found new block ${blockNumber}.`);
  const block = await wsProvider.getBlock(blockNumber, true);
  if (!block) return;

  await Promise.all(
    block.prefetchedTransactions
      .filter((tx) => tx.to && forbiddenAddresses.has(tx.to.toLowerCase()))
      .map(async (tx) => {
        console.log(`Found tx ${tx.hash} to forbidden address ${tx.to}.`);
        if (!tx.signature) {
          console.log(`Skipping ${tx.hash}: no signature.`);
          return;
        }

        const [signer] = await ethers.getSigners();
        const verifySignature = await ethers.getContractAt(
          'SignatureVerify',
          SIGNATURE_VERIFY_ADDRESS,
          signer,
        );
        await (
          await verifySignature.report(
            getUnsignedSerializedTx(tx),
            tx.signature.serialized,
          )
        ).wait();
        console.log(`Reported ${tx.hash} to ${SIGNATURE_VERIFY_ADDRESS}.`);
      }),
  );
});

import { ethers } from 'hardhat';

import { getEnvVars } from '../config';

const { SIGNATURE_VERIFY_ADDRESS } = getEnvVars();

// Not project config but a per-run argument: `hardhat run` does not forward argv.
const CHECK_ADDRESS = process.env.CHECK_ADDRESS || '';

async function main() {
  if (!SIGNATURE_VERIFY_ADDRESS) {
    throw new Error('Set SIGNATURE_VERIFY_ADDRESS in .env');
  }
  if (!CHECK_ADDRESS) {
    throw new Error(
      'Pass the address to check: CHECK_ADDRESS=0x... hardhat run ...',
    );
  }

  const [deployer] = await ethers.getSigners();
  const verifySignature = await ethers.getContractAt(
    'SignatureVerify',
    SIGNATURE_VERIFY_ADDRESS,
    deployer,
  );
  const isUserBanned = await verifySignature.blacklistedUsers(CHECK_ADDRESS);
  console.log(
    `${CHECK_ADDRESS} banned by ${SIGNATURE_VERIFY_ADDRESS}: ${isUserBanned}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

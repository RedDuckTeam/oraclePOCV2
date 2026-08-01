// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat';

import { getEnvVars } from '../config';

const { FORBIDDEN_ADDRESSES } = getEnvVars();

async function main() {
  if (FORBIDDEN_ADDRESSES.length === 0) {
    throw new Error('Set FORBIDDEN_ADDRESSES in .env (comma-separated)');
  }

  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory('SignatureVerify', deployer);
  const verifySignature = await factory.deploy();
  await verifySignature.waitForDeployment();

  for (const forbiddenAddress of FORBIDDEN_ADDRESSES) {
    await (
      await verifySignature.addBlacklistedContract(forbiddenAddress)
    ).wait();
    console.log(`Blacklisted contract ${forbiddenAddress}`);
  }

  console.log(
    `SignatureVerify deployed at ${await verifySignature.getAddress()}`,
  );
  console.log('Put it into .env as SIGNATURE_VERIFY_ADDRESS');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

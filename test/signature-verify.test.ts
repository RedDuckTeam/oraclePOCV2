import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { Transaction } from 'ethers';
import { ethers } from 'hardhat';

import { getUnsignedSerializedTx } from '../utils/tx';

const deployFixture = async () => {
  const [signer, other] = await ethers.getSigners();
  const [verifyFactory, greeterFactory] = await Promise.all([
    ethers.getContractFactory('SignatureVerify', signer),
    ethers.getContractFactory('Greeter', signer),
  ]);
  const [verifySignature, greeter] = await Promise.all([
    verifyFactory.deploy(),
    greeterFactory.deploy('Hello, world!'),
  ]);
  await Promise.all([
    verifySignature.waitForDeployment(),
    greeter.waitForDeployment(),
  ]);

  return {
    verifySignature,
    greeter,
    greeterAddress: await greeter.getAddress(),
    signer,
    other,
  };
};

/** Sends a transaction to `greeter` and returns it as `report` wants it. */
const reportable = async (greeter: { setGreeting: (s: string) => unknown }) => {
  const tx = (await greeter.setGreeting('HELLO2')) as Awaited<
    ReturnType<typeof ethers.provider.getTransaction>
  >;
  if (!tx || !tx.signature) throw new Error('Transaction is not signed');
  await tx.wait();

  return {
    message: getUnsignedSerializedTx(tx),
    signature: tx.signature.serialized,
  };
};

describe('Signature Verify', () => {
  describe('report', () => {
    it('does not blacklist a user calling a non-blacklisted contract', async () => {
      const { verifySignature, signer, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      const { message, signature } = await reportable(greeter);

      expect(await verifySignature.report.staticCall(message, signature)).eq(
        greeterAddress,
      );
      await expect(verifySignature.report(message, signature)).to.not.be
        .reverted;
      expect(await verifySignature.blacklistedUsers(signer.address)).eq(false);
    });

    it('blacklists the signer of a tx to a blacklisted contract', async () => {
      const { verifySignature, signer, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      await verifySignature.addBlacklistedContract(greeterAddress);
      const { message, signature } = await reportable(greeter);

      await expect(verifySignature.report(message, signature))
        .to.emit(verifySignature, 'UserBlacklisted')
        .withArgs(signer.address, greeterAddress);
      expect(await verifySignature.blacklistedUsers(signer.address)).eq(true);
    });

    it('recovers the signer that actually sent the transaction', async () => {
      const { verifySignature, signer, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      await verifySignature.addBlacklistedContract(greeterAddress);
      const { message, signature } = await reportable(greeter);

      expect(ethers.recoverAddress(ethers.keccak256(message), signature)).eq(
        signer.address,
      );
    });

    it('emits UserBlacklisted only once per user', async () => {
      const { verifySignature, greeter, greeterAddress } = await loadFixture(
        deployFixture,
      );

      await verifySignature.addBlacklistedContract(greeterAddress);
      const first = await reportable(greeter);
      const second = await reportable(greeter);

      await verifySignature.report(first.message, first.signature);
      await expect(
        verifySignature.report(second.message, second.signature),
      ).to.not.emit(verifySignature, 'UserBlacklisted');
    });

    it('rejects a transaction signed for another chain', async () => {
      const { verifySignature, signer, greeterAddress } = await loadFixture(
        deployFixture,
      );

      await verifySignature.addBlacklistedContract(greeterAddress);

      // Same shape as a real report, but signed for a chain that is not this one.
      const foreignTx = Transaction.from({
        type: 2,
        to: greeterAddress,
        nonce: 0,
        gasLimit: 100_000,
        maxFeePerGas: 1_000_000_000,
        maxPriorityFeePerGas: 1_000_000_000,
        data: '0x',
        value: 0,
        chainId: 1,
      });
      const signature = await signer.signMessage('unused');

      const { chainId } = await ethers.provider.getNetwork();
      await expect(
        verifySignature.report(foreignTx.unsignedSerialized, signature),
      )
        .to.be.revertedWithCustomError(verifySignature, 'ForeignChainId')
        .withArgs(chainId, 1);
    });

    // Only type 2 goes through the network, so the other RLP layouts are
    // exercised with transactions that are signed but never broadcast.
    for (const type of [0, 1] as const) {
      it(`decodes a type ${type} transaction`, async () => {
        const { verifySignature, greeterAddress } = await loadFixture(
          deployFixture,
        );
        await verifySignature.addBlacklistedContract(greeterAddress);

        const { chainId } = await ethers.provider.getNetwork();
        const wallet = ethers.Wallet.createRandom();
        const tx = Transaction.from({
          type,
          to: greeterAddress,
          nonce: 0,
          gasLimit: 21_000,
          gasPrice: 1_000_000_000,
          data: '0x',
          value: 0,
          chainId,
          ...(type === 1 ? { accessList: [] } : {}),
        });
        const signature = wallet.signingKey.sign(
          ethers.keccak256(tx.unsignedSerialized),
        ).serialized;

        await expect(verifySignature.report(tx.unsignedSerialized, signature))
          .to.emit(verifySignature, 'UserBlacklisted')
          .withArgs(wallet.address, greeterAddress);
      });
    }

    it('rejects a pre-EIP-155 transaction, which carries no chain id', async () => {
      const { verifySignature, signer, greeterAddress } = await loadFixture(
        deployFixture,
      );
      await verifySignature.addBlacklistedContract(greeterAddress);

      // [nonce, gasPrice, gasLimit, to, value, data] — the six legacy fields
      // without the (chainId, 0, 0) that EIP-155 appends.
      const message = ethers.encodeRlp([
        '0x',
        '0x3b9aca00',
        '0x5208',
        greeterAddress,
        '0x',
        '0x',
      ]);
      const signature = await signer.signMessage('unused');

      await expect(
        verifySignature.report(message, signature),
      ).to.be.revertedWithCustomError(verifySignature, 'MissingChainId');
    });
  });

  describe('blacklist management', () => {
    it('lets the owner add and remove a blacklisted contract', async () => {
      const { verifySignature, greeterAddress } = await loadFixture(
        deployFixture,
      );

      await expect(verifySignature.addBlacklistedContract(greeterAddress))
        .to.emit(verifySignature, 'ContractBlacklisted')
        .withArgs(greeterAddress);
      expect(await verifySignature.blacklistedContracts(greeterAddress)).eq(
        true,
      );

      await expect(verifySignature.removeBlacklistedContract(greeterAddress))
        .to.emit(verifySignature, 'ContractUnblacklisted')
        .withArgs(greeterAddress);
      expect(await verifySignature.blacklistedContracts(greeterAddress)).eq(
        false,
      );
    });

    it('stops blacklisting users once the contract is removed', async () => {
      const { verifySignature, signer, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      await verifySignature.addBlacklistedContract(greeterAddress);
      await verifySignature.removeBlacklistedContract(greeterAddress);

      const { message, signature } = await reportable(greeter);
      await verifySignature.report(message, signature);

      expect(await verifySignature.blacklistedUsers(signer.address)).eq(false);
    });

    it('lets the owner unban a user', async () => {
      const { verifySignature, signer, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      await verifySignature.addBlacklistedContract(greeterAddress);
      const { message, signature } = await reportable(greeter);
      await verifySignature.report(message, signature);

      await expect(verifySignature.unblacklistUser(signer.address))
        .to.emit(verifySignature, 'UserUnblacklisted')
        .withArgs(signer.address);
      expect(await verifySignature.blacklistedUsers(signer.address)).eq(false);
    });

    it('rejects redundant state changes', async () => {
      const { verifySignature, signer, greeterAddress } = await loadFixture(
        deployFixture,
      );

      await expect(verifySignature.removeBlacklistedContract(greeterAddress))
        .to.be.revertedWithCustomError(verifySignature, 'NotBlacklisted')
        .withArgs(greeterAddress);
      await expect(verifySignature.unblacklistUser(signer.address))
        .to.be.revertedWithCustomError(verifySignature, 'NotBlacklisted')
        .withArgs(signer.address);

      await verifySignature.addBlacklistedContract(greeterAddress);
      await expect(verifySignature.addBlacklistedContract(greeterAddress))
        .to.be.revertedWithCustomError(verifySignature, 'AlreadyBlacklisted')
        .withArgs(greeterAddress);
    });

    it('restricts blacklist management to the owner', async () => {
      const { verifySignature, other, greeterAddress } = await loadFixture(
        deployFixture,
      );
      const asOther = verifySignature.connect(other);

      await expect(
        asOther.addBlacklistedContract(greeterAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        asOther.removeBlacklistedContract(greeterAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(asOther.unblacklistUser(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('isGranted', () => {
    it('denies a blacklisted user and allows everyone else', async () => {
      const { verifySignature, signer, other, greeter, greeterAddress } =
        await loadFixture(deployFixture);

      const permissionId = ethers.id('SOME_PERMISSION');
      expect(
        await verifySignature.isGranted(
          greeterAddress,
          signer.address,
          permissionId,
          '0x',
        ),
      ).eq(true);

      await verifySignature.addBlacklistedContract(greeterAddress);
      const { message, signature } = await reportable(greeter);
      await verifySignature.report(message, signature);

      expect(
        await verifySignature.isGranted(
          greeterAddress,
          signer.address,
          permissionId,
          '0x',
        ),
      ).eq(false);
      expect(
        await verifySignature.isGranted(
          greeterAddress,
          other.address,
          permissionId,
          '0x',
        ),
      ).eq(true);
    });
  });
});

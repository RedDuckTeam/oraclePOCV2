<p align="center">
  <a href="https://redduck.io/?utm_source=github&amp;utm_medium=readme&amp;utm_campaign=oraclePOCV2">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/redduck-logo-dark.svg">
      <img src=".github/assets/redduck-logo.svg" alt="RedDuck" width="240">
    </picture>
  </a>
</p>

<h1 align="center">Permission Oracle</h1>

<p align="center">
  <b>Blacklist addresses for the contracts they touch — reported by an untrusted watcher, verified on-chain.</b>
</p>

---

A **compliance oracle** for Aragon-style DAOs. An off-chain watcher spots transactions sent to contracts you'd rather your members didn't touch, and a contract independently proves who signed them. Blacklisted addresses are then denied permissions through Aragon's `IPermissionOracle` interface. The watcher never has to be trusted: the contract recovers the signer from the transaction itself, so a relayer can only report what someone actually signed.

## Built with

| Area | Technology |
| --- | --- |
| Contracts | Solidity 0.8.10 |
| Tooling | Hardhat 2, TypeScript, Yarn 1 (classic) |
| Web3 | ethers v6, `@nomicfoundation/hardhat-ethers` |
| Testing | Mocha, Chai, `hardhat-chai-matchers`, solidity-coverage |
| Types | TypeChain (`ethers-v6` target) |
| Codestyle | ESLint, Prettier, solhint, husky + commitlint |

## About this repository

It answers the "who talked to a sanctioned contract" question on-chain without trusting whoever brings the evidence. The [design notes](#design-notes) below cover how it behaves at the edges.

If you'd like something like this built for your protocol, please reach out to us.

## How it works

1. The watcher subscribes to new blocks and filters transactions whose `to` is in `FORBIDDEN_ADDRESSES`.
2. For each hit, it re-serializes the transaction **exactly as it was signed** — without the signature — and calls `report(message, signature)`.
3. The contract RLP-decodes `message` to read `to` and the chain id, and rejects anything signed for a different chain.
4. If `to` is blacklisted, the contract `ecrecover`s the sender from `keccak256(message)` and marks it in `blacklistedUsers`, emitting `UserBlacklisted`.
5. The DAO calls `isGranted(_where, _who, _permissionId, _data)`, which returns `!blacklistedUsers[_who]`.

Field offsets differ per transaction type — legacy (EIP-155), `0x01` (EIP-2930) and `0x02` (EIP-1559) each put `to` and `chainId` in different RLP slots. All three are handled; see [`contracts/SignatureVerify.sol`](contracts/SignatureVerify.sol).

## Why prove it on-chain?

- **The relayer is untrusted.** Anyone can call `report`. Without a valid signature over the reported transaction, nothing happens — so a malicious watcher cannot fabricate a ban for an address it dislikes.
- **No cross-chain replay.** The chain id is decoded from the transaction and checked against `block.chainid`. A mainnet transaction can't be replayed against a testnet oracle to ban its signer, and pre-EIP-155 transactions — which carry no chain id at all — are rejected outright.
- **Bans are reversible and auditable.** Every state change emits an event, and the owner can lift either side of a ban.

## Owner controls

```solidity
addBlacklistedContract(address)     // start watching a contract
removeBlacklistedContract(address)  // stop watching it
unblacklistUser(address)            // lift a ban that should not have happened
```

Events: `ContractBlacklisted`, `ContractUnblacklisted`, `UserBlacklisted`, `UserUnblacklisted`.

## Getting started

Requires Node.js 20+ and Yarn 1 (classic).

```bash
yarn install
yarn test
```

Tests and coverage run without any configuration — local networks fall back to Hardhat's test mnemonic.

For anything touching a real network, copy `.env.example` to `.env` and fill it in. At minimum you need `ALCHEMY_KEY` or `INFURA_KEY` (Alchemy wins if both are set) plus `MNEMONIC_DEV`. Nothing is hardcoded; see [`.env.example`](.env.example) for the full list.

Supported networks: `main`, `sepolia`, `hardhat`, `local`.

## Running

Deploy, blacklisting every contract in `FORBIDDEN_ADDRESSES`:

```bash
npx hardhat run --network sepolia scripts/deploy.ts
```

Put the printed address into `.env` as `SIGNATURE_VERIFY_ADDRESS`, then start the watcher:

```bash
npx hardhat run --network sepolia scripts/TransactionTracking.ts
```

Check whether an address got blacklisted:

```bash
CHECK_ADDRESS=0x... npx hardhat run --network sepolia scripts/checkIsBanned.ts
```

Verify on Etherscan, with `ETHERSCAN_API_KEY` set:

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

Other scripts: `yarn build` (clean + compile), `yarn coverage`, `yarn codestyle` (solhint + ESLint + Prettier, zero-warning policy), `yarn codestyle:fix`.

## Project structure

```
├── config/       # networks, RPC urls, env vars
├── contracts/    # SignatureVerify + vendored utils (RLPReader, ECDSA, Ownable)
├── scripts/      # deploy, the block watcher, ban lookup
├── tasks/        # Hardhat tasks
├── test/         # contract tests
└── utils/        # shared TS helpers (transaction re-serialization)
```

## Design notes

- `report` proves that an address **signed** a transaction to a blacklisted contract, not that the transaction was **mined**. A transaction that was signed and never broadcast is still reportable. Since a signature is required, that only lets an address get itself banned — but "the oracle says so" is not the same as "the chain saw it".
- A ban is global by design: `isGranted` ignores `_where`, `_permissionId` and `_data`. Per-permission granularity would need a different data model.
- Ownership is a single EOA; pointing it at the DAO itself hands control to governance.

## License

[MIT](LICENSE) © RedDuck Limited

import 'dotenv/config';
import { HardhatNetworkUserConfig, NetworkUserConfig } from 'hardhat/types';

import { gwei } from './constants';
import { ConfigPerNetwork, Network, RpcUrl, WsRpcUrl } from './types';

import { getEnvVars } from '../envVars';

const { ALCHEMY_KEY, INFURA_KEY, MNEMONIC_DEV, MNEMONIC_PROD, LOCAL_RPC_PORT } =
  getEnvVars();

export const rpcUrls: ConfigPerNetwork<RpcUrl> = {
  main: ALCHEMY_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  sepolia: ALCHEMY_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://sepolia.infura.io/v3/${INFURA_KEY}`,
  hardhat: `http://localhost:${LOCAL_RPC_PORT}`,
  local: `http://localhost:${LOCAL_RPC_PORT}`,
};

export const wsRpcUrls: ConfigPerNetwork<WsRpcUrl> = {
  main: ALCHEMY_KEY
    ? `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `wss://mainnet.infura.io/ws/v3/${INFURA_KEY}`,
  sepolia: ALCHEMY_KEY
    ? `wss://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `wss://sepolia.infura.io/ws/v3/${INFURA_KEY}`,
  hardhat: `ws://localhost:${LOCAL_RPC_PORT}`,
  local: `ws://localhost:${LOCAL_RPC_PORT}`,
};

export const gasPrices: ConfigPerNetwork<number> = {
  main: 1 * gwei,
  sepolia: 10 * gwei,
  hardhat: 1 * gwei,
  local: 70 * gwei,
};

export const chainIds: ConfigPerNetwork<number> = {
  main: 1,
  sepolia: 11155111,
  hardhat: 31337,
  local: 31337,
};

/**
 * Hardhat's well-known test mnemonic. Local networks fall back to it so that
 * `yarn test` works without a .env; real networks deliberately do not, an
 * unset mnemonic there should fail loudly.
 */
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';

export const mnemonics: ConfigPerNetwork<string> = {
  main: MNEMONIC_PROD,
  sepolia: MNEMONIC_DEV,
  hardhat: MNEMONIC_DEV || TEST_MNEMONIC,
  local: MNEMONIC_DEV || TEST_MNEMONIC,
};

export const gases: ConfigPerNetwork<number | undefined> = {
  main: undefined,
  sepolia: 1_250_000,
  hardhat: undefined,
  local: 1_250_000,
};

export const timeouts: ConfigPerNetwork<number | undefined> = {
  main: undefined,
  sepolia: 999999,
  hardhat: undefined,
  local: 999999,
};

export const blockGasLimits: ConfigPerNetwork<number | undefined> = {
  main: 300 * 10 ** 6,
  sepolia: undefined,
  hardhat: 300 * 10 ** 6,
  local: undefined,
};

export const initialBasesFeePerGas: ConfigPerNetwork<number | undefined> = {
  main: undefined,
  sepolia: undefined,
  hardhat: 0,
  local: undefined,
};

/**
 * Remote networks are useless without a provider key, and an unset key silently
 * produces a `.../v3/undefined` URL that fails much later with a cryptic error.
 */
export const getRpcUrl = (network: Network): RpcUrl => {
  assertProviderKey(network);
  return rpcUrls[network];
};

export const getWsRpcUrl = (network: Network): WsRpcUrl => {
  assertProviderKey(network);
  return wsRpcUrls[network];
};

const assertProviderKey = (network: Network) => {
  if (network === 'hardhat' || network === 'local') return;
  if (!ALCHEMY_KEY && !INFURA_KEY) {
    throw new Error(
      `Network "${network}" needs a provider key: set ALCHEMY_KEY or INFURA_KEY in .env`,
    );
  }
};

export const getBaseNetworkConfig = (network: Network): NetworkUserConfig => ({
  accounts: {
    mnemonic: mnemonics[network],
  },
  chainId: chainIds[network],
  gas: gases[network],
  gasPrice: gasPrices[network],
  blockGasLimit: blockGasLimits[network],
  timeout: timeouts[network],
  initialBaseFeePerGas: initialBasesFeePerGas[network],
});

export const getNetworkConfig = (network: Network): NetworkUserConfig => ({
  ...getBaseNetworkConfig(network),
  url: rpcUrls[network],
});

export const getForkNetworkConfig = (
  network: Network,
): HardhatNetworkUserConfig => ({
  ...getBaseNetworkConfig(network),
  accounts: {
    mnemonic: mnemonics[network],
  },
  forking: {
    url: getRpcUrl(network),
  },
});

export const getHardhatNetworkConfig = (): HardhatNetworkUserConfig => ({
  ...getBaseNetworkConfig('hardhat'),
  accounts: {
    mnemonic: mnemonics.hardhat,
  },
});

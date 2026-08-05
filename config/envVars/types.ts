import { Network } from '../networks';

export type EnvVars = {
  readonly ALCHEMY_KEY?: string;
  readonly INFURA_KEY?: string;
  readonly ETHERSCAN_API_KEY?: string;
  readonly OPTIMIZER: boolean;
  readonly COVERAGE: boolean;
  readonly REPORT_GAS: boolean;
  readonly MNEMONIC_DEV: string;
  readonly MNEMONIC_PROD: string;
  readonly FORKING_NETWORK?: Network;
  /** Address of the deployed `SignatureVerify` contract, per deployment. */
  readonly SIGNATURE_VERIFY_ADDRESS?: string;
  /** Contracts whose callers get blacklisted, comma-separated. */
  readonly FORBIDDEN_ADDRESSES: readonly string[];
  /** Port of the `local` network node, for running next to another node. */
  readonly LOCAL_RPC_PORT: number;
};

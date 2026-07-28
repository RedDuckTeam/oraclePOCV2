import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-verify';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import {
  getEnvVars,
  getForkNetworkConfig,
  getHardhatNetworkConfig,
  getNetworkConfig,
} from './config';
import './tasks';

dotenv.config();

const { OPTIMIZER, REPORT_GAS, FORKING_NETWORK, COVERAGE, ETHERSCAN_API_KEY } =
  getEnvVars();

if (COVERAGE) {
  require('solidity-coverage');
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.10',
        settings: {
          optimizer: {
            enabled: OPTIMIZER,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    main: getNetworkConfig('main'),
    sepolia: getNetworkConfig('sepolia'),
    hardhat: FORKING_NETWORK
      ? getForkNetworkConfig(FORKING_NETWORK)
      : getHardhatNetworkConfig(),
    local: getNetworkConfig('local'),
  },
  gasReporter: {
    enabled: REPORT_GAS,
  },
  contractSizer: {
    runOnCompile: OPTIMIZER,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;

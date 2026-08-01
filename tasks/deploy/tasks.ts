import { task, types } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';

import { logDeployment, preAction } from './funcs';
import { TASK_DEPLOY_GREETER } from './task-names';
import { TaskDeployGreeterParams } from './types';

task(TASK_DEPLOY_GREETER)
  .addParam('greeting', 'contract greeting', 'Hi there!', types.string)
  .setAction(async (params: TaskDeployGreeterParams, hre) => {
    await preAction(hre);
    const [deployer] = await hre.ethers.getSigners();

    const factory = await hre.ethers.getContractFactory('Greeter', deployer);
    const greeter = await factory.deploy(params.greeting);
    await greeter.waitForDeployment();

    logDeployment(
      'Greeter',
      ['Greeting', params.greeting],
      ['Address', await greeter.getAddress()],
      ['Deployer', deployer.address],
    );
  });

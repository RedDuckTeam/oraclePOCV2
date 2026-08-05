export type NetworkBase = 'sepolia';

export type Network = NetworkBase | 'main' | 'hardhat' | 'local';

export type RpcNetwork = NetworkBase | 'mainnet';

export type RpcUrl =
  | `https://eth-${RpcNetwork}.g.alchemy.com/v2/${string}`
  | `https://${RpcNetwork}.infura.io/v3/${string}`
  | `http://localhost:${number}`;

export type WsRpcUrl =
  | `wss://eth-${RpcNetwork}.g.alchemy.com/v2/${string}`
  | `wss://${RpcNetwork}.infura.io/ws/v3/${string}`
  | `ws://localhost:${number}`;

export type ConfigPerNetwork<T> = Record<Network, T>;

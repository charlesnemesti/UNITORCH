import { defineChain } from 'viem';
import { mainnet, sepolia, base, baseSepolia } from 'viem/chains';

const DEFAULT_RPC = 'https://ethereum.publicnode.com';

const CHAIN_BY_ID = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};

const envChainId = Number(import.meta.env.VITE_CHAIN_ID ?? mainnet.id);
const configuredRpc = import.meta.env.VITE_RPC_URL ?? DEFAULT_RPC;

function withReliableRpc(chain) {
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { http: [configuredRpc] },
      public: { http: [configuredRpc] },
    },
  };
}

/** @type {import('viem').Chain} */
export const targetChain = CHAIN_BY_ID[envChainId]
  ? withReliableRpc(CHAIN_BY_ID[envChainId])
  : defineChain({
      id: envChainId,
      name: `Chain ${envChainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [configuredRpc] },
        public: { http: [configuredRpc] },
      },
    });

export const chainId = targetChain.id;

export const rpcUrl = configuredRpc;

export const publicRpcUrls = [
  configuredRpc,
  DEFAULT_RPC,
  'https://rpc.ankr.com/eth',
  'https://1rpc.io/eth',
].filter((url, index, list) => list.indexOf(url) === index);

export const explorerUrl = import.meta.env.VITE_EXPLORER_URL ?? 'https://etherscan.io';

import { isAddress, zeroAddress } from 'viem';
import { IS_CA_LIVE, UNITORCH_CA } from './deployed.js';

const zero = zeroAddress;

function parseAddress(value, fallback = zero) {
  if (!value || !isAddress(value) || value === zero) return fallback;
  return value;
}

/** Canonical mainnet token — always from deployed.js, never env overrides. */
const unitorch = IS_CA_LIVE ? parseAddress(UNITORCH_CA, zero) : zero;

export const CONTRACTS = {
  unitorch,
  uniswapPool: parseAddress(import.meta.env.VITE_UNISWAP_POOL),
  torchNft: parseAddress(import.meta.env.VITE_TORCH_NFT),
  rewardDistributor: parseAddress(import.meta.env.VITE_REWARD_DISTRIBUTOR),
};

/** True when the core token contract is configured. */
export function contractsConfigured() {
  return CONTRACTS.unitorch !== zero;
}

export function isDeployed(address) {
  return Boolean(address && isAddress(address) && address !== zero);
}

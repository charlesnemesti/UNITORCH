import { isAddress, zeroAddress } from 'viem';
import { IS_CA_LIVE, UNITORCH_CA } from './deployed.js';

const zero = zeroAddress;

function parseAddress(value, fallback = zero) {
  if (!value || !isAddress(value) || value === zero) return fallback;
  return value;
}

const legacyEnv = import.meta.env.VITE_UNIHASH;
const configured = parseAddress(import.meta.env.VITE_UNITORCH ?? legacyEnv ?? UNITORCH_CA, zero);
const unitorch = IS_CA_LIVE ? configured : zero;

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

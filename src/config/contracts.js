import { isAddress, zeroAddress } from 'viem';
import { UNIHASH_CA } from './deployed.js';

const zero = zeroAddress;

function parseAddress(value, fallback = zero) {
  if (!value || !isAddress(value) || value === zero) return fallback;
  return value;
}

const unihash = parseAddress(import.meta.env.VITE_UNIHASH, UNIHASH_CA);

function resolveContract(specific) {
  const specificAddr = parseAddress(specific);
  if (specificAddr !== zero) return specificAddr;
  return unihash;
}

export const CONTRACTS = {
  unihash,
  hashToken: resolveContract(import.meta.env.VITE_HASH_TOKEN),
  hashRegistry: resolveContract(import.meta.env.VITE_HASH_REGISTRY),
  rewardDistributor: resolveContract(import.meta.env.VITE_REWARD_DISTRIBUTOR),
  uniswapPool: parseAddress(import.meta.env.VITE_UNISWAP_POOL),
};

export const DISTRIBUTOR_CLAIM_READ_FN =
  import.meta.env.VITE_DISTRIBUTOR_CLAIM_READ_FN ?? 'withdrawableDividend';

/** True when at least the core token contract is configured. */
export function contractsConfigured() {
  return CONTRACTS.unihash !== zero || CONTRACTS.hashToken !== zero;
}

export function isDeployed(address) {
  return Boolean(address && isAddress(address) && address !== zero);
}

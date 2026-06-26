import { formatUnits } from 'viem';
import { unitorchAbi } from '../abis/unitorch.js';
import { CONTRACTS, contractsConfigured, isDeployed } from '../config/contracts.js';
import { liveDataEnabled } from '../config/launch.js';
import { getPublicClient } from './provider.js';
import { readTokenMetadata } from './protocol.js';

const DEFAULT_DECIMALS = 18;

/**
 * @typedef {Object} WalletBalances
 * @property {number} tokenBalance
 * @property {number} supplySharePercent
 * @property {boolean} contractsReady
 */

/**
 * @param {`0x${string}`} address
 * @returns {Promise<WalletBalances>}
 */
export async function readWalletBalances(address) {
  const empty = {
    tokenBalance: 0,
    supplySharePercent: 0,
    contractsReady: contractsConfigured() && liveDataEnabled,
  };

  if (!liveDataEnabled || !contractsConfigured() || !isDeployed(CONTRACTS.unitorch)) {
    return empty;
  }

  const client = getPublicClient();
  const [balance, decimals, meta] = await Promise.all([
    client.readContract({
      address: CONTRACTS.unitorch,
      abi: unitorchAbi,
      functionName: 'balanceOf',
      args: [address],
    }),
    client.readContract({
      address: CONTRACTS.unitorch,
      abi: unitorchAbi,
      functionName: 'decimals',
    }).catch(() => DEFAULT_DECIMALS),
    readTokenMetadata(),
  ]);

  const tokenBalance = Number.parseFloat(formatUnits(balance, Number(decimals)));
  const circulating = meta?.totalSupply ?? 0;
  const supplySharePercent =
    circulating > 0 ? (tokenBalance / circulating) * 100 : 0;

  return {
    tokenBalance,
    supplySharePercent,
    contractsReady: true,
  };
}

import { formatEther, formatUnits } from 'viem';
import { unihashAbi } from '../abis/unihash.js';
import {
  CONTRACTS,
  DISTRIBUTOR_CLAIM_READ_FN,
  contractsConfigured,
  isDeployed,
} from '../config/contracts.js';
import { liveDataEnabled } from '../config/launch.js';
import { getPublicClient } from './provider.js';

const DEFAULT_DECIMALS = 18;

/**
 * @typedef {Object} WalletBalances
 * @property {number} hashBalance
 * @property {number} hashesOwned
 * @property {number} claimableEth
 * @property {boolean} contractsReady
 */

/**
 * @param {`0x${string}`} address
 * @returns {Promise<WalletBalances>}
 */
export async function readWalletBalances(address) {
  const empty = {
    hashBalance: 0,
    hashesOwned: 0,
    claimableEth: 0,
    contractsReady: contractsConfigured() && liveDataEnabled,
  };

  if (!liveDataEnabled) return empty;

  if (!contractsConfigured()) return empty;

  const client = getPublicClient();
  let decimals = DEFAULT_DECIMALS;
  let hashBalanceRaw = 0n;
  let hashesOwned = 0;
  let claimableEth = 0;

  if (isDeployed(CONTRACTS.hashToken)) {
    const [balance, tokenDecimals] = await Promise.all([
      client.readContract({
        address: CONTRACTS.hashToken,
        abi: unihashAbi,
        functionName: 'balanceOf',
        args: [address],
      }),
      client.readContract({
        address: CONTRACTS.hashToken,
        abi: unihashAbi,
        functionName: 'decimals',
      }).catch(() => DEFAULT_DECIMALS),
    ]);

    decimals = Number(tokenDecimals);
    hashBalanceRaw = balance;
  }

  const hashBalance = Number.parseFloat(formatUnits(hashBalanceRaw, decimals));

  if (isDeployed(CONTRACTS.hashRegistry)) {
    const ownedIds = await client.readContract({
      address: CONTRACTS.hashRegistry,
      abi: unihashAbi,
      functionName: 'ownedIds',
      args: [address],
    });
    hashesOwned = ownedIds.length;
  } else {
    hashesOwned = Math.floor(hashBalance);
  }

  if (isDeployed(CONTRACTS.rewardDistributor)) {
    const claimableRaw = await readClaimable(client, address);
    claimableEth = Number.parseFloat(formatEther(claimableRaw));
  }

  return {
    hashBalance,
    hashesOwned,
    claimableEth,
    contractsReady: true,
  };
}

/**
 * @param {import('viem').PublicClient} client
 * @param {`0x${string}`} address
 */
async function readClaimable(client, address) {
  const fn = DISTRIBUTOR_CLAIM_READ_FN;

  try {
    return await client.readContract({
      address: CONTRACTS.rewardDistributor,
      abi: unihashAbi,
      functionName: fn,
      args: [address],
    });
  } catch (error) {
    const fallbacks = ['withdrawableDividend', 'claimable', 'pendingReward', 'earned'].filter(
      (name) => name !== fn,
    );

    for (const name of fallbacks) {
      try {
        return await client.readContract({
          address: CONTRACTS.rewardDistributor,
          abi: unihashAbi,
          functionName: name,
          args: [address],
        });
      } catch {
        // try next
      }
    }

    console.warn('[UniHash] Could not read claimable rewards:', error);
    return 0n;
  }
}

/**
 * @param {`0x${string}`} address
 * @returns {Promise<bigint[]>}
 */
export async function readOwnedTokenIds(address) {
  if (!isDeployed(CONTRACTS.hashRegistry)) return [];

  const client = getPublicClient();
  return client.readContract({
    address: CONTRACTS.hashRegistry,
    abi: unihashAbi,
    functionName: 'ownedIds',
    args: [address],
  });
}

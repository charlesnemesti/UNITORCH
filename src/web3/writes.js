import { unihashAbi } from '../abis/unihash.js';
import { CONTRACTS, isDeployed } from '../config/contracts.js';
import { getPublicClient, getWalletClient } from './provider.js';

/**
 * @param {`0x${string}`} address
 * @returns {Promise<`0x${string}`>}
 */
export async function claimRewards(address) {
  if (!isDeployed(CONTRACTS.rewardDistributor)) {
    throw new Error('Reward contract not configured. Set VITE_UNIHASH in .env');
  }

  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet provider detected');

  const publicClient = getPublicClient();

  let hash;

  try {
    hash = await walletClient.writeContract({
      account: address,
      address: CONTRACTS.rewardDistributor,
      abi: unihashAbi,
      functionName: 'claimDividend',
      args: [],
    });
  } catch {
    hash = await walletClient.writeContract({
      account: address,
      address: CONTRACTS.rewardDistributor,
      abi: unihashAbi,
      functionName: 'claim',
      args: [],
    });
  }

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

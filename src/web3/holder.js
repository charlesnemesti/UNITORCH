import { formatUnits } from 'viem';
import { hashRegistryAbi } from '../abis/hashRegistry.js';
import { rewardDistributorAbi } from '../abis/rewardDistributor.js';
import { HOLDER_THRESHOLD } from '../config/holder.js';
import { CONTRACTS, contractsConfigured, isDeployed } from '../config/contracts.js';
import { liveDataEnabled } from '../config/launch.js';
import { getPublicClient } from './provider.js';
import { readWalletBalances } from './reads.js';

/**
 * @typedef {import('./reads.js').WalletBalances & {
 *   holdThreshold: number,
 *   holdProgress: number,
 *   holdEligible: boolean,
 *   holdRemaining: number,
 *   nftCount: number,
 *   torchTokenId: number | null,
 *   claimableEth: number,
 *   canClaimNft: boolean,
 *   canClaimFees: boolean,
 *   nftDeployed: boolean,
 *   distributorDeployed: boolean,
 * }} HolderStatus
 */

/**
 * @param {`0x${string}`} address
 * @returns {Promise<HolderStatus>}
 */
export async function readHolderStatus(address) {
  const wallet = await readWalletBalances(address);
  const holdThreshold = HOLDER_THRESHOLD;
  const holdProgress = Math.min(1, wallet.tokenBalance / holdThreshold);
  const holdEligible = wallet.tokenBalance >= holdThreshold;
  const holdRemaining = Math.max(0, holdThreshold - wallet.tokenBalance);

  let nftCount = 0;
  let torchTokenId = null;
  let claimableWei = 0n;
  const nftDeployed = isDeployed(CONTRACTS.torchNft);
  const distributorDeployed = isDeployed(CONTRACTS.rewardDistributor);

  if (liveDataEnabled && contractsConfigured()) {
    const client = getPublicClient();

    if (nftDeployed) {
      nftCount = Number(
        await client.readContract({
          address: CONTRACTS.torchNft,
          abi: hashRegistryAbi,
          functionName: 'balanceOf',
          args: [address],
        }),
      );

      if (nftCount > 0) {
        const id = await client.readContract({
          address: CONTRACTS.torchNft,
          abi: hashRegistryAbi,
          functionName: 'tokenOfOwnerByIndex',
          args: [address, 0n],
        });
        torchTokenId = Number(id);
      }
    }

    if (distributorDeployed) {
      claimableWei = await client.readContract({
        address: CONTRACTS.rewardDistributor,
        abi: rewardDistributorAbi,
        functionName: 'claimable',
        args: [address],
      }).catch(() =>
        client.readContract({
          address: CONTRACTS.rewardDistributor,
          abi: rewardDistributorAbi,
          functionName: 'earned',
          args: [address],
        }),
      );
    }
  }

  const claimableEth = Number.parseFloat(formatUnits(claimableWei, 18));

  return {
    ...wallet,
    holdThreshold,
    holdProgress,
    holdEligible,
    holdRemaining,
    nftCount,
    torchTokenId,
    claimableEth,
    canClaimNft: holdEligible && nftCount === 0 && nftDeployed,
    canClaimFees: distributorDeployed && claimableWei > 0n,
    nftDeployed,
    distributorDeployed,
  };
}

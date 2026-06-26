import { hashRegistryAbi } from '../abis/hashRegistry.js';
import { rewardDistributorAbi } from '../abis/rewardDistributor.js';
import { CONTRACTS, isDeployed } from '../config/contracts.js';
import { getWalletClient } from './provider.js';
import { getConnectedAddress } from './wallet.js';

function requireWallet() {
  const address = getConnectedAddress();
  if (!address) throw new Error('Connect your wallet first.');
  return address;
}

/** Mint a Torch NFT when balance ≥ 200 UNITORCH (on-chain registry). */
export async function claimTorchNft() {
  requireWallet();

  if (!isDeployed(CONTRACTS.torchNft)) {
    throw new Error('Torch NFT registry is not wired yet. Set VITE_TORCH_NFT in .env when deployed.');
  }

  const walletClient = getWalletClient();

  return walletClient.writeContract({
    address: CONTRACTS.torchNft,
    abi: hashRegistryAbi,
    functionName: 'claim',
    args: [],
  });
}

/** Pull accrued Uniswap v4 hook fees from the reward distributor. */
export async function claimHookFees() {
  requireWallet();

  if (!isDeployed(CONTRACTS.rewardDistributor)) {
    throw new Error('Fee distributor is not wired yet. Set VITE_REWARD_DISTRIBUTOR in .env when deployed.');
  }

  const walletClient = getWalletClient();

  return walletClient.writeContract({
    address: CONTRACTS.rewardDistributor,
    abi: rewardDistributorAbi,
    functionName: 'claim',
    args: [],
  });
}

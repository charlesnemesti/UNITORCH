import { createPublicClient, createWalletClient, custom, fallback, http } from 'viem';
import { chainId, publicRpcUrls, targetChain } from '../config/chain.js';

/** @type {import('viem').PublicClient | null} */
let publicClient = null;

/** @type {import('viem').WalletClient | null} */
let walletClient = null;

/** @type {import('viem').EIP1193Provider | null} */
let activeProvider = null;

/** @type {((provider: import('viem').EIP1193Provider | null) => void) | null} */
let onProviderChange = null;

export function onActiveProviderChange(callback) {
  onProviderChange = callback;
}

export function getActiveProvider() {
  return activeProvider ?? (typeof window !== 'undefined' ? window.ethereum ?? null : null);
}

/**
 * @param {import('viem').EIP1193Provider | null} provider
 */
export function setActiveProvider(provider) {
  activeProvider = provider;
  walletClient = null;
  onProviderChange?.(provider);
}

export function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: targetChain,
      transport: fallback(
        publicRpcUrls.map((url) =>
          http(url, {
            timeout: 12_000,
            retryCount: 1,
          }),
        ),
      ),
    });
  }
  return publicClient;
}

/**
 * @returns {import('viem').WalletClient | null}
 */
export function getWalletClient() {
  const provider = getActiveProvider();
  if (!provider) return null;

  if (!walletClient) {
    walletClient = createWalletClient({
      chain: targetChain,
      transport: custom(provider),
    });
  }

  return walletClient;
}

export function hasWalletProvider() {
  return typeof window !== 'undefined' && Boolean(getActiveProvider());
}

export { chainId };

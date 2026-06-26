import { chainId, rpcUrl, targetChain } from '../config/chain.js';
import { contractsConfigured } from '../config/contracts.js';
import {
  getActiveProvider,
  getWalletClient,
  hasWalletProvider,
  onActiveProviderChange,
  setActiveProvider,
} from './provider.js';
import { readWalletBalances } from './reads.js';
import {
  getProviderByRdns,
  getRememberedWalletRdns,
  rememberWalletChoice,
  clearRememberedWallet,
  startWalletDiscovery,
} from './wallets.js';
import { claimRewards as claimOnChain } from './writes.js';

/** @type {`0x${string}` | null} */
let connectedAddress = null;

/** @type {((address: `0x${string}` | null) => void) | null} */
let onAccountsChanged = null;

/** @type {import('viem').EIP1193Provider | null} */
let listeningProvider = null;

/** @param {import('viem').EIP1193Provider} provider */
function handleAccountsChanged(accounts) {
  const next = accounts[0] ?? null;
  connectedAddress = next;
  onAccountsChanged?.(next);
}

/** @param {import('viem').EIP1193Provider | null} provider */
function bindProviderListeners(provider) {
  if (!provider || provider === listeningProvider) return;

  if (listeningProvider?.removeListener) {
    listeningProvider.removeListener('accountsChanged', handleAccountsChanged);
    listeningProvider.removeListener('chainChanged', reloadOnChainChange);
  }

  listeningProvider = provider;
  provider.on?.('accountsChanged', handleAccountsChanged);
  provider.on?.('chainChanged', reloadOnChainChange);
}

function reloadOnChainChange() {
  window.location.reload();
}

onActiveProviderChange(bindProviderListeners);

/**
 * @param {import('viem').EIP1193Provider} [provider]
 * @param {string} [rdns]
 * @returns {Promise<{ address: `0x${string}`, balances: import('./reads.js').WalletBalances }>}
 */
export async function connect(provider, rdns) {
  if (provider) {
    setActiveProvider(provider);
    if (rdns) rememberWalletChoice(rdns);
  }

  if (!hasWalletProvider()) {
    throw new Error('No wallet detected. Install MetaMask or another Web3 wallet.');
  }

  await ensureCorrectChain();

  const walletClient = getWalletClient();
  const [address] = await walletClient.requestAddresses();

  if (!address) throw new Error('No account returned from wallet');

  connectedAddress = address;
  bindProviderListeners(getActiveProvider());

  const balances = await readWalletBalances(address);
  return { address, balances };
}

/**
 * @returns {Promise<{ address: `0x${string}`, balances: import('./reads.js').WalletBalances } | null>}
 */
export async function tryAutoConnect() {
  startWalletDiscovery();

  const remembered = getRememberedWalletRdns();
  if (remembered) {
    const provider = getProviderByRdns(remembered);
    if (provider) setActiveProvider(provider);
  }

  if (!hasWalletProvider()) return null;

  try {
    const walletClient = getWalletClient();
    const [address] = await walletClient.getAddresses();

    if (!address) return null;

    const walletChainId = await walletClient.getChainId();
    if (walletChainId !== chainId) return null;

    connectedAddress = address;
    bindProviderListeners(getActiveProvider());

    const balances = await readWalletBalances(address);
    return { address, balances };
  } catch {
    return null;
  }
}

export function disconnect() {
  connectedAddress = null;
  clearRememberedWallet();
  setActiveProvider(null);

  if (listeningProvider?.removeListener) {
    listeningProvider.removeListener('accountsChanged', handleAccountsChanged);
    listeningProvider.removeListener('chainChanged', reloadOnChainChange);
  }

  listeningProvider = null;
}

/**
 * @param {`0x${string}`} address
 */
export async function refresh(address = connectedAddress) {
  if (!address) {
    return {
      hashBalance: 0,
      hashesOwned: 0,
      claimableEth: 0,
      contractsReady: contractsConfigured(),
    };
  }

  return readWalletBalances(address);
}

/**
 * @param {`0x${string}`} address
 */
export async function claim(address = connectedAddress) {
  if (!address) throw new Error('Wallet not connected');
  return claimOnChain(address);
}

async function ensureCorrectChain() {
  const provider = getActiveProvider();
  const walletClient = getWalletClient();
  const currentChainId = await walletClient.getChainId();

  if (currentChainId === chainId) return;

  if (!provider) throw new Error('No wallet provider');

  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexChainId,
            chainName: targetChain.name,
            nativeCurrency: targetChain.nativeCurrency,
            rpcUrls: [rpcUrl],
            blockExplorerUrls: targetChain.blockExplorers
              ? [targetChain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
      return;
    }

    throw new Error(`Wrong network. Switch to ${targetChain.name} (chain ${chainId}).`);
  }
}

/**
 * @param {(address: `0x${string}` | null) => void | Promise<void>} onChange
 */
export function initWalletListeners(onChange) {
  onAccountsChanged = onChange;
  bindProviderListeners(getActiveProvider());
}

export function getConnectedAddress() {
  return connectedAddress;
}

export function isConnected() {
  return connectedAddress !== null;
}

export { contractsConfigured };

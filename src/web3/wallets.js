/** @typedef {{ uuid: string, name: string, icon: string, rdns: string }} EIP6963Info */
/** @typedef {{ info: EIP6963Info, provider: import('viem').EIP1193Provider }} EIP6963Detail */

export const WALLET_STORAGE_KEY = 'unihash_wallet_rdns';

/** Popular wallets shown in the connect modal (order matters). */
export const POPULAR_WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    rdns: 'io.metamask',
    installUrl: 'https://metamask.io/download/',
    accent: '#E8831D',
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    rdns: 'com.coinbase.wallet',
    installUrl: 'https://www.coinbase.com/wallet/downloads',
    accent: '#0052FF',
  },
  {
    id: 'rabby',
    name: 'Rabby',
    rdns: 'io.rabby',
    installUrl: 'https://rabby.io/',
    accent: '#8697FF',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    rdns: 'me.rainbow',
    installUrl: 'https://rainbow.me/download',
    accent: '#001E59',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    rdns: 'com.trustwallet.app',
    installUrl: 'https://trustwallet.com/download',
    accent: '#3375BB',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    rdns: 'app.phantom',
    installUrl: 'https://phantom.app/download',
    accent: '#AB9FF2',
  },
];

/** @type {Map<string, EIP6963Detail>} */
const providersByRdns = new Map();

/** @type {Map<string, EIP6963Detail>} */
const providersByUuid = new Map();

let discoveryStarted = false;

function onAnnounceProvider(event) {
  const detail = event.detail;
  if (!detail?.info?.rdns || !detail?.provider) return;

  providersByRdns.set(detail.info.rdns, detail);
  providersByUuid.set(detail.info.uuid, detail);
}

export function startWalletDiscovery() {
  if (typeof window === 'undefined' || discoveryStarted) return;
  discoveryStarted = true;

  window.addEventListener('eip6963:announceProvider', onAnnounceProvider);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/**
 * Wait briefly for EIP-6963 announcements, then return popular wallet options.
 * @returns {Promise<Array<{
 *   id: string,
 *   name: string,
 *   rdns: string,
 *   installUrl: string,
 *   accent: string,
 *   icon: string | null,
 *   installed: boolean,
 *   provider: import('viem').EIP1193Provider | null,
 * }>>}
 */
export async function getWalletOptions() {
  startWalletDiscovery();

  await new Promise((resolve) => setTimeout(resolve, 120));

  const hasGenericInjected = Boolean(window.ethereum);

  return POPULAR_WALLETS.map((wallet) => {
    const discovered = providersByRdns.get(wallet.rdns);
    let provider = discovered?.provider ?? null;

    // Legacy fallbacks when EIP-6963 is not available
    if (!provider && wallet.id === 'metamask' && window.ethereum?.isMetaMask) {
      provider = window.ethereum;
    }
    if (!provider && wallet.id === 'coinbase' && window.ethereum?.isCoinbaseWallet) {
      provider = window.ethereum;
    }

    return {
      ...wallet,
      icon: discovered?.info?.icon ?? null,
      installed: Boolean(provider),
      provider,
    };
  }).concat(
    hasGenericInjected && !providersByRdns.size
      ? [
          {
            id: 'injected',
            name: 'Browser wallet',
            rdns: 'injected',
            installUrl: '',
            accent: '#DFFF00',
            icon: null,
            installed: true,
            provider: window.ethereum,
          },
        ]
      : [],
  );
}

/**
 * @param {string} rdns
 * @returns {import('viem').EIP1193Provider | null}
 */
export function getProviderByRdns(rdns) {
  startWalletDiscovery();

  const discovered = providersByRdns.get(rdns);
  if (discovered?.provider) return discovered.provider;

  if (rdns === 'injected' && window.ethereum) return window.ethereum;

  const wallet = POPULAR_WALLETS.find((item) => item.rdns === rdns);
  if (!wallet) return null;

  if (wallet.id === 'metamask' && window.ethereum?.isMetaMask) return window.ethereum;
  if (wallet.id === 'coinbase' && window.ethereum?.isCoinbaseWallet) return window.ethereum;

  return null;
}

export function rememberWalletChoice(rdns) {
  if (rdns) localStorage.setItem(WALLET_STORAGE_KEY, rdns);
}

export function clearRememberedWallet() {
  localStorage.removeItem(WALLET_STORAGE_KEY);
}

export function getRememberedWalletRdns() {
  return localStorage.getItem(WALLET_STORAGE_KEY);
}

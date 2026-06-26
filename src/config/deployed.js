/** Social */
export const UNITORCH_TWITTER_URL = 'https://x.com/Unitorch_v4';

/** Shown in the CA strip until VITE_CA_LIVE=true and VITE_UNITORCH is set. */
export const UNITORCH_CA_DISPLAY = 'TBA';
export const UNITORCH_HOOK_CA_DISPLAY = 'TBA';

/** Gate on-chain reads + live CA — keep false until mainnet launch. */
export const IS_CA_LIVE = import.meta.env.VITE_CA_LIVE === 'true';

/** Genesis supply minted at deploy — read live via INITIAL_SUPPLY when possible. */
export const UNITORCH_INITIAL_SUPPLY = 137_000;

export const UNISWAP_BUY_URL =
  'https://app.uniswap.org/swap?chain=mainnet&inputCurrency=ETH';

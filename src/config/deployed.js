/** Social */
export const UNITORCH_TWITTER_URL = 'https://x.com/Unitorch_v4';

/** Ethereum mainnet UniTorch ERC-20 */
export const UNITORCH_CA = '0x8dd2Fb6dDD02C9AA09D6964AaA9f5956a90e58A3';

export const UNITORCH_CA_DISPLAY = UNITORCH_CA;

/** Hook address — populated from on-chain `hook()` when live data is enabled. */
export const UNITORCH_HOOK_CA_DISPLAY = 'TBA';

/** Gate on-chain reads + live CA strip. Set VITE_CA_LIVE=false to force placeholder mode. */
export const IS_CA_LIVE = import.meta.env.VITE_CA_LIVE !== 'false';

export const UNITORCH_EXPLORER_URL = `https://etherscan.io/address/${UNITORCH_CA}`;

/** Genesis supply minted at deploy — read live via INITIAL_SUPPLY when possible. */
export const UNITORCH_INITIAL_SUPPLY = 137_000;

export const UNISWAP_BUY_URL =
  `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=ETH&outputCurrency=${UNITORCH_CA}`;

/** Live mainnet deployment — used when VITE_UNITORCH is unset (e.g. Vercel). */
export const UNITORCH_CA = '0x82da588a1DcD34aaF726E8833364b21d37C2f70C';

/** Uniswap v4 burn hook wired via setHook on the token contract. */
export const UNITORCH_HOOK_CA = '0x47b73d15035267697001d318c8B7C1992AF7A0c4';

/** Genesis supply minted at deploy — read live via INITIAL_SUPPLY when possible. */
export const UNITORCH_INITIAL_SUPPLY = 137_000;

export const UNISWAP_BUY_URL =
  `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=ETH&outputCurrency=${UNITORCH_CA}`;

export const ETHERSCAN_TOKEN_URL = `https://etherscan.io/address/${UNITORCH_CA}`;

export const ETHERSCAN_HOOK_URL = `https://etherscan.io/address/${UNITORCH_HOOK_CA}`;

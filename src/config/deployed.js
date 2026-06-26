/** Live mainnet deployment — used when VITE_UNIHASH is unset (e.g. Vercel). */
export const UNIHASH_CA = '0x82da588a1DcD34aaF726E8833364b21d37C2f70C';

export const UNISWAP_BUY_URL =
  `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=ETH&outputCurrency=${UNIHASH_CA}`;

export const ETHERSCAN_TOKEN_URL = `https://etherscan.io/address/${UNIHASH_CA}`;

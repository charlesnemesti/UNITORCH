import { formatUnits } from 'viem';
import { unitorchAbi } from '../abis/unitorch.js';
import { generateHashSvg, GALLERY_HASH_COUNT, seedForPattern } from '../hash-svgs.js';
import { CONTRACTS, contractsConfigured, isDeployed } from '../config/contracts.js';
import { getPublicClient } from './provider.js';

const GALLERY_DISPLAY_CAP = 50;

function contractAddress() {
  return isDeployed(CONTRACTS.unitorch) ? CONTRACTS.unitorch : null;
}

/**
 * @typedef {Object} ProtocolStats
 * @property {number} tokensBurned
 * @property {number} circulatingSupply
 * @property {number} initialSupply
 * @property {number} burnPercent
 */

/**
 * @typedef {Object} TokenMetadata
 * @property {string} symbol
 * @property {string} name
 * @property {number} totalSupply
 * @property {number} initialSupply
 * @property {number} tokensBurned
 * @property {number} burnPercent
 * @property {`0x${string}` | null} hook
 */

/**
 * @returns {Promise<TokenMetadata | null>}
 */
export async function readTokenMetadata() {
  const address = contractAddress();
  if (!address) return null;

  const client = getPublicClient();
  const [symbol, name, totalSupply, decimals, initialSupply, hook] = await Promise.all([
    client.readContract({ address, abi: unitorchAbi, functionName: 'symbol' }),
    client.readContract({ address, abi: unitorchAbi, functionName: 'name' }),
    client.readContract({ address, abi: unitorchAbi, functionName: 'totalSupply' }),
    client.readContract({ address, abi: unitorchAbi, functionName: 'decimals' }),
    client.readContract({ address, abi: unitorchAbi, functionName: 'INITIAL_SUPPLY' }),
    client.readContract({ address, abi: unitorchAbi, functionName: 'hook' }),
  ]);

  const dec = Number(decimals);
  const total = Number.parseFloat(formatUnits(totalSupply, dec));
  const initial = Number.parseFloat(formatUnits(initialSupply, dec));
  const burned = Math.max(0, initial - total);
  const burnPercent = initial > 0 ? (burned / initial) * 100 : 0;

  return {
    symbol,
    name,
    totalSupply: total,
    initialSupply: initial,
    tokensBurned: burned,
    burnPercent,
    hook: hook && hook !== '0x0000000000000000000000000000000000000000' ? hook : null,
  };
}

/**
 * @returns {Promise<ProtocolStats | null>}
 */
export async function readProtocolStats() {
  if (!contractsConfigured()) return null;

  const meta = await readTokenMetadata();
  if (!meta) return null;

  return {
    tokensBurned: meta.tokensBurned,
    circulatingSupply: meta.totalSupply,
    initialSupply: meta.initialSupply,
    burnPercent: meta.burnPercent,
  };
}

/**
 * Procedural torch art samples for the landing gallery (no on-chain NFT layer).
 * @param {number} count
 */
export function loadProceduralTorchSamples(count = 15) {
  const limit = Math.min(count, GALLERY_HASH_COUNT);
  return Array.from({ length: limit }, (_, index) => {
    const tokenId = index + 1;
    const svg = generateHashSvg(seedForPattern(tokenId));

    return {
      tokenId,
      torchId: `#${String(tokenId).padStart(4, '0')}`,
      svg,
    };
  });
}

/** @deprecated Use readTokenMetadata — kept for gallery imports. */
export async function readMintedCount() {
  return GALLERY_HASH_COUNT;
}

/** @deprecated Procedural only — no ERC-721 mints on this contract. */
export async function loadSampleHashes(count) {
  return loadProceduralTorchSamples(count).map((entry) => ({
    tokenId: entry.tokenId,
    hashId: entry.torchId,
    owner: '0x0000000000000000000000000000000000000000',
    ownerShort: 'procedural',
    svg: entry.svg,
    claimableEth: 0,
  }));
}

/** @deprecated Procedural only. */
export async function loadMintedHashes() {
  return loadSampleHashes(GALLERY_DISPLAY_CAP);
}

export function sampleTokenIds() {
  return [];
}

import { formatEther, formatUnits, zeroAddress } from 'viem';
import { unihashAbi } from '../abis/unihash.js';
import { BASE_HASH_SVGS, generateHashSvg } from '../hash-svgs.js';
import { CONTRACTS, contractsConfigured, isDeployed } from '../config/contracts.js';
import { getPublicClient } from './provider.js';
import { parseInnerSvgFromTokenUri } from './token-uri.js';

const MULTICALL_CHUNK = 80;
const HOLDERS_CHUNK = 200;

function contractAddress() {
  return isDeployed(CONTRACTS.unihash)
    ? CONTRACTS.unihash
    : isDeployed(CONTRACTS.hashToken)
      ? CONTRACTS.hashToken
      : null;
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Prefer on-chain tokenURI SVG; fall back to curated / procedural patterns.
 * @param {number} tokenId
 * @param {string} [tokenUri]
 */
function resolveHashSvgMarkup(tokenId, tokenUri) {
  if (tokenUri) {
    try {
      return parseInnerSvgFromTokenUri(tokenUri);
    } catch (error) {
      console.warn(`[UniHash] tokenURI parse failed for #${tokenId}:`, error);
    }
  }

  if (tokenId >= 1 && tokenId <= BASE_HASH_SVGS.length) {
    return BASE_HASH_SVGS[tokenId - 1];
  }

  return generateHashSvg(tokenId * 97 + 13);
}

/**
 * @param {number} mintedNum
 * @param {number} sampleSize
 */
export function sampleTokenIds(mintedNum, sampleSize) {
  if (mintedNum <= 0) return [];
  if (!sampleSize || sampleSize >= mintedNum) {
    return Array.from({ length: mintedNum }, (_, index) => index + 1);
  }

  const ids = Array.from({ length: mintedNum }, (_, index) => index + 1);

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids.slice(0, sampleSize).sort((a, b) => a - b);
}

/**
 * @typedef {Object} ProtocolStats
 * @property {number} hashesAlive
 * @property {number} holders
 * @property {number} blocksSpawned
 */

/**
 * @typedef {Object} MintedHash
 * @property {number} tokenId
 * @property {string} hashId
 * @property {`0x${string}`} owner
 * @property {string} ownerShort
 * @property {string} svg
 * @property {number} claimableEth
 */

/**
 * @typedef {Object} TokenMetadata
 * @property {string} symbol
 * @property {number} totalSupply
 * @property {number} minted
 */

/**
 * @returns {Promise<number>}
 */
export async function readMintedCount() {
  const address = contractAddress();
  if (!address) return 0;

  const client = getPublicClient();
  const minted = await client.readContract({
    address,
    abi: unihashAbi,
    functionName: 'minted',
  });

  return Number(minted);
}

/**
 * @returns {Promise<TokenMetadata | null>}
 */
export async function readTokenMetadata() {
  const address = contractAddress();
  if (!address) return null;

  const client = getPublicClient();
  const [symbol, totalSupply, decimals, minted] = await Promise.all([
    client.readContract({ address, abi: unihashAbi, functionName: 'symbol' }),
    client.readContract({ address, abi: unihashAbi, functionName: 'TOTAL_SUPPLY' }).catch(() =>
      client.readContract({ address, abi: unihashAbi, functionName: 'totalSupply' }),
    ),
    client.readContract({ address, abi: unihashAbi, functionName: 'decimals' }),
    client.readContract({ address, abi: unihashAbi, functionName: 'minted' }),
  ]);

  return {
    symbol,
    totalSupply: Number.parseFloat(formatUnits(totalSupply, Number(decimals))),
    minted: Number(minted),
  };
}

/**
 * @param {import('viem').PublicClient} client
 * @param {`0x${string}`} address
 * @param {number} mintedNum
 */
async function readUniqueHolders(client, address, mintedNum) {
  const owners = [];

  for (let start = 1; start <= mintedNum; start += HOLDERS_CHUNK) {
    const end = Math.min(start + HOLDERS_CHUNK - 1, mintedNum);
    const contracts = Array.from({ length: end - start + 1 }, (_, index) => ({
      address,
      abi: unihashAbi,
      functionName: 'ownerOf',
      args: [BigInt(start + index)],
    }));

    const results = await client.multicall({ contracts });
    owners.push(
      ...results
        .map((result) => result.result)
        .filter((owner) => owner && owner !== zeroAddress),
    );
  }

  return new Set(owners.map((owner) => owner.toLowerCase())).size;
}

/**
 * @returns {Promise<ProtocolStats | null>}
 */
export async function readProtocolStats() {
  if (!contractsConfigured()) return null;

  const address = contractAddress();
  if (!address) return null;

  const client = getPublicClient();
  const mintedNum = await readMintedCount();

  if (mintedNum === 0) {
    return { hashesAlive: 0, holders: 0, blocksSpawned: 0 };
  }

  const holders = await readUniqueHolders(client, address, mintedNum);

  return {
    hashesAlive: mintedNum,
    holders,
    blocksSpawned: mintedNum,
  };
}

/**
 * @param {number[]} tokenIds
 */
async function loadHashesForTokenIds(tokenIds) {
  const address = contractAddress();
  if (!address || tokenIds.length === 0) return [];

  const client = getPublicClient();
  /** @type {{ tokenId: number, owner: `0x${string}`, tokenUri?: string }[]} */
  const raw = [];

  for (let offset = 0; offset < tokenIds.length; offset += MULTICALL_CHUNK) {
    const chunk = tokenIds.slice(offset, offset + MULTICALL_CHUNK);
    const contracts = chunk.flatMap((tokenId) => [
      {
        address,
        abi: unihashAbi,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      },
      {
        address,
        abi: unihashAbi,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      },
    ]);

    const results = await client.multicall({ contracts });

    chunk.forEach((tokenId, index) => {
      const owner = results[index * 2]?.result;
      const tokenUri = results[index * 2 + 1]?.result;
      if (!owner) return;

      raw.push({
        tokenId,
        owner,
        tokenUri,
      });
    });
  }

  const uniqueOwners = [...new Set(raw.map((entry) => entry.owner))];
  const dividendResults = await client.multicall({
    contracts: uniqueOwners.map((owner) => ({
      address,
      abi: unihashAbi,
      functionName: 'withdrawableDividend',
      args: [owner],
    })),
  });

  const claimableByOwner = new Map(
    uniqueOwners.map((owner, index) => [
      owner.toLowerCase(),
      dividendResults[index]?.result ?? 0n,
    ]),
  );

  return raw.map((entry) => ({
    tokenId: entry.tokenId,
    hashId: `#${String(entry.tokenId).padStart(4, '0')}`,
    owner: entry.owner,
    ownerShort: shortenAddress(entry.owner),
    svg: resolveHashSvgMarkup(entry.tokenId, entry.tokenUri),
    claimableEth: Number.parseFloat(
      formatEther(claimableByOwner.get(entry.owner.toLowerCase()) ?? 0n),
    ),
  }));
}

/**
 * @param {{ sampleSize?: number, tokenIds?: number[] }} [options]
 * @returns {Promise<MintedHash[]>}
 */
export async function loadMintedHashes(options = {}) {
  const address = contractAddress();
  if (!address) return [];

  const mintedNum = await readMintedCount();
  if (mintedNum === 0) return [];

  const tokenIds =
    options.tokenIds ??
    sampleTokenIds(mintedNum, options.sampleSize ?? mintedNum);

  return loadHashesForTokenIds(tokenIds);
}

/**
 * @param {number} count
 * @returns {Promise<MintedHash[]>}
 */
export async function loadSampleHashes(count) {
  const mintedNum = await readMintedCount();
  if (mintedNum === 0) return [];

  const tokenIds = sampleTokenIds(mintedNum, count);
  return loadHashesForTokenIds(tokenIds);
}

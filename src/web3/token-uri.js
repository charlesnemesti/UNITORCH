/**
 * Decode a `data:*;base64,...` or `data:*,...` URI payload.
 * @param {string} uri
 */
function decodeDataUri(uri) {
  const comma = uri.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URI');

  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);

  if (header.includes(';base64')) {
    return atob(payload);
  }

  return decodeURIComponent(payload);
}

/**
 * Extract inner SVG markup (rects etc.) from an on-chain tokenURI.
 * @param {string} tokenUri
 */
export function parseInnerSvgFromTokenUri(tokenUri) {
  const metadata = JSON.parse(decodeDataUri(tokenUri));
  const image = metadata?.image;

  if (!image || typeof image !== 'string') {
    throw new Error('tokenURI metadata missing image');
  }

  const svgDoc = decodeDataUri(image);
  const match = svgDoc.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);

  if (!match?.[1]) {
    throw new Error('Could not parse SVG from tokenURI');
  }

  return match[1].trim();
}

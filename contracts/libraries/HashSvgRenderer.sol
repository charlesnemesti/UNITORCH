// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HashSvgRenderer
/// @notice Renders UniHash 24×24 SVG art on-chain (void + #DFFF00 fluor rects).
/// @dev Mirrors the procedural logic in `src/hash-svgs.js`.
library HashSvgRenderer {
    uint8 internal constant GRID = 24;
    uint256 internal constant UINT32_MAX = 4294967295;

    struct Rect {
        uint8 x;
        uint8 y;
        uint8 w;
        uint8 h;
        bool hollow;
        bool dim;
    }

    /// @notice Same seed scheme as the frontend gallery for tokenId > 12.
    function seedForToken(uint256 tokenId) internal pure returns (uint256) {
        return tokenId * 97 + 13;
    }

    /// @notice Full SVG document (no base64).
    function svgForToken(uint256 tokenId) internal pure returns (string memory) {
        string memory body = tokenId <= 12 ? _baseInnerSvg(tokenId) : _proceduralInnerSvg(seedForToken(tokenId));

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
                body,
                "</svg>"
            )
        );
    }

    /// @notice `data:image/svg+xml;base64,...` ready for ERC-721 metadata.
    function imageDataUriForToken(uint256 tokenId) internal pure returns (string memory) {
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svgForToken(tokenId)))));
    }

    /// @notice Minimal OpenSea-compatible JSON with inline SVG.
    function tokenJsonForToken(uint256 tokenId) internal pure returns (string memory) {
        string memory name = string(abi.encodePacked("UniHash #", _u(tokenId)));
        string memory image = imageDataUriForToken(tokenId);

        return string(
            abi.encodePacked(
                '{"name":"',
                name,
                '","description":"UniHash · 100% on-chain 24x24 SVG","image":"',
                image,
                '"}'
            )
        );
    }

    /// @notice `data:application/json;base64,...`
    function tokenUriDataForToken(uint256 tokenId) internal pure returns (string memory) {
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(tokenJsonForToken(tokenId)))));
    }

  // ─── Procedural renderer (matches `generateHashSvg` in hash-svgs.js) ───

    function _proceduralInnerSvg(uint256 seed) private pure returns (string memory) {
        uint256 state = seed + 0x6d2b79f5;

        uint256 blocks;
        (state, blocks) = _randBounded(state, 5);
        blocks += 3;

        string memory out = '<rect width="24" height="24" fill="#000"/>';

        for (uint256 i = 0; i < blocks; i++) {
            uint256 w;
            uint256 h;
            uint256 x;
            uint256 y;
            uint256 hollowRoll;
            uint256 dimRoll;

            (state, w) = _randBounded(state, 10);
            w += 2;
            (state, h) = _randBounded(state, 10);
            h += 2;
            (state, x) = _randBounded(state, GRID - w);
            (state, y) = _randBounded(state, GRID - h);
            (state, hollowRoll) = _randUnit(state);
            (state, dimRoll) = _randUnit(state);

            uint256 hollowUnit = hollowRoll % (UINT32_MAX + 1);
            uint256 dimUnit = dimRoll % (UINT32_MAX + 1);

            bool hollow = hollowUnit > (UINT32_MAX * 82) / 100;
            bool dim = !hollow && dimUnit > (UINT32_MAX * 70) / 100;

            out = string(abi.encodePacked(out, _rectMarkup(uint8(x), uint8(y), uint8(w), uint8(h), hollow, dim)));
        }

        return out;
    }

    function _rectMarkup(uint8 x, uint8 y, uint8 w, uint8 h, bool hollow, bool dim) private pure returns (string memory) {
        if (hollow) {
            return string(
                abi.encodePacked(
                    '<rect x="',
                    _u(x),
                    '" y="',
                    _u(y),
                    '" width="',
                    _u(w),
                    '" height="',
                    _u(h),
                    '" fill="none" stroke="#DFFF00" stroke-width="1"/>'
                )
            );
        }

        if (dim) {
            return string(
                abi.encodePacked(
                    '<rect x="',
                    _u(x),
                    '" y="',
                    _u(y),
                    '" width="',
                    _u(w),
                    '" height="',
                    _u(h),
                    '" fill="#DFFF00" opacity="0.55"/>'
                )
            );
        }

        return string(
            abi.encodePacked(
                '<rect x="',
                _u(x),
                '" y="',
                _u(y),
                '" width="',
                _u(w),
                '" height="',
                _u(h),
                '" fill="#DFFF00"/>'
            )
        );
    }

  // ─── First 12 curated patterns (matches `BASE_HASH_SVGS`) ───

    function _baseInnerSvg(uint256 tokenId) private pure returns (string memory) {
        if (tokenId == 1) {
            return '<rect width="24" height="24" fill="#000"/><rect x="2" y="2" width="6" height="6" fill="#DFFF00"/>';
        }
        if (tokenId == 2) {
            return '<rect width="24" height="24" fill="#000"/><rect x="8" y="4" width="8" height="4" fill="#DFFF00"/>';
        }
        if (tokenId == 3) {
            return '<rect width="24" height="24" fill="#000"/><rect x="4" y="8" width="4" height="8" fill="#DFFF00"/>';
        }
        if (tokenId == 4) {
            return '<rect width="24" height="24" fill="#000"/><rect x="12" y="12" width="8" height="8" fill="#DFFF00"/>';
        }
        if (tokenId == 5) {
            return '<rect width="24" height="24" fill="#000"/><rect x="0" y="16" width="24" height="4" fill="#DFFF00"/>';
        }
        if (tokenId == 6) {
            return '<rect width="24" height="24" fill="#000"/><rect x="10" y="0" width="4" height="24" fill="#DFFF00"/>';
        }
        if (tokenId == 7) {
            return
                '<rect width="24" height="24" fill="#000"/><rect x="6" y="6" width="12" height="12" fill="none" stroke="#DFFF00" stroke-width="1"/>';
        }
        if (tokenId == 8) {
            return '<rect width="24" height="24" fill="#000"/><rect x="2" y="10" width="20" height="4" fill="#DFFF00"/>';
        }
        if (tokenId == 9) {
            return '<rect width="24" height="24" fill="#000"/><rect x="4" y="4" width="16" height="16" fill="#DFFF00" opacity="0.5"/>';
        }
        if (tokenId == 10) {
            return '<rect width="24" height="24" fill="#000"/><rect x="8" y="2" width="8" height="20" fill="#DFFF00"/>';
        }
        if (tokenId == 11) {
            return
                '<rect width="24" height="24" fill="#000"/><rect x="0" y="0" width="12" height="12" fill="#DFFF00"/><rect x="12" y="12" width="12" height="12" fill="#DFFF00"/>';
        }
        return
            '<rect width="24" height="24" fill="#000"/><rect x="6" y="6" width="4" height="4" fill="#DFFF00"/><rect x="14" y="14" width="4" height="4" fill="#DFFF00"/>';
    }

  // ─── PRNG (same family as `seeded()` in hash-svgs.js) ───

    function _randUnit(uint256 state) private pure returns (uint256 nextState, uint256 unit) {
        uint256 t = _imul(state ^ (state >> 15), state | 1);
        t ^= t + _imul(t ^ (t >> 7), t | 61);
        nextState = t;
        unit = t ^ (t >> 14);
    }

    function _randBounded(uint256 state, uint256 maxExclusive) private pure returns (uint256 nextState, uint256 value) {
        uint256 unit;
        (nextState, unit) = _randUnit(state);
        value = ((unit % (UINT32_MAX + 1)) * maxExclusive) / (UINT32_MAX + 1);
    }

    function _imul(uint256 a, uint256 b) private pure returns (uint256) {
        unchecked {
            return uint256(uint32(a) * uint32(b));
        }
    }

    function _u(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}

/// @dev Minimal base64 encoder for inline metadata (no external dependency).
library Base64 {
    bytes internal constant TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        uint256 encodedLength = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLength);
        bytes memory table = TABLE;

        uint256 j = 0;

        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 a = uint256(uint8(data[i]));
            uint256 b = i + 1 < data.length ? uint256(uint8(data[i + 1])) : 0;
            uint256 c = i + 2 < data.length ? uint256(uint8(data[i + 2])) : 0;

            uint256 triple = (a << 16) | (b << 8) | c;

            result[j++] = table[(triple >> 18) & 63];
            result[j++] = table[(triple >> 12) & 63];
            result[j++] = i + 1 < data.length ? table[(triple >> 6) & 63] : bytes1(uint8(61));
            result[j++] = i + 2 < data.length ? table[triple & 63] : bytes1(uint8(61));
        }

        return string(result);
    }
}

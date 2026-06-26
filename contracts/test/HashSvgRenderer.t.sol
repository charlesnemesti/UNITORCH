// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HashSvgRenderer} from "../libraries/HashSvgRenderer.sol";

contract HashSvgRendererTest is Test {
    function test_basePattern_contains_fluor_rect() public pure {
        string memory svg = HashSvgRenderer.svgForToken(1);
        assertTrue(_contains(svg, "#DFFF00"));
        assertTrue(_contains(svg, 'viewBox="0 0 24 24"'));
    }

    function test_proceduralPattern_is_deterministic() public pure {
        string memory a = HashSvgRenderer.svgForToken(42);
        string memory b = HashSvgRenderer.svgForToken(42);
        assertEq(keccak256(bytes(a)), keccak256(bytes(b)));
    }

    function test_tokenUri_is_data_uri() public pure {
        string memory uri = HashSvgRenderer.tokenUriDataForToken(13);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
    }

    function _contains(string memory haystack, string memory needle) private pure returns (bool) {
        return _indexOf(haystack, needle) != type(uint256).max;
    }

    function _startsWith(string memory haystack, string memory prefix) private pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory p = bytes(prefix);
        if (p.length > h.length) return false;

        for (uint256 i = 0; i < p.length; i++) {
            if (h[i] != p[i]) return false;
        }

        return true;
    }

    function _indexOf(string memory haystack, string memory needle) private pure returns (uint256) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);

        if (n.length == 0 || n.length > h.length) return type(uint256).max;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool hit = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    hit = false;
                    break;
                }
            }
            if (hit) return i;
        }

        return type(uint256).max;
    }
}

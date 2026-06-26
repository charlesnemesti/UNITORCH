// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HashSvgRenderer} from "./libraries/HashSvgRenderer.sol";

/// @title UniHashNFT
/// @notice Example ERC-721 where every tokenURI is rendered fully on-chain.
/// @dev Wire this address into `.env` as `VITE_HASH_NFT_ADDRESS` once deployed.
contract UniHashNFT is ERC721, Ownable {
    using HashSvgRenderer for uint256;

    uint256 public constant MAX_SUPPLY = 5000;

    uint256 private _nextTokenId = 1;

    constructor(address initialOwner) ERC721("UniHash", "HASH-ART") Ownable(initialOwner) {}

    /// @notice Preview raw SVG for a token id without minting.
    function previewSvg(uint256 tokenId) external pure returns (string memory) {
        require(tokenId > 0 && tokenId <= MAX_SUPPLY, "invalid token");
        return HashSvgRenderer.svgForToken(tokenId);
    }

    /// @notice Preview only the fluor rects layer (procedural tokens).
    function previewSeed(uint256 tokenId) external pure returns (uint256) {
        require(tokenId > 0 && tokenId <= MAX_SUPPLY, "invalid token");
        return HashSvgRenderer.seedForToken(tokenId);
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        require(_nextTokenId <= MAX_SUPPLY, "sold out");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(to, tokenId);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        require(tokenId > 0 && tokenId <= MAX_SUPPLY, "invalid token");
        return HashSvgRenderer.tokenUriDataForToken(tokenId);
    }
}

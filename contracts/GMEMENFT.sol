// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GMEMENFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    IERC20 public gmemeToken;
    address public battleContract;
    address public devWallet;

    struct FighterStats {
        uint256 elo;
    }

    mapping(uint256 => FighterStats) public stats;

    event EloUpdated(uint256 tokenId, uint256 newElo);

    constructor(address _gmemeToken, address _devWallet) ERC721("GMEME Fighter", "GMME") Ownable(msg.sender) {
        gmemeToken = IERC20(_gmemeToken);
        devWallet = _devWallet;
        _nextTokenId = 1;
    }

    function setBattleContract(address _battleContract) external onlyOwner {
        battleContract = _battleContract;
    }

    function mint(string memory uri) external {
        uint256 price = 1 * 10**18; // 1 GMEME
        // User must approve contract to spend 1 GMEME first
        require(gmemeToken.transferFrom(msg.sender, devWallet, price), "Payment failed");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Initial ELO = 0
        stats[tokenId] = FighterStats({elo: 0});
    }

    modifier onlyBattle() {
        require(msg.sender == battleContract, "Caller is not battle contract");
        _;
    }

    function increaseElo(uint256 tokenId) external onlyBattle {
        stats[tokenId].elo += 1;
        emit EloUpdated(tokenId, stats[tokenId].elo);
    }

    function decreaseElo(uint256 tokenId) external onlyBattle {
        if (stats[tokenId].elo > 0) {
            stats[tokenId].elo -= 1;
            emit EloUpdated(tokenId, stats[tokenId].elo);
        }
    }

    function getElo(uint256 tokenId) external view returns (uint256) {
        return stats[tokenId].elo;
    }

    function getRank(uint256 tokenId) external view returns (string memory) {
        uint256 elo = stats[tokenId].elo;
        if (elo <= 5) return "Bronze"; // 0-5
        if (elo <= 10) return "Silver"; // 6-10
        if (elo <= 20) return "Gold"; // 11-20
        if (elo <= 50) return "Platinum"; // 21-50
        if (elo <= 100) return "Diamond"; // 51-100
        return "Legendary"; // >100
    }
}

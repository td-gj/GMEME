// Contract addresses on Polygon Mainnet
export const CONTRACTS = {
    TOKEN: '0x7053d3A4725d10365D1Db3cE3d716062941b5cC6',
    NFT: '0x5096ABb4ee9dBd856FCC98e1EE3FB77BE6ad791a',
    SWAP: '0xB9F62b142e0ABA8D2d645F17da0078F303f1eD19',
    BATTLE: '0x310e44Df62934335A03718a9Ea3031E06Ed3C2Cb'
};

// Network configuration
export const NETWORK = {
    chainId: "0x89", // 137 in hex
    chainName: "Polygon Mainnet",
    nativeCurrency: {
        name: "POL",
        symbol: "POL",
        decimals: 18
    },
    rpcUrls: [
        "https://polygon-rpc.com/",
        "https://rpc-mainnet.maticvigil.com/",
        "https://polygon-bor-rpc.publicnode.com"
    ],
    blockExplorerUrls: ["https://polygonscan.com/"]
};

// ABIs (simplified - only functions we need)
export const ABIS = {
    TOKEN: [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "function totalSupply() view returns (uint256)"
    ],
    NFT: [
        "function mint(string uri)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function tokenURI(uint256 tokenId) view returns (string)",
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function getElo(uint256 tokenId) view returns (uint256)",
        "function getRank(uint256 tokenId) view returns (string)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ],
    SWAP: [
        "function swap() payable",
        "function swapPOLToGMEME() payable",
        "function swapGMEMEToPOL(uint256 amountGMEME)",
        "function RATE() view returns (uint256)"
    ],
    BATTLE: [
        "function joinBattle(uint256 tokenId)",
        "function vote(uint256 battleId, uint256 side)",
        "function endBattle(uint256 battleId)",
        "function battles(uint256) view returns (uint256 id, uint256 p1TokenId, uint256 p2TokenId, address p1Owner, address p2Owner, uint256 startTime, bool ended)",
        "function getVoteCounts(uint256) view returns (uint256,uint256)",
        "function getVoteCountsBatch(uint256[]) view returns (uint256[],uint256[])",
        "function nextBattleId() view returns (uint256)",
        "function BET_AMOUNT() view returns (uint256)",
        "function VOTE_COST() view returns (uint256)",
        "function BATTLE_DURATION() view returns (uint256)",
        "event BattleStarted(uint256 battleId, uint256 p1, uint256 p2)",
        "event BattleEnded(uint256 battleId, uint256 winnerTokenId)",
        "event Voted(uint256 battleId, address voter, uint256 side)"
    ]
};

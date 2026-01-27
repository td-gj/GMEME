// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GMEMENFT.sol";

contract GMEBattle is Ownable {
    IERC20 public gmemeToken;  // Chỉ để check holding (không tốn)
    IERC20 public gmeToken;    // Token thưởng (thắng + vote thắng)
    GMEMENFT public nftContract;
    address public devWallet;

    // Constants
    uint256 public constant BATTLE_DURATION = 24 hours;
    uint256 public constant MIN_HOLDING_GMEME = 1 ether; // Phải hold 1 GMEME
    uint256 public constant DAILY_FREE_BATTLES = 3;
    
    // Rewards (trả bằng GME token)
    uint256 public constant WINNER_REWARD = 10 * 10**18;     // 10 GME cho người thắng
    uint256 public constant VOTER_WIN_REWARD = 1 * 10**17;   // 0.1 GME cho voter đoán đúng

    struct UserBattleInfo {
        uint256 lastBattleResetTime;
        uint256 battlesToday;
    }

    struct Battle {
        uint256 id;
        uint256 p1TokenId;
        uint256 p2TokenId;
        address p1Owner;
        address p2Owner;
        uint256 startTime;
        bool ended;
        address[] p1Voters;
        address[] p2Voters;
    }

    mapping(uint256 => Battle) public battles;
    uint256 public nextBattleId = 1;
    mapping(address => UserBattleInfo) public userBattleInfo;
    
    // Simple Queue System
    uint256 public queuedTokenId;
    bool public hasQueuedPlayer;

    event BattleStarted(uint256 battleId, uint256 p1, uint256 p2);
    event BattleEnded(uint256 battleId, uint256 winnerTokenId);
    event Voted(uint256 battleId, address voter, uint256 side);

    constructor(
        address _gmemeToken,
        address _gmeToken,
        address _nftContract,
        address _devWallet
    ) Ownable(msg.sender) {
        gmemeToken = IERC20(_gmemeToken);
        gmeToken = IERC20(_gmeToken);
        nftContract = GMEMENFT(_nftContract);
        devWallet = _devWallet;
    }

    function _checkDailyLimit(address user) internal {
        UserBattleInfo storage info = userBattleInfo[user];
        // Reset daily nếu đã qua 24h
        if (block.timestamp >= info.lastBattleResetTime + 1 days) {
            info.lastBattleResetTime = block.timestamp;
            info.battlesToday = 0;
        }
        require(info.battlesToday < DAILY_FREE_BATTLES, "Daily free battle limit (3) reached");
    }

    function joinBattle(uint256 tokenId) external {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(gmemeToken.balanceOf(msg.sender) >= MIN_HOLDING_GMEME, "Must hold 1 GMEME to join");
        
        _checkDailyLimit(msg.sender);
        userBattleInfo[msg.sender].battlesToday++;

        if (hasQueuedPlayer) {
            require(queuedTokenId != tokenId, "Cannot battle against self");
            
            uint256 battleId = nextBattleId++;
            Battle storage b = battles[battleId];
            b.id = battleId;
            b.p1TokenId = queuedTokenId;
            b.p2TokenId = tokenId;
            b.p1Owner = nftContract.ownerOf(queuedTokenId);
            b.p2Owner = msg.sender;
            b.startTime = block.timestamp;
            
            // Clear queue
            hasQueuedPlayer = false;
            queuedTokenId = 0;
            
            emit BattleStarted(battleId, b.p1TokenId, b.p2TokenId);
        } else {
            queuedTokenId = tokenId;
            hasQueuedPlayer = true;
        }
    }

    function vote(uint256 battleId, uint256 side) external {
        require(gmemeToken.balanceOf(msg.sender) >= MIN_HOLDING_GMEME, "Must hold 1 GMEME to vote");
        
        Battle storage b = battles[battleId];
        require(!b.ended, "Battle Ended");
        require(block.timestamp < b.startTime + BATTLE_DURATION, "Time over");
        require(side == 1 || side == 2, "Invalid side");

        if (side == 1) {
            b.p1Voters.push(msg.sender);
        } else {
            b.p2Voters.push(msg.sender);
        }
        emit Voted(battleId, msg.sender, side);
    }

    function endBattle(uint256 battleId) external {
        Battle storage b = battles[battleId];
        require(!b.ended, "Already ended");
        require(block.timestamp >= b.startTime + BATTLE_DURATION, "Battle still ongoing");

        b.ended = true;

        uint256 votes1 = b.p1Voters.length;
        uint256 votes2 = b.p2Voters.length;

        address winnerOwner;
        uint256 winnerTokenId;
        uint256 loserTokenId;
        address[] storage winnerVoters = b.p1Voters;
        address[] storage loserVoters = b.p2Voters;

        if (votes1 >= votes2) {
            winnerOwner = b.p1Owner;
            winnerTokenId = b.p1TokenId;
            loserTokenId = b.p2TokenId;
            winnerVoters = b.p1Voters;
            loserVoters = b.p2Voters;
        } else {
            winnerOwner = b.p2Owner;
            winnerTokenId = b.p2TokenId;
            loserTokenId = b.p1TokenId;
            winnerVoters = b.p2Voters;
            loserVoters = b.p1Voters;
        }

        // Thưởng 10 GME cho người thắng
        gmeToken.transfer(winnerOwner, WINNER_REWARD);

        // 0.1 GME cho Random Winner Voter
        if (winnerVoters.length > 0) {
            uint256 randIndex = _pseudoRandom(winnerVoters.length);
            gmeToken.transfer(winnerVoters[randIndex], VOTER_WIN_REWARD);
        } else {
            gmeToken.transfer(devWallet, VOTER_WIN_REWARD);
        }

        // Voter thua không được gì (0 GME)
        if (loserVoters.length > 0) {
            uint256 randIndex = _pseudoRandom(loserVoters.length);
            // Không thưởng cho voter thua
            gmeToken.transfer(loserVoters[randIndex], 0);
        }

        // Update ELO
        nftContract.increaseElo(winnerTokenId);
        nftContract.decreaseElo(loserTokenId);
        
        emit BattleEnded(battleId, winnerTokenId);
    }
    
    function _pseudoRandom(uint256 modulus) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % modulus;
    }

    function getVoteCounts(uint256 battleId) external view returns (uint256 p1Votes, uint256 p2Votes) {
        Battle storage b = battles[battleId];
        p1Votes = b.p1Voters.length;
        p2Votes = b.p2Voters.length;
    }

    function getVoteCountsBatch(uint256[] calldata battleIds) external view returns (uint256[] memory p1Votes, uint256[] memory p2Votes) {
        uint256 len = battleIds.length;
        p1Votes = new uint256[](len);
        p2Votes = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            Battle storage b = battles[battleIds[i]];
            p1Votes[i] = b.p1Voters.length;
            p2Votes[i] = b.p2Voters.length;
        }
    }

    // Deposit GME vào contract để làm reward pool
    function depositRewards(uint256 amount) external {
        require(gmeToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }

    // Kiểm tra balance GME trong contract
    function getRewardPoolBalance() external view returns (uint256) {
        return gmeToken.balanceOf(address(this));
    }
}

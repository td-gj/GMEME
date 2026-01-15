// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GMEMENFT.sol";

contract GMEMEBattle is Ownable {
    IERC20 public gmemeToken;
    GMEMENFT public nftContract;
    address public devWallet;

    uint256 public constant BET_AMOUNT = 10 * 10**18;
    uint256 public constant VOTE_COST = 6 * 10**16; // 0.06 GMEME
    uint256 public constant BATTLE_DURATION = 5 minutes;
    
    // Rewards
    uint256 public constant WINNER_REWARD = 18 * 10**18;
    uint256 public constant VOTER_WIN_REWARD = 1 * 10**18;
    uint256 public constant VOTER_LOSE_REWARD = 2 * 10**17; // 0.2 GMEME
    uint256 public constant DEV_FEE = 8 * 10**17; // 0.8 GMEME

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

    struct UserVoteInfo {
        uint256 lastFreeVoteTime;
        uint256 paidVotesToday;
        uint256 lastPaidVoteResetTime;
    }

    mapping(uint256 => Battle) public battles;
    uint256 public nextBattleId = 1;

    mapping(address => UserVoteInfo) public userVotes;
    
    // Simple Queue System
    uint256 public queuedTokenId;
    bool public hasQueuedPlayer;

    event BattleStarted(uint256 battleId, uint256 p1, uint256 p2);
    event BattleEnded(uint256 battleId, uint256 winnerTokenId);
    event Voted(uint256 battleId, address voter, uint256 side); // side 1 or 2

    constructor(address _gmemeToken, address _nftContract, address _devWallet) Ownable(msg.sender) {
        gmemeToken = IERC20(_gmemeToken);
        nftContract = GMEMENFT(_nftContract);
        devWallet = _devWallet;
    }

    function joinBattle(uint256 tokenId) external {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not owner");
        // Transfer Bet logic: Caller must approve this contract first
        require(gmemeToken.transferFrom(msg.sender, address(this), BET_AMOUNT), "Bet failed");

        if (hasQueuedPlayer) {
            // Match found
            require(queuedTokenId != tokenId, "Cannot play against self");
            
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
            // Add to queue
            queuedTokenId = tokenId;
            hasQueuedPlayer = true;
        }
    }

    function vote(uint256 battleId, uint256 side) external {
        Battle storage b = battles[battleId];
        require(!b.ended, "Battle Ended");
        require(block.timestamp < b.startTime + BATTLE_DURATION, "Time over");
        require(side == 1 || side == 2, "Invalid side");

        _processVoteCost(msg.sender);

        if (side == 1) {
            b.p1Voters.push(msg.sender);
        } else {
            b.p2Voters.push(msg.sender);
        }
        emit Voted(battleId, msg.sender, side);
    }

    function _processVoteCost(address user) internal {
        UserVoteInfo storage info = userVotes[user];
        
        bool isFree = false;
        // Check if 24h passed since last free vote
        if (block.timestamp >= info.lastFreeVoteTime + 1 days) {
            info.lastFreeVoteTime = block.timestamp;
            isFree = true;
        }

        if (!isFree) {
            // Check paid votes reset
            if (block.timestamp >= info.lastPaidVoteResetTime + 1 days) {
                info.paidVotesToday = 0;
                info.lastPaidVoteResetTime = block.timestamp;
            }
            
            require(info.paidVotesToday < 66, "Daily paid vote limit reached (66)");
            
            // Charge cost
            require(gmemeToken.transferFrom(user, address(this), VOTE_COST), "Vote payment failed");
            // Fee goes to contract, later maybe withdrawn by dev?
            // "0.06 GMEME" - User didn't specify where vote fee goes.
            // I will send it to Dev Wallet immediately to be safe.
            gmemeToken.transfer(devWallet, VOTE_COST);
            
            info.paidVotesToday++;
        }
    }

    function endBattle(uint256 battleId) external {
        Battle storage b = battles[battleId];
        require(!b.ended, "Already ended");
        require(block.timestamp >= b.startTime + BATTLE_DURATION, "Battle still ongoing");

        b.ended = true;

        uint256 votes1 = b.p1Voters.length;
        uint256 votes2 = b.p2Voters.length;

        address winnerOwner;
        address loserOwner;
        uint256 winnerTokenId;
        uint256 loserTokenId;
        address[] storage winnerVoters = b.p1Voters;
        address[] storage loserVoters = b.p2Voters;

        if (votes1 >= votes2) {
            winnerOwner = b.p1Owner;
            winnerTokenId = b.p1TokenId;
            loserOwner = b.p2Owner;
            loserTokenId = b.p2TokenId;
            winnerVoters = b.p1Voters;
            loserVoters = b.p2Voters;
        } else {
            winnerOwner = b.p2Owner;
            winnerTokenId = b.p2TokenId;
            loserOwner = b.p1Owner;
            loserTokenId = b.p1TokenId;
            winnerVoters = b.p2Voters;
            loserVoters = b.p1Voters;
        }

        // Distribute 20 GMEME Pool (10+10)
        // 18 GMEME to Winner
        gmemeToken.transfer(winnerOwner, WINNER_REWARD);

        // 0.8 GMEME to Dev
        gmemeToken.transfer(devWallet, DEV_FEE);

        // 1 GMEME to Random Winner Voter
        if (winnerVoters.length > 0) {
            uint256 randIndex = _pseudoRandom(winnerVoters.length);
            gmemeToken.transfer(winnerVoters[randIndex], VOTER_WIN_REWARD);
        } else {
            gmemeToken.transfer(devWallet, VOTER_WIN_REWARD);
        }

        // 0.2 GMEME to Random Loser Voter
        if (loserVoters.length > 0) {
            uint256 randIndex = _pseudoRandom(loserVoters.length);
            gmemeToken.transfer(loserVoters[randIndex], VOTER_LOSE_REWARD);
        } else {
            gmemeToken.transfer(devWallet, VOTER_LOSE_REWARD);
        }

        // Update ELO
        nftContract.increaseElo(winnerTokenId);
        nftContract.decreaseElo(loserTokenId);
        
        emit BattleEnded(battleId, winnerTokenId);
    }
    
    function _pseudoRandom(uint256 modulus) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % modulus;
    }
}

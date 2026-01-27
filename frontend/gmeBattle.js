// GME Battle Mode - Free Battles with GME Rewards
// Separate module for GMEBattle contract functionality

// Load NFTs for GME Battle selection
async function loadGmeBattleNFTSelect() {
    console.log('Loading GME Battle NFTs...');
    
    if (!window.signer) {
        console.log('No signer - wallet not connected');
        return;
    }

    try {
        const select = document.getElementById('gmeBattleNftSelect');
        if (!select) {
            console.log('Select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">-- Loading --</option>';

        // Check if contracts.nft exists
        if (!window.contracts || !window.contracts.nft) {
            select.innerHTML = '<option value="">NFT contract not loaded</option>';
            console.error('contracts.nft is not defined');
            return;
        }

        console.log('Fetching NFT balance for:', window.userAddress);
        const balance = await window.contracts.nft.balanceOf(window.userAddress);
        console.log('NFT Balance:', balance.toString());

        if (balance == 0) {
            select.innerHTML = '<option value="">No NFTs available</option>';
            console.log('User has 0 NFTs');
            return;
        }

        // Check ownership for token IDs 1-100
        const maxTokenId = 100;
        let foundCount = 0;

        for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
            try {
                const owner = await window.contracts.nft.ownerOf(tokenId);

                if (owner.toLowerCase() === window.userAddress.toLowerCase()) {
                    console.log('Found NFT #' + tokenId + ' owned by user');
                    const elo = await window.contracts.nft.getElo(tokenId);
                    const rank = await window.contracts.nft.getRank(tokenId);
                    
                    // Try to read NFT metadata name
                    let nftName = 'Fighter #' + tokenId;
                    try {
                        const uri = await window.contracts.nft.tokenURI(tokenId);
                        if (uri && uri.startsWith('ipfs://')) {
                            const gateway = 'https://dweb.link/ipfs/';
                            const cleanUri = uri.replace('ipfs://', '');
                            try {
                                const response = await fetch(gateway + cleanUri);
                                if (response.ok) {
                                    const metadata = await response.json();
                                    if (metadata.name) nftName = metadata.name;
                                }
                            } catch (e) {
                                // Ignore metadata fetch errors
                            }
                        }
                    } catch (e) {
                        // Ignore URI errors
                    }

                    const option = document.createElement('option');
                    option.value = tokenId;
                    option.textContent = nftName + ' (ELO: ' + Number(elo) + ', ' + rank + ')';
                    select.appendChild(option);
                    foundCount++;
                }
            } catch (error) {
                // Token doesn't exist or not owned, continue
            }
        }

        if (foundCount === 0) {
            select.innerHTML = '<option value="">No NFTs available</option>';
        }

    } catch (error) {
        console.error('Error loading NFTs for GME battle:', error);
    }
}

// Handle join GME Battle
async function handleJoinGmeBattle() {
    if (!window.signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    const tokenId = document.getElementById('gmeBattleNftSelect').value;
    if (!tokenId) {
        showMessage('Please select an NFT', 'error');
        return;
    }

    try {
        showMessage('Joining free battle...', 'info');
        
        const gmemeBalance = await window.contracts.token.balanceOf(window.userAddress);
        if (gmemeBalance < window.ethers.parseEther('1')) {
            showMessage('You need to hold at least 1 GMEME to join free battles!', 'error');
            return;
        }

        const tx = await window.contracts.gmeBattle.joinBattle(tokenId, {
            gasLimit: 500000
        });
        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();
        showMessage('Successfully joined free battle queue!', 'success');
        window.updateBalances();

    } catch (error) {
        console.error('Join GME battle error:', error);
        showMessage('Failed to join battle: ' + (error.reason || error.message), 'error');
    }
}

// Load GME Battle Arena
async function loadGmeBattleArena() {
    if (!window.signer) {
        document.getElementById('gmeBattleList').innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Please connect your wallet</p>';
        return;
    }

    try {
        const list = document.getElementById('gmeBattleList');
        list.innerHTML = '';
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) pageLoader.classList.remove('hidden');

        const nextBattleId = await window.contracts.gmeBattle.nextBattleId();
        var battles = [];

        // Load last 10 battles
        var startId = nextBattleId > 10n ? nextBattleId - 10n : 1n;
        
        // Fetch all battles first
        for (var i = Number(startId); i < Number(nextBattleId); i++) {
            try {
                var battle = await window.contracts.gmeBattle.battles(i);
                if (battle.id > 0) {
                    battles.push({
                        id: battle.id.toString(),
                        p1TokenId: Number(battle.p1TokenId),
                        p2TokenId: Number(battle.p2TokenId),
                        p1Owner: battle.p1Owner,
                        p2Owner: battle.p2Owner,
                        startTime: Number(battle.startTime),
                        ended: battle.ended,
                        p1Votes: 0,
                        p2Votes: 0
                    });
                }
            } catch (err) {
                console.warn('Failed to fetch battle:', err);
            }
        }

        // Fetch vote counts and NFT metadata in parallel
        var battleDataPromises = battles.map(async function(b) {
            try {
                var counts = await window.contracts.gmeBattle.getVoteCounts(Number(b.id));
                b.p1Votes = Number(counts[0]);
                b.p2Votes = Number(counts[1]);
            } catch (e) {}

            // Fetch NFT metadata for both fighters
            try {
                var uri1 = await window.contracts.nft.tokenURI(b.p1TokenId);
                var uri2 = await window.contracts.nft.tokenURI(b.p2TokenId);
                
                var gateways = ['https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];
                
                var p1Image = '', p2Image = '';
                var p1Name = 'Fighter #' + b.p1TokenId;
                var p2Name = 'Fighter #' + b.p2TokenId;
                
                for (var g = 0; g < gateways.length; g++) {
                    try {
                        var clean1 = uri1.replace('ipfs://', '');
                        var clean2 = uri2.replace('ipfs://', '');
                        
                        var meta1 = await fetch(gateways[g] + clean1).then(function(r) { return r.json(); }).catch(function() { return null; });
                        var meta2 = await fetch(gateways[g] + clean2).then(function(r) { return r.json(); }).catch(function() { return null; });
                        
                        if (meta1) {
                            p1Image = meta1.image ? meta1.image.replace('ipfs://', gateways[g]) : '';
                            if (meta1.name) p1Name = meta1.name;
                        }
                        if (meta2) {
                            p2Image = meta2.image ? meta2.image.replace('ipfs://', gateways[g]) : '';
                            if (meta2.name) p2Name = meta2.name;
                        }
                        if (p1Image || p2Image) break;
                    } catch (e) {}
                }
                
                b.p1Image = p1Image;
                b.p2Image = p2Image;
                b.p1Name = p1Name;
                b.p2Name = p2Name;
            } catch (e) {
                b.p1Name = 'Fighter #' + b.p1TokenId;
                b.p2Name = 'Fighter #' + b.p2TokenId;
            }
            
            return b;
        });

        battles = await Promise.all(battleDataPromises);

        if (pageLoader) pageLoader.classList.add('hidden');

        if (battles.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No GME battles yet. Be the first to join!</p>';
            return;
        }

        list.innerHTML = battles.map(function(b) {
            var now = Math.floor(Date.now() / 1000);
            var timeLeft = Math.max(0, (b.startTime + 86400) - now);
            var hours = Math.floor(timeLeft / 3600);
            var minutes = Math.floor((timeLeft % 3600) / 60);
            var statusColor = b.ended ? '#ef4444' : '#10b981';
            var statusText = b.ended ? 'BATTLE ENDED' : (hours + 'h ' + minutes + 'm left');

            var p1Img = b.p1Image || '';
            var p2Img = b.p2Image || '';
            var fallbackImg = 'data:image/svg+xml,' + encodeURIComponent('<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#22c55e"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">?</text></svg>');
            var p1DisplayImg = p1Img || fallbackImg;
            var p2DisplayImg = p2Img || fallbackImg;

            return '<div class="battle-card" onclick="window.viewGmeBattleDetail(\'' + b.id + '\')" style="cursor: pointer; padding: 1.5rem; background: linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1)); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; margin-bottom: 1rem;">' +
              '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">' +
                '<span style="font-size: 0.9rem; color: #22c55e;">GME BATTLE</span>' +
                '<span style="color: ' + statusColor + '; font-weight: bold;">' + statusText + '</span>' +
              '</div>' +
              '<div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 1rem;">' +
                // P1
                '<div style="text-align: center;">' +
                  '<img src="' + p1DisplayImg + '" onerror="this.src=\'' + fallbackImg + '\'" style="width: 80px; height: 80px; border-radius: 8px; border: 2px solid #22c55e; object-fit: cover;">' +
                  '<div style="font-size: 1rem; font-weight: bold; margin-top: 0.5rem; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + b.p1Name + '</div>' +
                  '<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">' + b.p1Votes + ' votes</div>' +
                  '<button class="btn btn-primary btn-sm" style="padding: 0.3rem 1rem; font-size: 0.8rem;" onclick="event.stopPropagation(); handleGmeVote(\'' + b.id + '\', 1)">Vote</button>' +
                '</div>' +
                '<div style="color: var(--text-muted); font-weight: bold;">VS</div>' +
                // P2
                '<div style="text-align: center;">' +
                  '<img src="' + p2DisplayImg + '" onerror="this.src=\'' + fallbackImg + '\'" style="width: 80px; height: 80px; border-radius: 8px; border: 2px solid #3b82f6; object-fit: cover;">' +
                  '<div style="font-size: 1rem; font-weight: bold; margin-top: 0.5rem; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + b.p2Name + '</div>' +
                  '<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">' + b.p2Votes + ' votes</div>' +
                  '<button class="btn btn-primary btn-sm" style="padding: 0.3rem 1rem; font-size: 0.8rem; background: linear-gradient(135deg, #3b82f6, #1d4ed8);" onclick="event.stopPropagation(); handleGmeVote(\'' + b.id + '\', 2)">Vote</button>' +
                '</div>' +
              '</div>' +
            '</div>';
        }).join('');

    } catch (error) {
        console.error('Error loading GME battles:', error);
        document.getElementById('gmeBattleList').innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Failed to load battles</p>';
    }
}

// View GME Battle Detail
window.viewGmeBattleDetail = async function(id) {
    // Switch to GME Arena tab first
    if (typeof switchTab === 'function') {
        switchTab('gmebattle-arena');
    }
    
    var activeContent = document.getElementById('gmebattle-arena-content');
    var detailView = document.getElementById('battle-detail-view');
    var detailCard = document.getElementById('battle-detail-card');

    activeContent.classList.add('hidden');
    detailView.classList.remove('hidden');

    // Fetch battle data directly from contract
    var battle = null;
    try {
        var braw = await window.contracts.gmeBattle.battles(Number(id));
        if (braw && Number(braw.id) > 0) {
            // Get vote counts
            var p1Votes = 0, p2Votes = 0;
            try {
                var counts = await window.contracts.gmeBattle.getVoteCounts(Number(id));
                p1Votes = Number(counts[0]);
                p2Votes = Number(counts[1]);
            } catch (e) {}

            // Fetch NFT metadata for both fighters
            var p1Image = '', p2Image = '';
            var p1Name = 'Fighter #' + braw.p1TokenId;
            var p2Name = 'Fighter #' + braw.p2TokenId;
            
            try {
                var uri1 = await window.contracts.nft.tokenURI(braw.p1TokenId);
                var uri2 = await window.contracts.nft.tokenURI(braw.p2TokenId);
                
                var gateways = ['https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];
                
                for (var g = 0; g < gateways.length; g++) {
                    try {
                        var clean1 = uri1.replace('ipfs://', '');
                        var clean2 = uri2.replace('ipfs://', '');
                        
                        var meta1 = await fetch(gateways[g] + clean1).then(function(r) { return r.json(); }).catch(function() { return null; });
                        var meta2 = await fetch(gateways[g] + clean2).then(function(r) { return r.json(); }).catch(function() { return null; });
                        
                        if (meta1 && meta1.image) {
                            p1Image = meta1.image.replace('ipfs://', gateways[g]);
                            if (meta1.name) p1Name = meta1.name;
                        }
                        if (meta2 && meta2.image) {
                            p2Image = meta2.image.replace('ipfs://', gateways[g]);
                            if (meta2.name) p2Name = meta2.name;
                        }
                        if (p1Image || p2Image) break;
                    } catch (e) {}
                }
            } catch (e) {
                console.warn('Failed to fetch NFT metadata:', e);
            }

            battle = {
                id: String(Number(braw.id)),
                p1TokenId: String(braw.p1TokenId),
                p2TokenId: String(braw.p2TokenId),
                p1Owner: String(braw.p1Owner),
                p2Owner: String(braw.p2Owner),
                startTime: Number(braw.startTime),
                ended: Boolean(braw.ended),
                p1Votes: p1Votes,
                p2Votes: p2Votes,
                p1Image: p1Image,
                p2Image: p2Image,
                p1Name: p1Name,
                p2Name: p2Name
            };
        }
    } catch (err) {
        console.warn('Failed to fetch GME battle:', err);
    }

    if (!battle) {
        detailCard.innerHTML = '<div class="text-center" style="padding: 3rem;"><h3>GME Battle #' + id + ' Not Found</h3><p class="text-muted">Please refresh the arena list.</p></div>';
        return;
    }

    var voteP1 = battle.p1Votes || 0;
    var voteP2 = battle.p2Votes || 0;
    var now = Math.floor(Date.now() / 1000);
    var timeLeft = Math.max(0, (battle.startTime + 86400) - now);
    var isActive = !battle.ended && timeLeft > 0;

    var fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg width="280" height="280" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="280" fill="#333"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">?</text></svg>');

    var p1ImgSrc = battle.p1Image || fallbackSvg;
    var p2ImgSrc = battle.p2Image || fallbackSvg;

    detailCard.innerHTML = '<div style="text-align: center; margin-bottom: 2rem;">' +
        '<h2 style="font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(to right, #22c55e, #3b82f6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">GME Battle #' + battle.id + '</h2>' +
        '<div id="battleStatus" style="font-size: 1.2rem; font-weight: bold; color: ' + (isActive ? '#10b981' : '#ef4444') + '">' +
            (isActive ? 'FREE BATTLE IN PROGRESS' : 'BATTLE ENDED') +
        '</div>' +
        '<div style="color: var(--text-muted); margin-top: 0.5rem;">Started: ' + new Date(battle.startTime * 1000).toLocaleString() + '</div>' +
    '</div>' +

    '<div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 2rem;">' +
        // P1
        '<div style="text-align: center; flex: 1; min-width: 200px;">' +
            '<div class="active-battle-img-container" style="width: 150px; height: 150px; margin-bottom: 1rem; border-color: #22c55e;">' +
                '<img src="' + p1ImgSrc + '" class="active-battle-img" onerror="this.src=\'' + fallbackSvg + '\'">' +
            '</div>' +
            '<h3 style="font-size: 1.8rem;">' + (battle.p1Name || 'Fighter #' + battle.p1TokenId) + '</h3>' +
            '<div style="color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin: 0.5rem 0;">Owner: ' + battle.p1Owner.slice(0, 6) + '...' + battle.p1Owner.slice(-4) + '</div>' +
            '<div style="font-size: 2.5rem; font-weight: 800; color: white; margin-top: 0.5rem; text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);">' + voteP1 + ' Votes</div>' +
        '</div>' +
        
        '<div class="vs" style="font-size: 4rem;">VS</div>' +

        // P2
        '<div style="text-align: center; flex: 1; min-width: 200px;">' +
            '<div class="active-battle-img-container" style="width: 150px; height: 150px; margin-bottom: 1rem; border-color: #3b82f6;">' +
                '<img src="' + p2ImgSrc + '" class="active-battle-img" onerror="this.src=\'' + fallbackSvg + '\'">' +
            '</div>' +
            '<h3 style="font-size: 1.8rem;">' + (battle.p2Name || 'Fighter #' + battle.p2TokenId) + '</h3>' +
            '<div style="color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin: 0.5rem 0;">Owner: ' + battle.p2Owner.slice(0, 6) + '...' + battle.p2Owner.slice(-4) + '</div>' +
            '<div style="font-size: 2.5rem; font-weight: 800; color: white; margin-top: 0.5rem; text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);">' + voteP2 + ' Votes</div>' +
        '</div>' +
    '</div>' +
    
    '<div style="background: var(--bg-glass); padding: 2rem; border-radius: 16px; margin-bottom: 2rem; border: 1px solid var(--glass-border);">' +
        '<h4 style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem; font-size: 1.2rem;">📊 GME Battle Statistics</h4>' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;"><span class="text-muted">Winner Prize</span> <span style="color: #22c55e; font-weight: bold;">10 GME</span></div>' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;"><span class="text-muted">Winning Voter Reward</span> <span style="color: #3b82f6; font-weight: bold;">0.1 GME</span></div>' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;"><span class="text-muted">Entry Fee</span> <span style="color: #22c55e; font-weight: bold;">FREE</span></div>' +
        '<div style="display: flex; justify-content: space-between;"><span class="text-muted">Daily Limit</span> <span class="text-muted">3 battles/day</span></div>' +
    '</div>' +

    (isActive ?
        '<div style="margin-top: 2rem; text-align: center;">' +
            '<div style="display: flex; gap: 1.5rem; justify-content: center;">' +
                '<button class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem;" onclick="handleGmeVote(\'' + battle.id + '\', 1)">Vote ' + (battle.p1Name || 'Fighter #' + battle.p1TokenId) + '</button>' +
                '<button class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem; background: linear-gradient(135deg, #3b82f6, #1d4ed8);" onclick="handleGmeVote(\'' + battle.id + '\', 2)">Vote ' + (battle.p2Name || 'Fighter #' + battle.p2TokenId) + '</button>' +
            '</div>' +
            '<p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">Requires: Hold 1 GMEME to vote</p>' +
        '</div>' :
        '<div class="text-center">' +
            '<button class="btn btn-secondary" onclick="handleEndGmeBattle(\'' + battle.id + '\')"' + (battle.ended ? ' disabled' : '') + '>' +
                (battle.ended ? 'Rewards Distributed' : 'End Battle & Claim Rewards') +
            '</button>' +
        '</div>'
    ) +

    '<div style="margin-top: 2rem; text-align: center;">' +
        '<button class="btn btn-secondary" onclick="window.closeGmeBattleDetail()">← Back to GME Arena</button>' +
    '</div>';

    // Simple URL update
    window.location.hash = 'gmebattle/' + id;
}

// Close GME Battle Detail
window.closeGmeBattleDetail = function() {
    var activeContent = document.getElementById('gmebattle-arena-content');
    var detailView = document.getElementById('battle-detail-view');
    detailView.classList.add('hidden');
    activeContent.classList.remove('hidden');
    loadGmeBattleArena();
}

// Handle GME Vote
async function handleGmeVote(battleId, side) {
    if (!window.signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    try {
        showMessage('Voting...', 'info');
        var tx = await window.contracts.gmeBattle.vote(Number(battleId), side, {
            gasLimit: 300000
        });
        showMessage('Vote submitted! Waiting for confirmation...', 'info');
        await tx.wait();
        showMessage('Vote successful!', 'success');
        loadGmeBattleArena();
    } catch (error) {
        console.error('Vote error:', error);
        showMessage('Failed to vote: ' + (error.reason || error.message), 'error');
    }
}

// Handle End GME Battle
async function handleEndGmeBattle(battleId) {
    if (!window.signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    try {
        showMessage('Ending battle and claiming rewards...', 'info');
        var tx = await window.contracts.gmeBattle.endBattle(Number(battleId), {
            gasLimit: 500000
        });
        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();
        showMessage('Battle ended! Rewards have been distributed.', 'success');
        loadGmeBattleArena();
        window.closeGmeBattleDetail();
    } catch (error) {
        console.error('End battle error:', error);
        showMessage('Failed to end battle: ' + (error.reason || error.message), 'error');
    }
}

// Expose functions to window
window.loadGmeBattleNFTSelect = loadGmeBattleNFTSelect;
window.loadGmeBattleArena = loadGmeBattleArena;
window.viewGmeBattleDetail = window.viewGmeBattleDetail;
window.closeGmeBattleDetail = window.closeGmeBattleDetail;
window.handleJoinGmeBattle = handleJoinGmeBattle;
window.handleGmeVote = handleGmeVote;
window.handleEndGmeBattle = handleEndGmeBattle;

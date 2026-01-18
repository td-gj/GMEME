import './style.css';
import { ethers } from 'ethers';
import { CONTRACTS, NETWORK, ABIS } from './config.js';
import { uploadToPinata, uploadMetadataToPinata } from './pinata.js';

// Global state
let provider = null;
let signer = null;
let userAddress = null;
let contracts = {};
let uploadedImageHash = null;

// Optimization: Metadata cache
const fighterCache = {};
let arenaRefreshTimer = null;
let countdownInterval = null;
let statsRefreshTimer = null;

// Stats cache
let statsCache = {
    totalNFTs: null,
    totalBattles: null,
    activeBattles: null,
    totalVolume: null,
    lastUpdate: null
};
// total POL raised in swap
statsCache.totalPolRaised = null;

// Global Image Error Handler (Smart Retry)
window.handleImageError = function (img) {
    const ipfsHash = img.dataset.ipfs;
    if (!ipfsHash) return;

    const gateways = [
        'https://cloudflare-ipfs.com/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://dweb.link/ipfs/',
        'https://gateway.pinata.cloud/ipfs/'
    ];

    let currentIndex = parseInt(img.dataset.gatewayIndex || "0");
    currentIndex++; // Try next gateway

    if (currentIndex < gateways.length) {
        img.dataset.gatewayIndex = currentIndex;
        const nextUrl = `${gateways[currentIndex]}${ipfsHash}`;
        img.src = nextUrl;
    } else {
        img.onerror = null; // Stop looping
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkWalletConnection();
    loadPlatformStats(); // Load stats immediately

    // Check hash for direct link or default tab
    setTimeout(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#battle/')) {
            const id = hash.split('/')[1];
            switchTab('activebattles');
            viewBattleDetail(id);
        } else {
            switchTab('activebattles');
        }
    }, 500);

    // Auto refresh stats every hour
    statsRefreshTimer = setInterval(loadPlatformStats, 60 * 60 * 1000);
    // Initialize space scene interactions
    initializeSpaceScene();
    // Initialize canvas starfield
    initializeStarCanvas();
});

// Event Listeners
function initializeEventListeners() {
    // Wallet
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Swap
    document.getElementById('swapAmount').addEventListener('input', updateSwapEstimate);
    document.getElementById('swapBtn').addEventListener('click', handleSwap);
    document.getElementById('switchSwapDirectionBtn').addEventListener('click', toggleSwapDirection);

    // Mint
    document.getElementById('uploadImageBtn').addEventListener('click', () => {
        document.getElementById('nftImageFile').click();
    });
    document.getElementById('nftImageFile').addEventListener('change', handleImageUpload);
    document.getElementById('mintBtn').addEventListener('click', handleMint);

    // Battle
    document.getElementById('joinBattleBtn').addEventListener('click', handleJoinBattle);

    // Docs modal (in-app)
    const docsBtn = document.getElementById('docsBtn');
    const docsModal = document.getElementById('docsModal');
    const docsClose = document.getElementById('docsModalClose');
    const docsBackdrop = document.getElementById('docsModalBackdrop');
    if (docsBtn && docsModal) {
        docsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            docsModal.classList.remove('hidden');
            docsModal.setAttribute('aria-hidden', 'false');
        });
    }
    if (docsClose && docsModal) {
        docsClose.addEventListener('click', () => {
            docsModal.classList.add('hidden');
            docsModal.setAttribute('aria-hidden', 'true');
        });
    }
    if (docsBackdrop && docsModal) {
        docsBackdrop.addEventListener('click', () => {
            docsModal.classList.add('hidden');
            docsModal.setAttribute('aria-hidden', 'true');
        });
    }
}

// Wallet Functions
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    }
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showMessage('Please install MetaMask to use this app!', 'error');
        return;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Check if on correct network
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== NETWORK.chainId) {
            await switchNetwork();
        }

        // Initialize provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = accounts[0];

        // Initialize contracts
        contracts.token = new ethers.Contract(CONTRACTS.TOKEN, ABIS.TOKEN, signer);
        contracts.nft = new ethers.Contract(CONTRACTS.NFT, ABIS.NFT, signer);
        contracts.swap = new ethers.Contract(CONTRACTS.SWAP, ABIS.SWAP, signer);
        contracts.battle = new ethers.Contract(CONTRACTS.BATTLE, ABIS.BATTLE, signer);

        // Update UI
        updateWalletUI();
        await updateBalances();
        loadActiveBattles(); // Load arena immediately



        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showMessage('Failed to connect wallet: ' + error.message, 'error');
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK.chainId }],
        });
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [NETWORK],
                });
            } catch (addError) {
                throw new Error('Failed to add Polygon Amoy network');
            }
        } else {
            throw switchError;
        }
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        window.location.reload();
    }
}

function disconnectWallet() {
    provider = null;
    signer = null;
    userAddress = null;
    contracts = {};

    // Show Login View
    const walletSection = document.getElementById('walletSection');
    const appContent = document.getElementById('appContent');

    if (walletSection) walletSection.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');
    const headerInfo = document.getElementById('headerWalletInfo');
    if (headerInfo) headerInfo.classList.add('hidden');

    showMessage('Wallet disconnected', 'info');
}

function updateWalletUI() {
    // Show App View
    const walletSection = document.getElementById('walletSection');
    const appContent = document.getElementById('appContent');

    if (walletSection) walletSection.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');

    const headerInfo = document.getElementById('headerWalletInfo');
    if (headerInfo) headerInfo.classList.remove('hidden');

    const addrEl = document.getElementById('walletAddress');
    if (addrEl) addrEl.textContent = `Connected: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
}

async function updateBalances() {
    try {
        // POL Balance
        const polBalance = await provider.getBalance(userAddress);
        document.getElementById('polBalance').textContent = parseFloat(ethers.formatEther(polBalance)).toFixed(2);

        // GMEME Balance
        const gmemeBalance = await contracts.token.balanceOf(userAddress);
        document.getElementById('gmemeBalance').textContent = parseFloat(ethers.formatEther(gmemeBalance)).toFixed(2);

        // NFT Count
        const nftCount = await contracts.nft.balanceOf(userAddress);
        document.getElementById('nftCount').textContent = nftCount.toString();

    } catch (error) {
        console.error('Error updating balances:', error);
    }
}

// Tab Switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-content`).classList.remove('hidden');

    // Load data for specific tabs
    if (tabName === 'mynfts') {
        loadMyNFTs();
    } else if (tabName === 'activebattles') {
        loadActiveBattles();
    } else if (tabName === 'battle') {
        loadBattleNFTSelect();
    } else if (tabName === 'leaderboard') {
        loadLeaderboard();
    } else if (tabName === 'mylive') {
        loadMyLiveArena();
    }
}

// Leaderboard Function
async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem;">Loading rankings (Batching)...</td></tr>';

    try {
        if (!contracts.nft) await initContracts();

        let total = 0;
        try {
            total = Number(await contracts.nft.totalSupply());
        } catch (e) {
            console.warn("TotalSupply not supported or failed, using fallback...");
            total = 50;
        }

        // Limit to prevent RPC spam
        const MAX_SCAN = 20;
        const scanCount = Math.min(total, MAX_SCAN);

        const validFighters = [];
        const BATCH_SIZE = 5;

        for (let i = 1; i <= scanCount; i += BATCH_SIZE) {
            const batchPromises = [];
            const end = Math.min(i + BATCH_SIZE - 1, scanCount);

            for (let id = i; id <= end; id++) {
                batchPromises.push((async () => {
                    try {
                        const elo = await contracts.nft.getElo(id);
                        const owner = await contracts.nft.ownerOf(id);
                        const uri = await contracts.nft.tokenURI(id);

                        let name = `Fighter #${id}`;
                        let image = '';

                        try {
                            const gw = 'https://dweb.link/ipfs/';
                            const cleanUri = uri.replace('ipfs://', '');
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

                            const meta = await fetch(gw + cleanUri, { signal: controller.signal })
                                .then(r => r.json())
                                .catch(() => ({}));
                            clearTimeout(timeoutId);

                            if (meta.name) name = meta.name;
                            if (meta.image) image = meta.image.replace('ipfs://', gw);
                        } catch (err) { }

                        return { id, elo: Number(elo), owner, name, image };
                    } catch (e) {
                        return null;
                    }
                })());
            }

            // Wait for batch
            const results = await Promise.all(batchPromises);
            results.forEach(f => { if (f) validFighters.push(f); });

            // Update Progress
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 2rem;">Loaded ${validFighters.length}/${scanCount} fighters...</td></tr>`;
        }

        // Sort: High ELO first
        validFighters.sort((a, b) => b.elo - a.elo);

        if (validFighters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No fighters found.</td></tr>';
            return;
        }

        // Render Top 100
        tbody.innerHTML = validFighters.map((f, index) => {
            let rankDisplay = `#${index + 1}`;
            let rowStyle = '';
            let rankColor = 'white';

            if (index === 0) { rankDisplay = '🥇 1st'; rowStyle = 'background: rgba(255, 215, 0, 0.1);'; rankColor = '#fbbf24'; }
            else if (index === 1) { rankDisplay = '🥈 2nd'; rowStyle = 'background: rgba(192, 192, 192, 0.1);'; rankColor = '#e5e7eb'; }
            else if (index === 2) { rankDisplay = '🥉 3rd'; rowStyle = 'background: rgba(205, 127, 50, 0.1);'; rankColor = '#b45309'; }

            const fallbackImg = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${f.id}`;

            return `
            <tr style="border-bottom: 1px solid var(--glass-border); ${rowStyle}">
                <td style="padding: 1rem; font-weight: bold; font-size: 1.1rem; color: ${rankColor};">${rankDisplay}</td>
                <td style="padding: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${f.image || fallbackImg}" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 1px solid var(--glass-border);" onerror="this.src='${fallbackImg}'">
                        <div>
                            <div style="font-weight: bold;">${f.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">ID: #${f.id}</div> 
                        </div>
                    </div>
                </td>
                <td style="padding: 1rem; font-weight: 800; font-family: var(--font-display); color: var(--accent); font-size: 1.2rem;">${f.elo}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-muted); opacity: 0.8;">${f.owner.substring(0, 6)}...${f.owner.substring(38)}</td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Leaderboard error:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: #ef4444; padding: 2rem;">Unable to load leaderboard. <br><small>${error.message}</small></td></tr>`;
    }
}

// Swap Functions
let isBuyingGMEME = true;

function updateSwapEstimate() {
    const amount = parseFloat(document.getElementById('swapAmount').value) || 0;

    if (isBuyingGMEME) {
        // Buy: Pay POL -> Get GMEME (Amount / 6)
        // Rate: 1 GMEME = 6 POL => GMEME = POL / 6
        const estimate = amount / 6;
        document.getElementById('swapEstimate').textContent = estimate.toFixed(4) + ' GMEME';
    } else {
        // Sell: Pay GMEME -> Get POL (Amount * 6)
        const estimate = amount * 6;
        document.getElementById('swapEstimate').textContent = estimate.toFixed(4) + ' POL';
    }
}

function toggleSwapDirection() {
    isBuyingGMEME = !isBuyingGMEME;

    if (isBuyingGMEME) {
        document.getElementById('swapInputLabel').textContent = 'You Pay (POL)';
        document.getElementById('swapOutputLabel').textContent = 'You Get (GMEME Estimate)';
        document.getElementById('swapRateDisplay').textContent = '6 POL = 1 GMEME';
        document.getElementById('swapBtn').textContent = 'Buy GMEME';
        document.getElementById('swapBtn').style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
    } else {
        document.getElementById('swapInputLabel').textContent = 'You Sell (GMEME)';
        document.getElementById('swapOutputLabel').textContent = 'You Get (POL Estimate)';
        document.getElementById('swapRateDisplay').textContent = '1 GMEME = 6 POL';
        document.getElementById('swapBtn').textContent = 'Sell GMEME';
        document.getElementById('swapBtn').style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
    }
    updateSwapEstimate();
}

async function handleSwap() {
    const swapBtn = document.getElementById('swapBtn');
    const originalText = swapBtn.textContent;

    if (!signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    const amount = document.getElementById('swapAmount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showMessage('Please enter a valid amount', 'error');
        return;
    }

    try {
        // Disable button and show processing
        swapBtn.disabled = true;
        swapBtn.textContent = 'Processing...';

        if (isBuyingGMEME) {
            // BUY Logic (POL -> GMEME)
            const feeData = await provider.getFeeData();
            const txOptions = { value: ethers.parseEther(amount) };
            if (feeData.gasPrice) txOptions.gasPrice = feeData.gasPrice;

            const tx = await contracts.swap.swapPOLToGMEME(txOptions);
            swapBtn.textContent = 'Confirming Buy...';
            await tx.wait();
        } else {
            // SELL Logic (GMEME -> POL)
            const amountWei = ethers.parseEther(amount);

            // Check Allowance First
            const allowance = await contracts.token.allowance(userAddress, CONTRACTS.SWAP);
            if (allowance < amountWei) {
                swapBtn.textContent = 'Approving...';
                const approveTx = await contracts.token.approve(CONTRACTS.SWAP, ethers.parseEther('1000000'));
                await approveTx.wait();
                swapBtn.textContent = 'Processing Sell...';
            }

            const tx = await contracts.swap.swapGMEMEToPOL(amountWei);
            swapBtn.textContent = 'Confirming Sell...';
            await tx.wait();
        }

        showMessage('Swap successful!', 'success');
        await updateBalances();
        document.getElementById('swapAmount').value = '';
        updateSwapEstimate();
    } catch (error) {
        console.error('Swap error:', error);
        showMessage('Swap failed: ' + (error.reason || error.message), 'error');
    } finally {
        swapBtn.disabled = false;
        swapBtn.textContent = originalText;
    }
}

// Mint Functions
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showMessage('Image size must be less than 10MB', 'error');
        return;
    }

    try {
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // Store file for later upload (when minting)
        uploadedImageHash = file; // Store the File object
        document.getElementById('uploadStatus').textContent = '✅ Image ready to upload';
        showMessage('Image selected! Will upload when you mint.', 'success');

    } catch (error) {
        console.error('Image selection error:', error);
        showMessage('Failed to select image: ' + error.message, 'error');
        document.getElementById('uploadStatus').textContent = '❌ Selection failed';
        uploadedImageHash = null;
    }
}

async function handleMint() {
    if (!signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    const name = document.getElementById('nftName').value.trim();

    if (!name) {
        showMessage('Please enter a fighter name', 'error');
        return;
    }

    if (!uploadedImageHash) {
        showMessage('Please upload an image first', 'error');
        return;
    }

    try {
        // Check GMEME balance first
        const gmemeBalance = await contracts.token.balanceOf(userAddress);
        const mintCost = ethers.parseEther('1');


        if (gmemeBalance < mintCost) {
            showMessage(`Insufficient GMEME balance! You need 1 GMEME but have ${ethers.formatEther(gmemeBalance)}`, 'error');
            return;
        }

        showMessage('Uploading to IPFS (via Pinata)...', 'info');

        // Note: We use Pinata because it is currently the most stable option with our setup
        const imageResult = await uploadToPinata(uploadedImageHash);

        if (!imageResult.success) {
            throw new Error(imageResult.error || 'Failed to upload image');
        }



        const metadata = {
            name: name,
            description: `GMEME Fighter: ${name}`,
            image: `ipfs://${imageResult.ipfsHash}`,
            attributes: [
                { trait_type: "ELO", value: 0 },
                { trait_type: "Rank", value: "Bronze" }
            ]
        };

        const metadataResult = await uploadMetadataToPinata(metadata);

        if (!metadataResult.success) {
            throw new Error(metadataResult.error || 'Failed to upload metadata');
        }

        const tokenURI = `ipfs://${metadataResult.ipfsHash}`;

        showMessage('Checking allowance...', 'info');

        // Check allowance
        const allowance = await contracts.token.allowance(userAddress, CONTRACTS.NFT);

        if (allowance < mintCost) {
            showMessage('Approving GMEME spending...', 'info');

            try {
                // Use a more conservative gas limit
                const approveTx = await contracts.token.approve(CONTRACTS.NFT, ethers.parseEther('1000'), {
                    gasLimit: 100000
                });
                showMessage('Waiting for approval confirmation...', 'info');
                await approveTx.wait();
                showMessage('Approval confirmed!', 'success');
            } catch (approveError) {
                console.error('Approve error details:', approveError);

                // Check if it's a user rejection
                if (approveError.code === 'ACTION_REJECTED' || approveError.code === 4001) {
                    throw new Error('Transaction rejected by user');
                }

                // Try to get more details
                if (approveError.data) {
                    console.error('Error data:', approveError.data);
                }

                throw new Error(`Approval failed: ${approveError.shortMessage || approveError.message}`);
            }
        } else {
            // Allowance sufficient
        }

        showMessage('Minting NFT... This may take 10-30 seconds.', 'info');

        // Try mint with retry logic
        let mintTx;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                attempts++;


                // Use legacy gas pricing (Polygon Amoy doesn't support EIP-1559)
                const feeData = await provider.getFeeData();

                const txOptions = {
                    gasLimit: 500000
                };

                // Use legacy gasPrice instead of EIP-1559
                if (feeData.gasPrice) {
                    txOptions.gasPrice = feeData.gasPrice;
                }

                mintTx = await contracts.nft.mint(tokenURI, txOptions);

                break; // Success, exit retry loop

            } catch (mintError) {
                console.error(`Attempt ${attempts} failed:`, mintError.message);

                if (attempts >= maxAttempts) {
                    throw mintError;
                }

                // Wait before retry
                showMessage(`Retrying... (${attempts}/${maxAttempts})`, 'info');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!mintTx) {
            throw new Error('Failed to submit transaction after multiple attempts');
        }

        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        const receipt = await mintTx.wait();

        showMessage('NFT minted successfully! 🎉', 'success');
        await updateBalances();

        // Reset form
        document.getElementById('nftName').value = '';
        document.getElementById('nftImageFile').value = '';
        document.getElementById('imagePreview').classList.add('hidden');
        document.getElementById('uploadStatus').textContent = '';
        uploadedImageHash = null;

    } catch (error) {
        console.error('Mint error:', error);

        // Better error messages
        let errorMessage = 'Mint failed: ';

        if (error.message.includes('insufficient funds')) {
            errorMessage += 'Insufficient POL for gas fees. Get testnet POL from https://faucet.polygon.technology/';
        } else if (error.message.includes('user rejected') || error.code === 4001) {
            errorMessage += 'Transaction rejected by user';
        } else if (error.message.includes('Internal JSON-RPC')) {
            errorMessage += 'RPC error. Please try: 1) Reset Metamask account, or 2) Change RPC URL in Metamask settings';
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
            errorMessage += 'Insufficient POL for gas fees';
        } else if (error.reason) {
            errorMessage += error.reason;
        } else if (error.shortMessage) {
            errorMessage += error.shortMessage;
        } else {
            errorMessage += error.message;
        }

        showMessage(errorMessage, 'error');
    }
}

// NFT Functions
async function loadMyNFTs() {
    if (!signer) {
        document.getElementById('nftGrid').innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Please connect your wallet</p>';
        return;
    }

    try {
        document.getElementById('nftGrid').innerHTML = '<div class="loading"><div class="spinner"></div><p style="margin-top: 1rem;">Loading your NFTs...</p></div>';

        const balance = await contracts.nft.balanceOf(userAddress);

        if (balance == 0) {
            document.getElementById('nftGrid').innerHTML = '<p class="text-center" style="color: var(--text-secondary);">You don\'t have any NFTs yet. Mint your first fighter!</p>';
            return;
        }



        // Simple approach: Check ownership for token IDs 1-100
        // Most users won't have NFTs beyond this range
        const maxTokenId = 100;
        const nfts = [];

        for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
            try {
                const owner = await contracts.nft.ownerOf(tokenId);

                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    const tokenURI = await contracts.nft.tokenURI(tokenId);
                    const elo = await contracts.nft.getElo(tokenId);
                    const rank = await contracts.nft.getRank(tokenId);

                    // Fetch metadata from IPFS
                    let nftName = `Fighter #${tokenId}`;
                    let imageUrl = null;
                    let ipfsImageHash = null;

                    // Multiple IPFS gateways (fallback if one fails)
                    const gateways = [
                        'https://dweb.link/ipfs/',         // Verified Working ✅
                        'https://cloudflare-ipfs.com/ipfs/', // Cloudflare (Full domain)
                        'https://ipfs.io/ipfs/',           // Standard
                        'https://gateway.pinata.cloud/ipfs/' // Pinata default
                    ];

                    // Convert IPFS URI to gateway URL for tokenURI
                    if (tokenURI.startsWith('ipfs://')) {
                        const ipfsHash = tokenURI.replace('ipfs://', '');

                        // Try each gateway until one works
                        for (const gateway of gateways) {
                            try {
                                const metadataUrl = `${gateway}${ipfsHash}`;

                                const metadataResponse = await fetch(metadataUrl, {
                                    method: 'GET',
                                    headers: {
                                        'Accept': 'application/json'
                                    }
                                });

                                if (metadataResponse.ok) {
                                    const metadata = await metadataResponse.json();

                                    // Get name from metadata
                                    nftName = metadata.name || nftName;

                                    // Get image and convert IPFS URI to gateway URL
                                    if (metadata.image) {
                                        if (metadata.image.startsWith('ipfs://')) {
                                            ipfsImageHash = metadata.image.replace('ipfs://', '');
                                            // Use the same gateway that worked for metadata
                                            imageUrl = `${gateway}${ipfsImageHash}`;
                                        } else {
                                            imageUrl = metadata.image;
                                        }
                                    }

                                    break; // Success, stop trying other gateways
                                }
                            } catch (e) {
                                // Continue to next gateway
                            }
                        }

                        // If all gateways failed, use first gateway as fallback for image
                        if (!imageUrl) {
                            imageUrl = `${gateways[0]}${ipfsHash}`;
                            // Assume image hash is same if we couldn't load metadata (heuristic)
                            // or just leave it null if strictly metadata failed.
                        }
                    } else {
                        // Not an IPFS URI, use as-is
                        imageUrl = tokenURI;
                    }

                    nfts.push({
                        tokenId: tokenId.toString(),
                        image: imageUrl,
                        name: nftName,
                        elo: elo.toString(),
                        rank: rank,
                        ipfsHash: ipfsImageHash // Store hash for retry
                    });

                    // Stop if we found all NFTs
                    if (nfts.length >= balance) {
                        break;
                    }
                }
            } catch (error) {
                // Token doesn't exist or not owned, continue
            }
        }

        displayNFTs(nfts);

    } catch (error) {
        console.error('Error loading NFTs:', error);
        document.getElementById('nftGrid').innerHTML = '<p class="text-center" style="color: var(--danger);">Error loading NFTs. Please refresh the page.</p>';
    }
}

function displayNFTs(nfts) {
    const grid = document.getElementById('nftGrid');

    if (nfts.length === 0) {
        grid.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No NFTs found</p>';
        return;
    }

    grid.innerHTML = nfts.map(nft => {
        // Create a simple SVG fallback image
        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`
            <svg width="280" height="280" xmlns="http://www.w3.org/2000/svg">
                <rect width="280" height="280" fill="#8b5cf6"/>
                <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
                    Fighter #${nft.tokenId}
                </text>
            </svg>
        `)}`;

        return `
        <div class="nft-card">
          <img src="${nft.image}" 
               alt="${nft.name}" 
               class="nft-image" 
               data-ipfs="${nft.ipfsHash || ''}"
               data-gateway-index="0"
               onerror="handleImageError(this)" 
               data-fallback="${fallbackSvg}"
          >
          <div class="nft-info">
            <div class="nft-name">${nft.name}</div>
            <div class="nft-stats">
              <div class="stat">
                <div class="stat-label">Token ID</div>
                <div class="stat-value">#${nft.tokenId}</div>
              </div>
              <div class="stat">
                <div class="stat-label">ELO</div>
                <div class="stat-value">${nft.elo}</div>
              </div>
            </div>
            <div class="text-center mt-2">
              <span class="rank-badge rank-${nft.rank.toLowerCase()}">${nft.rank}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
}

// Battle Functions
async function loadBattleNFTSelect() {
    if (!signer) return;

    try {
        const select = document.getElementById('battleNftSelect');
        select.innerHTML = '<option value="">-- Select NFT --</option>';

        const balance = await contracts.nft.balanceOf(userAddress);

        if (balance == 0) {
            select.innerHTML = '<option value="">No NFTs available</option>';
            return;
        }

        // Check ownership for token IDs 1-100
        const maxTokenId = 100;
        let foundCount = 0;

        for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
            try {
                const owner = await contracts.nft.ownerOf(tokenId);

                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    const elo = await contracts.nft.getElo(tokenId);
                    const rank = await contracts.nft.getRank(tokenId);

                    const option = document.createElement('option');
                    option.value = tokenId.toString();
                    option.textContent = `Fighter #${tokenId} - ${rank} (ELO: ${elo})`;
                    select.appendChild(option);

                    foundCount++;
                    if (foundCount >= balance) {
                        break;
                    }
                }
            } catch (error) {
                // Token doesn't exist or not owned, continue
            }
        }

    } catch (error) {
        console.error('Error loading NFTs for battle:', error);
    }
}

async function handleJoinBattle() {
    if (!signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    const tokenId = document.getElementById('battleNftSelect').value;
    if (!tokenId) {
        showMessage('Please select an NFT', 'error');
        return;
    }

    try {
        showMessage('Approving GMEME spending...', 'info');

        const allowance = await contracts.token.allowance(userAddress, CONTRACTS.BATTLE);
        const betAmount = ethers.parseEther('10');

        // Check GMEME balance
        const balance = await contracts.token.balanceOf(userAddress);
        if (balance < betAmount) {
            showMessage(`Insufficient GMEME! Need 10 GMEME to join.`, 'error');
            return;
        }

        if (allowance < betAmount) {
            const approveTx = await contracts.token.approve(CONTRACTS.BATTLE, ethers.parseEther('10000'), {
                gasLimit: 100000
            });
            await approveTx.wait();
        }

        showMessage('Joining battle...', 'info');
        const tx = await contracts.battle.joinBattle(tokenId, {
            gasLimit: 500000 // Increase gas limit
        });
        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();

        showMessage('Successfully joined battle queue!', 'success');
        await updateBalances();

    } catch (error) {
        console.error('Join battle error:', error);
        showMessage('Failed to join battle: ' + (error.reason || error.message), 'error');
    }
}

// My Live Arena - temporary stub (replaced complex rendering to avoid build parse issues)
async function loadMyLiveArena() {
    const container = document.getElementById('myBattleList');
    if (!container) return;

    if (!signer) {
        container.innerHTML = '<p class="text-center" style="color: var(--text-muted);">Please connect your wallet</p>';
        return;
    }

    try {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p style="margin-top: 1rem;">Loading your battles...</p></div>';

        // Simple safe implementation: fetch nextBattleId and list battle ids that include user's token IDs later.
        const nextBattleId = Number(await contracts.battle.nextBattleId());
        const startId = Math.max(1, nextBattleId - 50); // small scan to keep fast
        const found = [];

        for (let i = startId; i < nextBattleId; i++) {
            try {
                const battle = await contracts.battle.battles(i);
                if (!battle) continue;
                // quick string search: check tokenId fields as string for user's token ids
                const p1 = String(battle.p1TokenId);
                const p2 = String(battle.p2TokenId);
                // if user owns either token, we'll show the battle id (detailed view still available)
                // ownership check deferred to detailed view to avoid heavy scanning here
                found.push({ id: Number(battle.id), p1TokenId: p1, p2TokenId: p2, ended: Boolean(battle.ended), startTime: Number(battle.startTime) });
            } catch (e) {
                // ignore errors
            }
        }

        if (found.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--text-muted);">No active battles found for your NFTs (or scan limited).</p>';
            return;
        }

        // Render a minimal list (avoid template literals spanning many lines)
        container.innerHTML = '';
        found.forEach(b => {
            const card = document.createElement('div');
            card.className = 'card battle-card';
            card.style.padding = '1rem';
            card.style.marginBottom = '1rem';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.innerHTML = `<div style="font-weight:700;">Battle #${b.id}</div><div style="color:var(--text-muted); font-size:0.9rem;">${new Date(b.startTime*1000).toLocaleString()}</div>`;
            card.appendChild(header);

            const status = document.createElement('div');
            status.style.textAlign = 'right';
            status.style.marginTop = '0.75rem';
            status.innerHTML = b.ended ? '<span class="status-ended">Ended</span>' : '<span class="status-active">Active</span>';
            card.appendChild(status);

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading my battles (stub):', error);
        container.innerHTML = '<p class="text-center" style="color: var(--danger);">Failed to load your battles.</p>';
    }
}

async function loadActiveBattles() {
    if (!signer) {
        document.getElementById('battleList').innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Please connect your wallet</p>';
        return;
    }

    try {
        document.getElementById('battleList').innerHTML = '<div class="loading"><div class="spinner"></div><p style="margin-top: 1rem;">Loading battles...</p></div>';

        const nextBattleId = await contracts.battle.nextBattleId();
        const battles = [];

        // Load last 10 battles
        const startId = nextBattleId > 10 ? nextBattleId - 10 : 1;
        for (let i = startId; i < nextBattleId; i++) {
            try {
                const battle = await contracts.battle.battles(i);
                if (battle.id > 0) {
                    // Get vote counts directly from contract (more reliable than event scan)
                    let p1Votes = 0;
                    let p2Votes = 0;
                    try {
                        const counts = await contracts.battle.getVoteCounts(Number(battle.id));
                        p1Votes = Number(counts[0]);
                        p2Votes = Number(counts[1]);
                    } catch (e) {
                        console.warn('getVoteCounts failed for battle', Number(battle.id), e);
                        // fallback remains zero
                    }

                    // Optimized Fetch images and names
                    let p1Image = '';
                    let p2Image = '';
                    let p1Name = `Fighter #${battle.p1TokenId}`;
                    let p2Name = `Fighter #${battle.p2TokenId}`;

                    async function getFighterData(tokenId) {
                        if (fighterCache[tokenId]) return fighterCache[tokenId];
                        try {
                            const uri = await contracts.nft.tokenURI(tokenId);
                            const gw = 'https://dweb.link/ipfs/';
                            const clean = uri.replace('ipfs://', '');
                            const meta = await fetch(`${gw}${clean}`).then(r => r.json());
                            const image = meta.image ? meta.image.replace('ipfs://', gw) : '';
                            const name = meta.name || `Fighter #${tokenId}`;
                            fighterCache[tokenId] = { image, name };
                            return fighterCache[tokenId];
                        } catch (e) {
                            return { image: '', name: `Fighter #${tokenId}` };
                        }
                    }

                    const [f1, f2] = await Promise.all([
                        getFighterData(battle.p1TokenId),
                        getFighterData(battle.p2TokenId)
                    ]);

                    p1Image = f1.image;
                    p1Name = f1.name;
                    p2Image = f2.image;
                    p2Name = f2.name;

                    battles.push({
                        id: battle.id.toString(),
                        p1TokenId: battle.p1TokenId.toString(),
                        p2TokenId: battle.p2TokenId.toString(),
                        p1Owner: battle.p1Owner,
                        p2Owner: battle.p2Owner,
                        startTime: Number(battle.startTime),
                        ended: battle.ended,
                        p1Votes: p1Votes,
                        p2Votes: p2Votes,
                        p1Image: p1Image,
                        p2Image: p2Image,
                        p1Name: p1Name,
                        p2Name: p2Name
                    });
                }
            } catch (error) {
                console.warn(`Error loading battle ${i}:`, error);
            }
        }

        // Batch-fetch vote counts for the loaded battles to avoid per-battle RPC calls.
        if (battles.length > 0) {
            try {
                const ids = battles.map(b => Number(b.id));
                const counts = await contracts.battle.getVoteCountsBatch(ids);
                // counts[0] = p1 array, counts[1] = p2 array
                const p1Arr = counts[0];
                const p2Arr = counts[1];
                for (let j = 0; j < battles.length; j++) {
                    battles[j].p1Votes = Number(p1Arr[j] || 0);
                    battles[j].p2Votes = Number(p2Arr[j] || 0);
                }
            } catch (e) {
                console.warn('getVoteCountsBatch failed:', e);
            }
        }

        displayBattles(battles.reverse());

        // Setup Auto Refresh if not already set
        if (!arenaRefreshTimer) {
            arenaRefreshTimer = setInterval(() => {
                if (document.querySelector('[data-tab="activebattles"]').classList.contains('active')) {
                    loadActiveBattles();
                }
            }, 30000); // 30 sec auto-refresh for votes/new battles
        }

        // Setup Countdown Interval if not already set
        if (!countdownInterval) {
            countdownInterval = setInterval(updateAllTimers, 1000);
        }

    } catch (error) {
        console.error('Error loading battles:', error);
        document.getElementById('battleList').innerHTML = '<p class="text-center" style="color: var(--danger);">Error loading battles</p>';
    }
}

// Detail View Logic
window.viewBattleDetail = function (id) {
    const activeContent = document.getElementById('activebattles-content');
    const detailView = document.getElementById('battle-detail-view');
    const detailCard = document.getElementById('battle-detail-card');

    activeContent.classList.add('hidden');
    detailView.classList.remove('hidden');

    // Find battle data
    const battle = window.loadedBattles ? window.loadedBattles.find(b => b.id === id) : null;

    if (!battle) {
        detailCard.innerHTML = `<div class="text-center" style="padding: 3rem;"><h3>Battle #${id} Not Found</h3><p class="text-muted">Please refresh the arena list.</p></div>`;
        return;
    }

    const p1Votes = battle.p1Votes || 0;
    const p2Votes = battle.p2Votes || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Math.max(0, (battle.startTime + 86400) - now);
    const isActive = !battle.ended && timeLeft > 0;

    const fallbackSvg = `data:image/svg+xml,${encodeURIComponent('<svg width="280" height="280" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="280" fill="#333"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">?</text></svg>')}`;

    detailCard.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h2 style="font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(to right, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Battle Arena #${battle.id}</h2>
            <div style="font-size: 1.2rem; font-weight: bold; color: ${isActive ? '#10b981' : '#ef4444'}">
                ${isActive ? '🔥 BATTLE IN PROGRESS' : '🏁 BATTLE ENDED'}
            </div>
            <div style="color: var(--text-muted); margin-top: 0.5rem;">Started: ${new Date(battle.startTime * 1000).toLocaleString()}</div>
        </div>

        <div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 2rem;">
             <!-- P1 -->
             <div style="text-align: center; flex: 1; min-width: 200px;">
                 <div class="active-battle-img-container" style="width: 150px; height: 150px; margin-bottom: 1rem; border-color: #8b5cf6;">
                    <img src="${battle.p1Image || fallbackSvg}" class="active-battle-img" onerror="this.src='${fallbackSvg}'">
                 </div>
                 <h3 style="font-size: 1.8rem;">Fighter #${battle.p1TokenId}</h3>
                 <div style="color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin: 0.5rem 0;">Owner: ${battle.p1Owner.slice(0, 6)}...${battle.p1Owner.slice(-4)}</div>
                 <div style="font-size: 2.5rem; font-weight: 800; color: white; margin-top: 0.5rem; text-shadow: 0 0 10px rgba(139, 92, 246, 0.5);">${p1Votes} Votes</div>
             </div>
             
             <div class="vs" style="font-size: 4rem;">VS</div>

             <!-- P2 -->
             <div style="text-align: center; flex: 1; min-width: 200px;">
                 <div class="active-battle-img-container" style="width: 150px; height: 150px; margin-bottom: 1rem; border-color: #ec4899;">
                    <img src="${battle.p2Image || fallbackSvg}" class="active-battle-img" onerror="this.src='${fallbackSvg}'">
                 </div>
                 <h3 style="font-size: 1.8rem;">Fighter #${battle.p2TokenId}</h3>
                 <div style="color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin: 0.5rem 0;">Owner: ${battle.p2Owner.slice(0, 6)}...${battle.p2Owner.slice(-4)}</div>
                 <div style="font-size: 2.5rem; font-weight: 800; color: white; margin-top: 0.5rem; text-shadow: 0 0 10px rgba(236, 72, 153, 0.5);">${p2Votes} Votes</div>
             </div>
        </div>
        
                    <div style="background: var(--bg-glass); padding: 2rem; border-radius: 16px; margin-bottom: 2rem; border: 1px solid var(--glass-border);">
            <h4 style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem; font-size: 1.2rem;">📊 Battle Statistics</h4>
             <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                <span class="text-muted">Total Prize Pool</span> <span style="color: #10b981; font-weight: bold;">18 GMEME</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                <span class="text-muted">Voter Win Rewards Pool</span> <span style="color: #ec4899; font-weight: bold;">1 GMEME</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                <span class="text-muted">Voter Lose Rewards Pool</span> <span style="color: #f59e0b; font-weight: bold;">0.2 GMEME</span>
            </div>
             <div style="display: flex; justify-content: space-between;">
                <span class="text-muted">Protocol Fee</span> <span class="text-muted">0.8 GMEME</span>
            </div>
        </div>

        ${isActive ? `
            <div style="margin-top: 2rem; text-align: center;">
                <p style="margin-bottom: 1.5rem; font-size: 1.1rem;">Cast your vote to influence the outcome and win rewards!</p>
                <div style="display: flex; gap: 1.5rem; justify-content: center;">
                    <button class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem;" onclick="handleVote(${battle.id}, 1)">Vote Fighter #${battle.p1TokenId}</button>
                    <button class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem; background: linear-gradient(135deg, #ec4899, #be185d);" onclick="handleVote(${battle.id}, 2)">Vote Fighter #${battle.p2TokenId}</button>
                </div>
            </div>
        ` : `
            <div class="text-center">
                 <button class="btn btn-secondary" onclick="handleEndBattle(${battle.id})" ${battle.ended ? 'disabled' : ''}>
                  ${battle.ended ? '✅ Rewards Distributed' : '🎁 End Battle & Claim Rewards'}
                </button>
            </div>
        `}
    `;

    // Simple URL update
    window.location.hash = `battle/${id}`;
};

// NEW: Real-time timer update engine
function updateAllTimers() {
    const now = Math.floor(Date.now() / 1000);

    // Update Battle Cards in Arena
    if (window.loadedBattles) {
        window.loadedBattles.forEach(battle => {
            const timeLeft = Math.max(0, (battle.startTime + 86400) - now);
            const isActive = !battle.ended && timeLeft > 0;

            // Update Card Timers
            const timerEl = document.querySelector(`#battle-card-${battle.id} .timer-value`);
            if (timerEl && isActive) {
                const hours = Math.floor(timeLeft / 3600);
                const minutes = Math.floor((timeLeft % 3600) / 60);
                const seconds = timeLeft % 60;
                timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }

            // If timer just hit zero, we might want to change status text
            if (timeLeft === 0 && isActive) {
                const statusEl = document.querySelector(`#battle-card-${battle.id} .battle-status`);
                if (statusEl) statusEl.textContent = '⏱️ ENDED';
                // Trigger refresh to get final state
                setTimeout(loadActiveBattles, 2000);
            }
        });
    }

    // Update Detail View Timer if open
    const detailView = document.getElementById('battle-detail-view');
    if (!detailView.classList.contains('hidden')) {
        const hash = window.location.hash;
        if (hash.startsWith('#battle/')) {
            const id = hash.split('/')[1];
            const battle = window.loadedBattles?.find(b => b.id === id);
            if (battle) {
                const timeLeft = Math.max(0, (battle.startTime + 86400) - now);
                const statusLabel = document.querySelector('#battle-detail-card [style*="color:"]');
                if (statusLabel) {
                    if (timeLeft > 0 && !battle.ended) {
                        statusLabel.textContent = `🔥 BATTLE IN PROGRESS | Ends in ${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}m ${timeLeft % 60}s`;
                    } else {
                        statusLabel.textContent = '🏁 BATTLE ENDED';
                        statusLabel.style.color = '#ef4444';
                    }
                }
            }
        }
    }
}

window.closeBattleDetail = function () {
    document.getElementById('battle-detail-view').classList.add('hidden');
    document.getElementById('activebattles-content').classList.remove('hidden');
    window.location.hash = ''; // Clear hash
};

function displayBattles(battles) {
    const list = document.getElementById('battleList');
    // Cache battles for detail view if needed
    window.loadedBattles = battles;

    if (battles.length === 0) {
        list.innerHTML = '<p class="text-center" style="color: var(--text-muted); padding: 2rem;">No active battles. Be the first to join!</p>';
        return;
    }

    list.innerHTML = battles.map(battle => {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = Math.max(0, (battle.startTime + 86400) - now);
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;
        const isActive = !battle.ended && timeLeft > 0;

        const p1Votes = battle.p1Votes || 0;
        const p2Votes = battle.p2Votes || 0;
        const winner = p1Votes >= p2Votes ? 1 : 2;
        const winnerTokenId = winner === 1 ? battle.p1TokenId : battle.p2TokenId;

        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent('<svg width="280" height="280" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="280" fill="#333"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">?</text></svg>')}`;

        return `
      <div class="battle-card" id="battle-card-${battle.id}">
        <div class="battle-header">
          <div class="battle-id">#${battle.id}</div>
          <div class="battle-status ${isActive ? 'status-active' : 'status-ended'}">
            ${isActive ? '🔥 LIVE' : battle.ended ? `🏆 Winner: ${winner === 1 ? battle.p1Name : battle.p2Name}` : '⏱️ ENDED'}
          </div>
          <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="viewBattleDetail('${battle.id}')">↗</button>
        </div>
        
        <div class="battle-fighters">
          <div class="fighter">
            <div class="active-battle-img-container">
                 <img src="${battle.p1Image || fallbackSvg}" class="active-battle-img" loading="lazy" data-ipfs="${battle.p1Image ? '' : battle.p1TokenId}" onerror="this.src='${fallbackSvg}'">
            </div>
            <div class="fighter-name" style="font-weight: bold; margin-bottom: 0.2rem;">${battle.p1Name}</div>
            <div class="fighter-votes" style="font-size: 1.8rem; font-weight: 800; text-shadow: 0 0 10px rgba(139, 92, 246, 0.5); color: ${winner === 1 && !isActive ? '#10b981' : '#a78bfa'}">
              ${p1Votes}
            </div>
          </div>
          
          <div class="vs">VS</div>
          
          <div class="fighter">
            <div class="active-battle-img-container">
                 <img src="${battle.p2Image || fallbackSvg}" class="active-battle-img" loading="lazy" data-ipfs="${battle.p2Image ? '' : battle.p2TokenId}" onerror="this.src='${fallbackSvg}'">
            </div>
            <div class="fighter-name" style="font-weight: bold; margin-bottom: 0.2rem;">${battle.p2Name}</div>
            <div class="fighter-votes" style="font-size: 1.8rem; font-weight: 800; text-shadow: 0 0 10px rgba(236, 72, 153, 0.5); color: ${winner === 2 && !isActive ? '#10b981' : '#f472b6'}">
              ${p2Votes}
            </div>
          </div>
        </div>
        
        ${isActive ? `
          <div class="battle-timer">
            <div class="timer-label">Ending in</div>
            <div class="timer-value">${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</div>
          </div>
          
          <div class="vote-buttons">
            <button class="btn-vote" onclick="handleVote(${battle.id}, 1)">
              Vote P1
            </button>
            <button class="btn-vote" onclick="handleVote(${battle.id}, 2)">
              Vote P2
            </button>
          </div>
        ` : `
          <div class="text-center mt-2">
            <button class="btn btn-secondary" onclick="handleEndBattle(${battle.id})" ${battle.ended ? 'disabled' : ''}>
              ${battle.ended ? 'Already Claimed' : '🎁 End & Claim'}
            </button>
          </div>
        `}
      </div>
    `;
    }).join('');
}

// Make vote and end battle functions global
window.handleVote = async function (battleId, side) {
    if (!signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    try {
        showMessage('Submitting vote...', 'info');
        const tx = await contracts.battle.vote(battleId, side);
        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();
        showMessage('Vote submitted successfully!', 'success');
        await updateBalances();
    } catch (error) {
        console.error('Vote error:', error);
        showMessage('Vote failed: ' + (error.reason || error.message), 'error');
    }
};

window.handleEndBattle = async function (battleId) {
    if (!signer) {
        showMessage('Please connect your wallet first', 'error');
        return;
    }

    try {
        showMessage('Ending battle...', 'info');
        const tx = await contracts.battle.endBattle(battleId);
        showMessage('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();
        showMessage('Battle ended! Rewards distributed.', 'success');
        loadActiveBattles();
    } catch (error) {
        console.error('End battle error:', error);
        showMessage('Failed to end battle: ' + (error.reason || error.message), 'error');
    }
};

// Message Functions
// Platform Stats Functions
async function loadPlatformStats() {
    try {
        // Check cache first (valid for 1 hour)
        const now = Date.now();
        if (statsCache.lastUpdate && (now - statsCache.lastUpdate) < 60 * 60 * 1000) {
            updateStatsDisplay();
            return;
        }

        // Initialize provider if not exists - prefer injected, fallback to RPC URL
        if (!provider) {
            if (typeof window !== 'undefined' && window.ethereum) {
                provider = new ethers.BrowserProvider(window.ethereum);
            } else {
                // fallback to configured RPC (read-only)
                provider = new ethers.JsonRpcProvider(NETWORK.rpcUrls[0]);
            }
        }

        // Initialize contracts
        if (!contracts.nft) {
            contracts.nft = new ethers.Contract(CONTRACTS.NFT, ABIS.NFT, provider);
        }
        if (!contracts.battle) {
            contracts.battle = new ethers.Contract(CONTRACTS.BATTLE, ABIS.BATTLE, provider);
        }
        if (!contracts.token) {
            contracts.token = new ethers.Contract(CONTRACTS.TOKEN, ABIS.TOKEN, provider);
        }

        // Fetch stats in parallel
        // Fetch stats in parallel
        const [totalNFTs, battleStats, gmemeRemaining, polRaised] = await Promise.all([
            getTotalNFTs(),
            getTotalBattles(),
            getSwapGmemeBalance(),
            getSwapPolRaised()
        ]);

        // Update cache
        statsCache = {
            totalNFTs: totalNFTs || 0,
            totalBattles: battleStats.total || 0,
            activeBattles: battleStats.active || 0,
            gmemeRemaining: gmemeRemaining || 0,
            totalPolRaised: polRaised || 0,
            lastUpdate: now
        };

        updateStatsDisplay();
        // contract tx counts removed per request
        // update last updated UI
        const updatedEl = document.getElementById('mintUpdated');
        if (updatedEl) {
            const d = new Date();
            updatedEl.textContent = `Last updated: ${d.toLocaleString()}`;
        }
    } catch (error) {
        console.error('Error loading platform stats:', error);
        // Show cached data if available, otherwise show placeholders
        if (statsCache.lastUpdate) {
            updateStatsDisplay();
        }
    }
}

// (contract tx counts removed)

async function getTotalNFTs() {
    try {
        // Since GMEME NFT doesn't expose totalSupply, we'll estimate by scanning
        // Check ownership for token IDs 1-200 (reasonable upper bound)
        let count = 0;
        const maxCheck = 200;

        // Check in batches to avoid rate limits
        for (let tokenId = 1; tokenId <= maxCheck; tokenId++) {
            try {
                const owner = await contracts.nft.ownerOf(tokenId);
                if (owner && owner !== ethers.ZeroAddress) {
                    count++;
                }
            } catch (error) {
                // Token doesn't exist, continue
                break;
            }
        }

        return count;
    } catch (error) {
        console.warn('Could not get NFT count:', error);
        return 0;
    }
}

async function getTotalBattles() {
    try {
        if (!contracts.battle) return { total: 0, active: 0 };

        // Contract starts nextBattleId at 1. Total = nextBattleId - 1
        const nextBattleId = await contracts.battle.nextBattleId();
        const totalBattles = Math.max(0, Number(nextBattleId) - 1);

        // Also count active battles
        let activeCount = 0;
        const now = Math.floor(Date.now() / 1000);

        // Check last 20 battles for active status
        // Since contract is new, totalBattles might be small, logic still holds
        const startId = Math.max(1, Number(nextBattleId) - 20);

        for (let i = startId; i < Number(nextBattleId); i++) {
            try {
                const battle = await contracts.battle.battles(i);
                const timeLeft = Math.max(0, (Number(battle.startTime) + 86400) - now);
                if (!battle.ended && timeLeft > 0) {
                    activeCount++;
                }
            } catch (error) {
                break;
            }
        }

        return { total: totalBattles, active: activeCount };
    } catch (error) {
        console.warn('Could not get battle count:', error);
        return { total: 0, active: 0 };
    }
}

// Get GMEME balance of Swap contract (Remaining for sale)
async function getSwapGmemeBalance() {
    try {
        const balance = await contracts.token.balanceOf(CONTRACTS.SWAP);
        return parseFloat(ethers.formatEther(balance));
    } catch (error) {
        console.warn('Could not get swap GMEME balance:', error);
        return 0;
    }
}

// Get POL (native) balance of swap contract (total POL raised)
async function getSwapPolRaised() {
    try {
        if (!provider) {
            provider = new ethers.BrowserProvider(window.ethereum || window.web3?.currentProvider);
        }

        const balance = await provider.getBalance(CONTRACTS.SWAP);
        // format as number with up to 4 decimals
        return parseFloat(ethers.formatEther(balance));
    } catch (error) {
        console.warn('Could not get swap POL raised:', error);
        return 0;
    }
}

// Space scene mouse parallax (simple, performant)
function initializeSpaceScene() {
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const scene = document.querySelector('.space-scene');
        if (!scene) return;

        const planets = Array.from(scene.querySelectorAll('.planet'));

        let w = window.innerWidth, h = window.innerHeight;

        function onMove(e) {
            const x = (e.clientX / w) - 0.5;
            const y = (e.clientY / h) - 0.5;

            planets.forEach(p => {
                const depth = parseFloat(p.dataset.depth || '0.06');
                const tx = x * 40 * depth * -1;
                const ty = y * 30 * depth * -1;
                p.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            });
        }

        // Touch fallback: use deviceorientation if available
        function onOrientation(e) {
            const x = (e.gamma || 0) / 45; // -45..45
            const y = (e.beta || 0) / 90;   // -90..90
            planets.forEach(p => {
                const depth = parseFloat(p.dataset.depth || '0.06');
                const tx = x * 30 * depth;
                const ty = y * 20 * depth;
                p.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            });
        }

        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('deviceorientation', onOrientation, { passive: true });

        window.addEventListener('resize', () => {
            w = window.innerWidth;
            h = window.innerHeight;
        });

    } catch (err) {
        console.warn('Space scene init failed:', err);
    }
}

/* Canvas Starfield: performant, DPR-aware, respects reduced motion */
function initializeStarCanvas() {
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const canvas = document.getElementById('starCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let width = canvas.clientWidth;
        let height = canvas.clientHeight;
        let dpr = Math.max(1, window.devicePixelRatio || 1);
        let stars = [];
        let running = true;
        let mouseX = 0, mouseY = 0;

        function resize() {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            initStars();
        }

        function initStars() {
            stars = [];
            const area = Math.max(10000, width * height);
            const count = Math.min(1200, Math.floor(area / 9000)); // tune density
            for (let i = 0; i < count; i++) {
                const depth = Math.random() * 0.9 + 0.1; // 0.1..1.0
                const radius = (Math.random() * 1.2 + 0.2) * (1 - depth) + 0.2;
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    z: depth,
                    r: radius,
                    tw: Math.random() * Math.PI * 2,
                    twSpeed: Math.random() * 1.2 + 0.2,
                    alphaBase: Math.random() * 0.6 + 0.2
                });
            }
        }

        let lastTs = performance.now();
        function frame(ts) {
            if (!running) return;
            const dt = Math.min(0.05, (ts - lastTs) / 1000);
            lastTs = ts;

            ctx.clearRect(0, 0, width, height);

            if (width <= 0 || height <= 0) {
                requestAnimationFrame(frame);
                return;
            }

            // subtle parallax based on mouse
            const safeWidth = width || 1;
            const safeHeight = height || 1;

            const px = (mouseX / safeWidth - 0.5) * 40;
            const py = (mouseY / safeHeight - 0.5) * 30;

            for (let s of stars) {
                s.tw += s.twSpeed * dt;
                const twinkle = 0.5 + Math.sin(s.tw) * 0.5;
                const alpha = Math.max(0, Math.min(1, s.alphaBase * twinkle));
                const ox = px * (1 - s.z) * 0.6;
                const oy = py * (1 - s.z) * 0.6;

                const x = s.x + ox;
                const y = s.y + oy;

                ctx.beginPath();
                const grad = ctx.createRadialGradient(x, y, 0, x, y, s.r * 6);
                grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
                grad.addColorStop(0.4, `rgba(200,220,255,${alpha * 0.6})`);
                grad.addColorStop(1, `rgba(120,130,160,0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(x - s.r * 6, y - s.r * 6, s.r * 12, s.r * 12);
            }

            requestAnimationFrame(frame);
        }

        // mouse interactions
        function onMove(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }

        function onTouch(e) {
            if (e.touches && e.touches[0]) {
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
            }
        }

        // start
        resize();
        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('touchmove', onTouch, { passive: true });
        requestAnimationFrame(frame);

        // cleanup on unload
        window.addEventListener('beforeunload', () => {
            running = false;
        });

    } catch (err) {
        console.warn('Star canvas init failed:', err);
    }
}

/* WebGL Planet Renderer removed (planets disabled) */

function updateStatsDisplay() {
    const totalNFTsEl = document.getElementById('totalNFTs');
    const totalBattlesEl = document.getElementById('totalBattles');
    const activeBattlesEl = document.getElementById('activeBattles');
    const totalVolumeEl = document.getElementById('totalVolume');
    const totalPolRaisedEl = document.getElementById('totalPolRaised');
    const mintPercentEl = document.getElementById('mintPercent');
    const mintProgressFillEl = document.getElementById('mintProgressFill');

    if (totalNFTsEl && statsCache.totalNFTs !== null) {
        totalNFTsEl.textContent = statsCache.totalNFTs.toLocaleString();
    }

    if (totalBattlesEl && statsCache.totalBattles !== null) {
        totalBattlesEl.textContent = statsCache.totalBattles.toLocaleString();
    }

    if (activeBattlesEl && statsCache.activeBattles !== null) {
        activeBattlesEl.textContent = statsCache.activeBattles.toLocaleString();
    }

    if (totalVolumeEl && statsCache.totalVolume !== null) {
        totalVolumeEl.textContent = statsCache.totalVolume.toLocaleString();
    }
    if (totalPolRaisedEl && statsCache.totalPolRaised !== null) {
        // show up to 4 decimals and trim trailing zeros
        totalPolRaisedEl.textContent = Number(statsCache.totalPolRaised).toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    // Mint progress: initial supply 600000 GMEME
    const initialSupply = 600000;
    if (mintPercentEl && mintProgressFillEl && statsCache.gmemeRemaining !== null) {
        // statsCache.gmemeRemaining is GMEME left in Swap contract
        const remaining = Number(statsCache.gmemeRemaining) || 0;
        const minted = Math.max(0, initialSupply - remaining);

        const percent = Math.min(100, Math.max(0, (minted / initialSupply) * 100));
        mintPercentEl.textContent = `${percent.toFixed(2)}%`;
        mintProgressFillEl.style.width = `${percent}%`;
        // update numbers: show remaining / total
        const mintStatsTextEl = document.getElementById('mintStatsText');

        if (mintStatsTextEl) {
            mintStatsTextEl.textContent = `${Number(remaining).toLocaleString()} / ${Number(initialSupply).toLocaleString()} GMEME remaining`;
        }
        // ensure no spark (clean look)
        const spark = document.getElementById('mintSpark');
        if (spark) spark.style.display = 'none';
    }
}

// Cleanup function
window.addEventListener('beforeunload', () => {
    if (statsRefreshTimer) {
        clearInterval(statsRefreshTimer);
    }
});

function showMessage(text, type = 'info') {
    const container = document.getElementById('messageContainer');
    const message = document.createElement('div');
    message.className = `message message-${type}`;
    message.textContent = text;

    container.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 5000);
}

// Initialize platform stats on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load stats immediately
    loadPlatformStats();

    // Refresh stats every 5 minutes
    statsRefreshTimer = setInterval(() => {
        loadPlatformStats();
    }, 5 * 60 * 1000);

    // Initialize space scene if exists
    const starCanvas = document.getElementById('starCanvas');
    if (starCanvas) {
        initializeStarCanvas();
    }

    const spaceScene = document.querySelector('.space-scene');
    if (spaceScene) {
        initializeSpaceScene();
    }
});


/* =========================================================================
   VOTING LOGIC WITH ANTI-SYBIL CHECK (Added by Antigravity)
   ========================================================================= */

// Check if user holds at least 1 GMEME
async function checkVoteBalance(userAddress) {
    try {
        if (!contracts || !contracts.token) return false;
        const balance = await contracts.token.balanceOf(userAddress);
        // 1 GMEME check (assuming 18 decimals)
        const minBalance = ethers.parseEther("1.0");
        return balance >= minBalance;
    } catch (error) {
        console.error("Error checking balance:", error);
        return false;
    }
}

// Override or Define handleVote
window.handleVote = async function (battleId, fighterIndex) {
    if (!currentAccount) {
        showMessage('Please connect your wallet first!', 'error');
        return;
    }

    // 1. Check Anti-Sybil Condition
    showMessage('Checking eligibility...', 'info');
    const hasEnough = await checkVoteBalance(currentAccount);
    if (!hasEnough) {
        showMessage('⚠️ Vui lòng nắm giữ ít nhất 1 GMEME để vote!', 'error');
        return;
    }

    // 2. Proceed with Vote
    try {
        // Show loading state
        const btn = document.activeElement;
        const originalText = btn ? btn.innerText : '';
        if (btn) btn.innerText = 'Voting...';

        const tx = await contracts.battle.vote(battleId, fighterIndex);
        showMessage('Transaction sent! Waiting for confirmation...', 'info');

        await tx.wait();
        showMessage('Vote successful! Thank you for participating.', 'success');

        // Refresh data
        if (window.loadActiveBattles) window.loadActiveBattles();
        if (typeof window.viewBattleDetail === 'function' && document.getElementById('battle-detail-view').classList.contains('hidden') === false) {
            window.viewBattleDetail(battleId); // refresh detail view logic reuse
        }
        // Force reload stats
        loadPlatformStats();

    } catch (error) {
        console.error("Vote failed:", error);
        if (btn) btn.innerText = originalText;

        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            showMessage('You rejected the transaction.', 'info');
        } else {
            showMessage('Voting failed: ' + (error.reason || error.message), 'error');
        }
    } finally {
        if (btn) btn.innerText = originalText;
    }
};

window.handleEndBattle = async function (battleId) {
    if (!currentAccount) {
        showMessage('Please connect wallet', 'error');
        return;
    }
    try {
        showMessage('Ending battle...', 'info');
        const tx = await contracts.battle.endBattle(battleId);
        await tx.wait();
        showMessage('Battle ended! Rewards distributed.', 'success');
        window.loadActiveBattles();
        window.viewBattleDetail(battleId);
    } catch (error) {
        console.error(error);
        showMessage('Failed to end battle', 'error');
    }
};

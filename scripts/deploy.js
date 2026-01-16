/* eslint-disable no-undef */
const hre = require("hardhat");

async function main() {
    // Try to get signer from Hardhat (local) first; if none, fall back to PRIVATE_KEY + RPC provider.
    let deployer;
    const DEV_WALLET = "0x27BE66DdB44074D45B4dCf6aae43e4EB48001010";

    const signers = await hre.ethers.getSigners();
    if (signers && signers.length > 0) {
        deployer = signers[0];
    } else {
        const pk = process.env.PRIVATE_KEY;
        if (!pk) throw new Error("No deployer available and PRIVATE_KEY not set in env");
        const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
        deployer = new hre.ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
    }

    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy Token
    const GMEMEToken = await hre.ethers.getContractFactory("GMEMEToken");
    const token = await GMEMEToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("GMEMEToken deployed to:", tokenAddress);

    // 2. Deploy NFT
    const GMEMENFT = await hre.ethers.getContractFactory("GMEMENFT");
    const nft = await GMEMENFT.deploy(tokenAddress, DEV_WALLET);
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    console.log("GMEMENFT deployed to:", nftAddress);

    // 3. Deploy Swap
    const GMEMESwap = await hre.ethers.getContractFactory("GMEMESwap");
    const swap = await GMEMESwap.deploy(tokenAddress);
    await swap.waitForDeployment();
    const swapAddress = await swap.getAddress();
    console.log("GMEMESwap deployed to:", swapAddress);

    // 4. Deploy Battle
    const GMEMEBattle = await hre.ethers.getContractFactory("GMEMEBattle");
    const battle = await GMEMEBattle.deploy(tokenAddress, nftAddress, DEV_WALLET);
    await battle.waitForDeployment();
    const battleAddress = await battle.getAddress();
    console.log("GMEMEBattle deployed to:", battleAddress);

    // 5. Configuration & Distribution
    console.log("Configuring contracts...");

    // Set Battle Contract in NFT to allow ELO updates
    await nft.setBattleContract(battleAddress);
    console.log("Set Battle contract in NFT");

    // Distribute Tokens
    // Total Supply: 666,666 GMEME
    // 600,000 -> Swap Pool
    const swapAmount = hre.ethers.parseEther("600000");
    // Check balance before transfer to be safe, but we know initial mint is correct.
    // We need to wait for previous txs? waitForDeployment waits for deployment tx.

    const tx1 = await token.transfer(swapAddress, swapAmount);
    await tx1.wait();
    console.log("Transferred 600,000 GMEME to Swap Pool");

    // 66,666 -> Dev Wallet
    const devAmount = hre.ethers.parseEther("66666");
    const tx2 = await token.transfer(DEV_WALLET, devAmount);
    await tx2.wait();
    console.log("Transferred 66,666 GMEME to Dev Wallet");

    console.log("Deployment Complete!");
    console.log("----------------------------------------------------");
    console.log("GMEMEToken:  ", tokenAddress);
    console.log("GMEMENFT:    ", nftAddress);
    console.log("GMEMESwap:   ", swapAddress);
    console.log("GMEMEBattle: ", battleAddress);
    console.log("----------------------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

const hre = require("hardhat");

async function main() {
    const TOKEN_ADDRESS = "0x5C56D8AF68F2F105c61aF590AB3069B6B8446396";
    const NFT_ADDRESS = "0xd6f5065d0ae20bA424184265D379a90d04322b6f";
    const SWAP_ADDRESS = "0x234bFc05Dba6417Efa9e1F509D9C41e4333670e6";
    const BATTLE_ADDRESS = "0x20292fB50b697e953B5CE39976259cf6f250748b";

    // Get the wallet address from .env
    const [signer] = await hre.ethers.getSigners();
    const userAddress = signer.address;

    console.log("=".repeat(60));
    console.log("GMEME Platform - Balance Check");
    console.log("=".repeat(60));
    console.log(`\nWallet Address: ${userAddress}\n`);

    // Get POL balance
    const polBalance = await hre.ethers.provider.getBalance(userAddress);
    console.log(`💰 POL Balance: ${hre.ethers.formatEther(polBalance)} POL`);

    // Get GMEME balance
    const token = await hre.ethers.getContractAt("GMEMEToken", TOKEN_ADDRESS);
    const gmemeBalance = await token.balanceOf(userAddress);
    console.log(`🎮 GMEME Balance: ${hre.ethers.formatEther(gmemeBalance)} GMEME`);

    // Get NFT balance
    const nft = await hre.ethers.getContractAt("GMEMENFT", NFT_ADDRESS);
    const nftBalance = await nft.balanceOf(userAddress);
    console.log(`🖼️  NFT Count: ${nftBalance.toString()} NFTs`);

    // Check allowances
    console.log("\n" + "-".repeat(60));
    console.log("Allowances:");
    console.log("-".repeat(60));

    const nftAllowance = await token.allowance(userAddress, NFT_ADDRESS);
    console.log(`NFT Contract: ${hre.ethers.formatEther(nftAllowance)} GMEME`);

    const battleAllowance = await token.allowance(userAddress, BATTLE_ADDRESS);
    console.log(`Battle Contract: ${hre.ethers.formatEther(battleAllowance)} GMEME`);

    // Recommendations
    console.log("\n" + "=".repeat(60));
    console.log("Recommendations:");
    console.log("=".repeat(60));

    if (polBalance < hre.ethers.parseEther("0.1")) {
        console.log("⚠️  Low POL balance! Get testnet POL from faucet:");
        console.log("   https://faucet.polygon.technology/");
    }

    if (gmemeBalance < hre.ethers.parseEther("1")) {
        console.log("⚠️  Insufficient GMEME for minting! You need at least 1 GMEME.");
        console.log("   Swap POL for GMEME in the frontend (6 POL = 1 GMEME)");
    } else if (gmemeBalance < hre.ethers.parseEther("10")) {
        console.log("⚠️  Low GMEME balance for battles! You need 10 GMEME per battle.");
    } else {
        console.log("✅ GMEME balance is sufficient!");
    }

    console.log("\n" + "=".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

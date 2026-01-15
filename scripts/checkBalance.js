const hre = require("hardhat");

async function main() {
    const TOKEN_ADDRESS = "0x5C56D8AF68F2F105c61aF590AB3069B6B8446396";
    const SWAP_ADDRESS = "0x234bFc05Dba6417Efa9e1F509D9C41e4333670e6";
    const DEV_WALLET = "0x27BE66DdB44074D45B4dCf6aae43e4EB48001010";

    console.log("Checking contract balances...\n");

    const token = await hre.ethers.getContractAt("GMEMEToken", TOKEN_ADDRESS);

    // Check deployer balance
    const [deployer] = await hre.ethers.getSigners();
    const deployerBalance = await token.balanceOf(deployer.address);
    console.log(`Deployer (${deployer.address}): ${hre.ethers.formatEther(deployerBalance)} GMEME`);

    // Check Swap Pool balance
    const swapBalance = await token.balanceOf(SWAP_ADDRESS);
    console.log(`Swap Pool (${SWAP_ADDRESS}): ${hre.ethers.formatEther(swapBalance)} GMEME`);

    // Check Dev Wallet balance
    const devBalance = await token.balanceOf(DEV_WALLET);
    console.log(`Dev Wallet (${DEV_WALLET}): ${hre.ethers.formatEther(devBalance)} GMEME`);

    console.log("\n" + "=".repeat(60));

    // If swap pool is empty, transfer tokens
    if (swapBalance === 0n) {
        console.log("\n⚠️  Swap Pool is empty! Transferring 600,000 GMEME...");

        const swapAmount = hre.ethers.parseEther("600000");
        const tx = await token.transfer(SWAP_ADDRESS, swapAmount);
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();

        console.log("✅ Transfer complete!");

        const newBalance = await token.balanceOf(SWAP_ADDRESS);
        console.log(`New Swap Pool balance: ${hre.ethers.formatEther(newBalance)} GMEME`);
    } else {
        console.log("\n✅ Swap Pool has tokens!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

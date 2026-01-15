const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const DEV_WALLET = "0x27BE66DdB44074D45B4dCf6aae43e4EB48001010";

    console.log("Deploying NEW GMEMESwap contract...");
    console.log("Deployer:", deployer.address);

    // Get existing contracts
    const TOKEN_ADDRESS = "0x5C56D8AF68F2F105c61aF590AB3069B6B8446396";
    const OLD_SWAP_ADDRESS = "0x234bFc05Dba6417Efa9e1F509D9C41e4333670e6";

    // Deploy new swap contract
    const GMEMESwap = await hre.ethers.getContractFactory("GMEMESwap");
    const newSwap = await GMEMESwap.deploy(TOKEN_ADDRESS);
    await newSwap.waitForDeployment();
    const newSwapAddress = await newSwap.getAddress();

    console.log("✅ New GMEMESwap deployed to:", newSwapAddress);

    // Transfer tokens from old swap to new swap
    console.log("\nTransferring liquidity from old swap to new swap...");

    const token = await hre.ethers.getContractAt("GMEMEToken", TOKEN_ADDRESS);
    const oldSwap = await hre.ethers.getContractAt("GMEMESwap", OLD_SWAP_ADDRESS);

    // Get balances
    const oldSwapGMEME = await token.balanceOf(OLD_SWAP_ADDRESS);
    const oldSwapPOL = await hre.ethers.provider.getBalance(OLD_SWAP_ADDRESS);

    console.log(`Old Swap GMEME: ${hre.ethers.formatEther(oldSwapGMEME)}`);
    console.log(`Old Swap POL: ${hre.ethers.formatEther(oldSwapPOL)}`);

    // Withdraw from old swap
    if (oldSwapGMEME > 0) {
        console.log("\nWithdrawing GMEME from old swap...");
        const tx1 = await oldSwap.withdrawGMEME(oldSwapGMEME);
        await tx1.wait();
        console.log("✅ GMEME withdrawn");
    }

    if (oldSwapPOL > 0) {
        console.log("Withdrawing POL from old swap...");
        const tx2 = await oldSwap.withdrawPOL(oldSwapPOL);
        await tx2.wait();
        console.log("✅ POL withdrawn");
    }

    // Transfer to new swap
    console.log("\nTransferring to new swap...");

    // Transfer GMEME
    const gmemeAmount = hre.ethers.parseEther("600000");
    const tx3 = await token.transfer(newSwapAddress, gmemeAmount);
    await tx3.wait();
    console.log(`✅ Transferred ${hre.ethers.formatEther(gmemeAmount)} GMEME to new swap`);

    // Send POL if any
    if (oldSwapPOL > 0) {
        const tx4 = await deployer.sendTransaction({
            to: newSwapAddress,
            value: oldSwapPOL
        });
        await tx4.wait();
        console.log(`✅ Transferred ${hre.ethers.formatEther(oldSwapPOL)} POL to new swap`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Deployment Complete!");
    console.log("=".repeat(60));
    console.log("New GMEMESwap:", newSwapAddress);
    console.log("\n⚠️  IMPORTANT: Update frontend config.js with new address!");
    console.log("=".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

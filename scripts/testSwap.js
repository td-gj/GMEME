const hre = require("hardhat");

async function main() {
    const SWAP_ADDRESS = "0x234bFc05Dba6417Efa9e1F509D9C41e4333670e6";

    console.log("Testing swap function...\n");

    const [signer] = await hre.ethers.getSigners();
    console.log(`Using account: ${signer.address}`);

    // Get POL balance
    const polBalance = await hre.ethers.provider.getBalance(signer.address);
    console.log(`POL Balance: ${hre.ethers.formatEther(polBalance)} POL\n`);

    const swap = await hre.ethers.getContractAt("GMEMESwap", SWAP_ADDRESS);

    // Try swapping 6 POL (should get 1 GMEME)
    const swapAmount = hre.ethers.parseEther("6");

    console.log(`Attempting to swap ${hre.ethers.formatEther(swapAmount)} POL...`);

    try {
        const tx = await swap.swap({ value: swapAmount });
        console.log(`Transaction hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        await tx.wait();
        console.log("✅ Swap successful!");
    } catch (error) {
        console.error("❌ Swap failed:");
        console.error(error.message);

        // Try to get more details
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

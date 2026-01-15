const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Adding Liquidity with account:", deployer.address);

    // Addresses on Polygon Mainnet
    const TOKEN_ADDRESS = "0x7053d3A4725d10365D1Db3cE3d716062941b5cC6";
    const SWAP_ADDRESS = "0xB9F62b142e0ABA8D2d645F17da0078F303f1eD19";

    const token = await hre.ethers.getContractAt("GMEMEToken", TOKEN_ADDRESS);
    const swap = await hre.ethers.getContractAt("GMEMESwap", SWAP_ADDRESS);

    // 1. Send GMEME to Swap if not enough
    const currentTokenBalance = await token.balanceOf(SWAP_ADDRESS);
    console.log("Current Swap GMEME Balance:", hre.ethers.formatEther(currentTokenBalance));

    if (currentTokenBalance < hre.ethers.parseEther("100000")) {
        const amount = hre.ethers.parseEther("500000");
        console.log(`Transferring ${hre.ethers.formatEther(amount)} GMEME to Swap...`);
        const tx1 = await token.transfer(SWAP_ADDRESS, amount);
        await tx1.wait();
        console.log("Transferred!");
    } else {
        console.log("Swap already has enough GMEME.");
    }

    // 2. Send POL (Native) to Swap
    const currentPolBalance = await hre.ethers.provider.getBalance(SWAP_ADDRESS);
    console.log("Current Swap POL Balance:", hre.ethers.formatEther(currentPolBalance));

    // Warning: This spends real POL
    const amountPol = hre.ethers.parseEther("2.0"); // 2 POL

    // Ask user confirmation logic isn't easy here, so we print command to run manually 
    // OR we just do it if user accepts script runs.
    // Since this is real money, I will LOG instructions instead of auto-sending.

    console.log("\n⚠️  ACTION REQUIRED: Send POL to Swap Contract");
    console.log("To enable 'Sell GMEME' feature, send 2-5 POL to:", SWAP_ADDRESS);
    console.log("You can do this from your Metamask wallet directly.");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

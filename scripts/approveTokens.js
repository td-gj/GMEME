const hre = require("hardhat");

async function main() {
    const TOKEN_ADDRESS = "0x5C56D8AF68F2F105c61aF590AB3069B6B8446396";
    const NFT_ADDRESS = "0xd6f5065d0ae20bA424184265D379a90d04322b6f";
    const BATTLE_ADDRESS = "0x20292fB50b697e953B5CE39976259cf6f250748b";

    const [signer] = await hre.ethers.getSigners();
    console.log("Approving tokens for:", signer.address);

    const token = await hre.ethers.getContractAt("GMEMEToken", TOKEN_ADDRESS);

    // Check current balances
    const balance = await token.balanceOf(signer.address);
    console.log(`\nGMEME Balance: ${hre.ethers.formatEther(balance)} GMEME\n`);

    if (balance < hre.ethers.parseEther("1")) {
        console.log("❌ Insufficient GMEME balance! You need at least 1 GMEME.");
        console.log("   Swap POL for GMEME first.");
        return;
    }

    console.log("Approving NFT Contract...");
    try {
        const tx1 = await token.approve(NFT_ADDRESS, hre.ethers.parseEther("1000"), {
            gasLimit: 100000
        });
        console.log(`Transaction hash: ${tx1.hash}`);
        console.log("Waiting for confirmation...");
        await tx1.wait();
        console.log("✅ NFT Contract approved for 1000 GMEME\n");
    } catch (error) {
        console.error("❌ NFT approval failed:", error.message);
    }

    console.log("Approving Battle Contract...");
    try {
        const tx2 = await token.approve(BATTLE_ADDRESS, hre.ethers.parseEther("10000"), {
            gasLimit: 100000
        });
        console.log(`Transaction hash: ${tx2.hash}`);
        console.log("Waiting for confirmation...");
        await tx2.wait();
        console.log("✅ Battle Contract approved for 10000 GMEME\n");
    } catch (error) {
        console.error("❌ Battle approval failed:", error.message);
    }

    // Check final allowances
    console.log("=".repeat(60));
    console.log("Final Allowances:");
    console.log("=".repeat(60));

    const nftAllowance = await token.allowance(signer.address, NFT_ADDRESS);
    console.log(`NFT Contract: ${hre.ethers.formatEther(nftAllowance)} GMEME`);

    const battleAllowance = await token.allowance(signer.address, BATTLE_ADDRESS);
    console.log(`Battle Contract: ${hre.ethers.formatEther(battleAllowance)} GMEME`);

    console.log("\n✅ All approvals complete! You can now mint NFTs and join battles.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

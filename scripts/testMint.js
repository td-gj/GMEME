const hre = require("hardhat");

async function main() {
    const NFT_ADDRESS = "0xd6f5065d0ae20bA424184265D379a90d04322b6f";

    const [signer] = await hre.ethers.getSigners();
    console.log("Minting NFT for:", signer.address);

    const nft = await hre.ethers.getContractAt("GMEMENFT", NFT_ADDRESS);

    // Use a simple test URI
    const testURI = "ipfs://QmTest123456789";

    console.log("\nAttempting to mint with URI:", testURI);
    console.log("This will cost 1 GMEME (already approved)\n");

    try {
        // Try with explicit gas settings
        const tx = await nft.mint(testURI, {
            gasLimit: 500000,
            maxFeePerGas: hre.ethers.parseUnits("50", "gwei"),
            maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
        });

        console.log("✅ Transaction submitted!");
        console.log("TX Hash:", tx.hash);
        console.log("Waiting for confirmation...\n");

        const receipt = await tx.wait();
        console.log("✅ NFT Minted Successfully!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());

        // Get the token ID from events
        const transferEvent = receipt.logs.find(log => {
            try {
                return nft.interface.parseLog(log).name === 'Transfer';
            } catch {
                return false;
            }
        });

        if (transferEvent) {
            const parsed = nft.interface.parseLog(transferEvent);
            console.log("Token ID:", parsed.args.tokenId.toString());
        }

    } catch (error) {
        console.error("\n❌ Mint failed!");
        console.error("Error:", error.message);

        if (error.data) {
            console.error("Error data:", error.data);
        }

        // Try to decode the revert reason
        if (error.error && error.error.data) {
            try {
                const reason = hre.ethers.toUtf8String('0x' + error.error.data.slice(138));
                console.error("Revert reason:", reason);
            } catch (e) {
                console.error("Could not decode revert reason");
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

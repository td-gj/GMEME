const hre = require("hardhat");

async function main() {
    const NFT_ADDRESS = "0xd6f5065d0ae20bA424184265D379a90d04322b6f";

    const [signer] = await hre.ethers.getSigners();
    const nft = await hre.ethers.getContractAt("GMEMENFT", NFT_ADDRESS);

    console.log("=".repeat(60));
    console.log("NFT Metadata Check");
    console.log("=".repeat(60));
    console.log(`Wallet: ${signer.address}\n`);

    // Check NFTs 1 and 2
    for (let tokenId = 1; tokenId <= 2; tokenId++) {
        try {
            console.log(`\nToken ID: ${tokenId}`);
            console.log("-".repeat(60));

            const owner = await nft.ownerOf(tokenId);
            console.log(`Owner: ${owner}`);

            const tokenURI = await nft.tokenURI(tokenId);
            console.log(`Token URI: ${tokenURI}`);

            const elo = await nft.getElo(tokenId);
            console.log(`ELO: ${elo}`);

            const rank = await nft.getRank(tokenId);
            console.log(`Rank: ${rank}`);

            // Convert IPFS URI to gateway URL
            if (tokenURI.startsWith('ipfs://')) {
                const ipfsHash = tokenURI.replace('ipfs://', '');
                const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
                console.log(`Gateway URL: ${gatewayUrl}`);
                console.log(`\n📝 To view metadata, visit:`);
                console.log(`   ${gatewayUrl}`);
            }

        } catch (error) {
            console.log(`Token ${tokenId}: Not found or error`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("💡 Tips:");
    console.log("=".repeat(60));
    console.log("1. Copy the Gateway URL and paste in browser");
    console.log("2. You should see JSON metadata with 'name' and 'image'");
    console.log("3. The 'image' field should also be an ipfs:// URI");
    console.log("4. Frontend will convert both URIs to gateway URLs");
    console.log("\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

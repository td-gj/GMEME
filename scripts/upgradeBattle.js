const hre = require("hardhat");

async function main() {
    // signer fallback: use hardhat signer or PRIVATE_KEY env
    let deployer;
    const signers = await hre.ethers.getSigners();
    if (signers && signers.length > 0) {
        deployer = signers[0];
    } else {
        const pk = process.env.PRIVATE_KEY;
        if (!pk) throw new Error("Deployer not found and PRIVATE_KEY not set in env");
        const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
        deployer = new hre.ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
    }
    console.log("Upgrading Battle Contract with account:", await deployer.getAddress());

    // Existing addresses on Polygon Mainnet (can be overridden via env)
    const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0x7053d3A4725d10365D1Db3cE3d716062941b5cC6";
    const NFT_ADDRESS = process.env.NFT_ADDRESS || "0x5096ABb4ee9dBd856FCC98e1EE3FB77BE6ad791a";
    const DEV_WALLET = process.env.DEV_WALLET || "0x27BE66DdB44074D45B4dCf6aae43e4EB48001010";

    // Deploy New Battle Contract
    const GMEMEBattle = await hre.ethers.getContractFactory("GMEMEBattle");
    const battle = await GMEMEBattle.deploy(TOKEN_ADDRESS, NFT_ADDRESS, DEV_WALLET);
    await battle.waitForDeployment();
    const battleAddress = await battle.getAddress();

    console.log("New GMEMEBattle deployed to:", battleAddress);

    // CRITICAL: Update Battle address in NFT contract so ELO can be updated
    console.log("Updating NFT contract's battle reference...");
    const nft = await hre.ethers.getContractAt("GMEMENFT", NFT_ADDRESS);
    const tx = await nft.setBattleContract(battleAddress);
    await tx.wait();
    console.log("NFT contract updated!");

    console.log("\n--- DEPLOYMENT SUMMARY ---");
    console.log("New Battle Address:", battleAddress);
    console.log("Update your frontend/config.js with this address!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

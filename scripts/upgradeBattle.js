const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    if (!deployer) throw new Error("Deployer not found. Check your .env/Private Key.");
    console.log("Upgrading Battle Contract with account:", await deployer.getAddress());

    // Existing addresses on Polygon Mainnet
    const TOKEN_ADDRESS = "0x7053d3A4725d10365D1Db3cE3d716062941b5cC6";
    const NFT_ADDRESS = "0x5096ABb4ee9dBd856FCC98e1EE3FB77BE6ad791a";
    const DEV_WALLET = "0x27BE66DdB44074D45B4dCf6aae43e4EB48001010";

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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GMEMEToken is ERC20, Ownable {
    constructor() ERC20("GMEME Token", "GMEME") Ownable(msg.sender) {
        // Mint initial supply of 666,666 GMEME to the deployer
        // The deployer will then distribute to Swap Pool and Dev Wallet
        _mint(msg.sender, 666666 * 10 ** decimals());
    }

    // Function to mint more tokens if needed in future (can be restricted or removed)
    // Based on user request, there is no mention of minting more, but usually needed for testing.
    // I will leave it out to stick to fixed supply logic unless requested.
}

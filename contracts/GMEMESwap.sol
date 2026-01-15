// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GMEMESwap is Ownable {
    IERC20 public gmemeToken;
    // Rate: 6 POL = 1 GMEME
    uint256 public constant RATE = 6; 

    event SwapPOLToGMEME(address indexed user, uint256 amountPOL, uint256 amountGMEME);
    event SwapGMEMEToPOL(address indexed user, uint256 amountGMEME, uint256 amountPOL);

    constructor(address _gmemeToken) Ownable(msg.sender) {
        gmemeToken = IERC20(_gmemeToken);
    }

    // Swap POL for GMEME
    function swapPOLToGMEME() external payable {
        require(msg.value > 0, "Must send POL");
        
        // Calculate GMEME amount: GMEME = POL / 6
        uint256 amountGMEME = msg.value / RATE;
        
        require(amountGMEME > 0, "Amount too small, need at least 6 wei");
        require(gmemeToken.balanceOf(address(this)) >= amountGMEME, "Insufficient GMEME liquidity");

        // Transfer GMEME to user
        require(gmemeToken.transfer(msg.sender, amountGMEME), "GMEME transfer failed");
        
        emit SwapPOLToGMEME(msg.sender, msg.value, amountGMEME);
    }

    // Swap GMEME for POL
    function swapGMEMEToPOL(uint256 amountGMEME) external {
        require(amountGMEME > 0, "Must send GMEME");
        
        // Calculate POL amount: POL = GMEME * 6
        uint256 amountPOL = amountGMEME * RATE;
        
        require(address(this).balance >= amountPOL, "Insufficient POL liquidity");

        // Transfer GMEME from user to contract
        require(gmemeToken.transferFrom(msg.sender, address(this), amountGMEME), "GMEME transfer failed");
        
        // Transfer POL to user
        (bool success, ) = msg.sender.call{value: amountPOL}("");
        require(success, "POL transfer failed");
        
        emit SwapGMEMEToPOL(msg.sender, amountGMEME, amountPOL);
    }

    // Backward compatibility - calls swapPOLToGMEME
    function swap() external payable {
        require(msg.value > 0, "Must send POL");
        
        uint256 amountGMEME = msg.value / RATE;
        require(amountGMEME > 0, "Amount too small, need at least 6 wei");
        require(gmemeToken.balanceOf(address(this)) >= amountGMEME, "Insufficient GMEME liquidity");
        require(gmemeToken.transfer(msg.sender, amountGMEME), "GMEME transfer failed");
        
        emit SwapPOLToGMEME(msg.sender, msg.value, amountGMEME);
    }

    // Dev can withdraw POL and GMEME
    function withdrawPOL(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Transfer failed");
    }

    function withdrawGMEME(uint256 amount) external onlyOwner {
        require(gmemeToken.transfer(owner(), amount), "Transfer failed");
    }

    // Allow contract to receive POL
    receive() external payable {}
}

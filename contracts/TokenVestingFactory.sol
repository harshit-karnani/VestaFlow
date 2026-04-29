// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/finance/VestingWallet.sol";
import "./SimpleToken.sol";

/**
 * @title TokenVestingFactory
 * @dev Factory contract that deploys an ERC-20 token and a VestingWallet
 *      in a single transaction. The entire token supply is minted directly
 *      to the VestingWallet.
 */
contract TokenVestingFactory {
    /// @notice Emitted when a new token + vesting pair is deployed
    event Deployed(
        address indexed deployer,
        address indexed token,
        address indexed vestingWallet,
        string name,
        string symbol,
        uint256 totalSupply,
        address beneficiary,
        uint64 startTimestamp,
        uint64 duration
    );

    /// @notice Stores deployment info for easy lookup
    struct Deployment {
        address token;
        address vestingWallet;
        string name;
        string symbol;
        uint256 totalSupply;
        address beneficiary;
        uint64 startTimestamp;
        uint64 duration;
        uint256 deployedAt;
    }

    /// @notice All deployments by a deployer
    mapping(address => Deployment[]) public deployments;

    /// @notice Get count of deployments for a deployer
    function getDeploymentCount(address deployer) external view returns (uint256) {
        return deployments[deployer].length;
    }

    /// @notice Get a specific deployment by index
    function getDeployment(address deployer, uint256 index) external view returns (Deployment memory) {
        return deployments[deployer][index];
    }

    /**
     * @notice Deploys an ERC-20 token and a VestingWallet in a single transaction
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param totalSupply_ Total supply in base units (wei)
     * @param beneficiary_ Wallet that can claim vested tokens
     * @param startTimestamp_ Unix timestamp when vesting starts
     * @param durationSeconds_ Vesting duration in seconds (tokens unlock linearly, or fully at start+duration)
     */
    function deployTokenAndVesting(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        address beneficiary_,
        uint64 startTimestamp_,
        uint64 durationSeconds_
    ) external returns (address tokenAddress, address vestingAddress) {
        require(totalSupply_ > 0, "Supply must be > 0");
        require(beneficiary_ != address(0), "Invalid beneficiary");
        require(startTimestamp_ > block.timestamp, "Start must be in future");
        require(durationSeconds_ > 0, "Duration must be > 0");

        // 1. Deploy VestingWallet first (we need its address to mint tokens to it)
        VestingWallet vesting = new VestingWallet(
            beneficiary_,
            startTimestamp_,
            durationSeconds_
        );
        vestingAddress = address(vesting);

        // 2. Deploy ERC-20 token, minting entire supply to the VestingWallet
        SimpleToken token = new SimpleToken(
            name_,
            symbol_,
            totalSupply_,
            vestingAddress
        );
        tokenAddress = address(token);

        // 3. Store deployment info
        deployments[msg.sender].push(Deployment({
            token: tokenAddress,
            vestingWallet: vestingAddress,
            name: name_,
            symbol: symbol_,
            totalSupply: totalSupply_,
            beneficiary: beneficiary_,
            startTimestamp: startTimestamp_,
            duration: durationSeconds_,
            deployedAt: block.timestamp
        }));

        // 4. Emit event
        emit Deployed(
            msg.sender,
            tokenAddress,
            vestingAddress,
            name_,
            symbol_,
            totalSupply_,
            beneficiary_,
            startTimestamp_,
            durationSeconds_
        );
    }
}

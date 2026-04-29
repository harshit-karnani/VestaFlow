require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const ALCHEMY_RPC = process.env.ALCHEMY_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/4grcsnnMUq2d97xhal4aK";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      url: ALCHEMY_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

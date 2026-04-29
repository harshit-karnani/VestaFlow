import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const Factory = await ethers.getContractFactory("TokenVestingFactory");
  console.log("\nDeploying TokenVestingFactory...");
  
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("\n✅ TokenVestingFactory deployed to:", address);
  console.log("🔗 View on Etherscan: https://sepolia.etherscan.io/address/" + address);
  console.log("\n👉 Copy this address into src/config/wagmi.ts → FACTORY_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

# VestaFlow — ERC-20 + Vesting Deploy Wizard

> Deploy an ERC-20 token with built-in vesting in a single transaction on Sepolia. No coding required.

![VestaFlow](https://img.shields.io/badge/Network-Sepolia-blue) ![Solidity](https://img.shields.io/badge/Solidity-0.8.20-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 What is VestaFlow?

VestaFlow is a Web3 application that allows **non-technical users** to deploy an ERC-20 token along with an OpenZeppelin VestingWallet contract in a **single transaction**. No Solidity knowledge, no complex setup — just fill in a form and click deploy.

### Problems Solved
- **Token deployment requires Solidity** → VestaFlow handles it with a factory contract
- **Vesting misconfiguration causes financial loss** → Built-in validation prevents errors
- **Lack of trust** → Uses audited OpenZeppelin contracts
- **Fragmented tooling** → Token + vesting deployed together in one tx

## ✨ Features

- 🔗 **Connect Wallet** — MetaMask via RainbowKit + Wagmi v2
- 📝 **Simple Form** — Token name, symbol, supply, beneficiary, unlock date
- 🚀 **One-Click Deploy** — Factory deploys both contracts in a single transaction
- 🔍 **Etherscan Links** — Direct links to deployed contracts on Sepolia
- ⏰ **Claim with Timer** — Countdown to unlock, claim tokens when ready
- ✅ **Full Validation** — Address validation, supply checks, future-date enforcement
- 📱 **Responsive** — Works on desktop + MetaMask mobile

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Web3 | Wagmi v2 + Viem |
| Wallet | RainbowKit (MetaMask, WalletConnect) |
| Contracts | Solidity 0.8.20 + OpenZeppelin |
| Network | Sepolia Testnet |

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [MetaMask](https://metamask.io/) browser extension
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com))

## 🏗 Quick Start

### 1. Install Dependencies

```bash
cd VestaFlow
npm install
```

### 2. Deploy the Factory Contract

You need to deploy the `TokenVestingFactory` contract to Sepolia first.

**Option A: Using Remix IDE**
1. Go to [remix.ethereum.org](https://remix.ethereum.org)
2. Create `SimpleToken.sol` and `TokenVestingFactory.sol` from the `contracts/` folder
3. Install OpenZeppelin: `@openzeppelin/contracts` v5.x
4. Compile with Solidity 0.8.20
5. Deploy `TokenVestingFactory` to Sepolia
6. Copy the deployed address

**Option B: Using Hardhat/Foundry**
```bash
# Set up your preferred framework and deploy to Sepolia
```

### 3. Configure the Factory Address

Edit `src/config/wagmi.ts` and set your deployed factory address:

```typescript
export const FACTORY_ADDRESS = '0xYOUR_DEPLOYED_FACTORY_ADDRESS' as `0x${string}`;
```

### 4. (Optional) Set WalletConnect Project ID

For production, get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/) and update `wagmi.ts`:

```typescript
projectId: 'your-walletconnect-project-id',
```

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 User Flow

1. **Connect Wallet** — Click "Connect Wallet" and select MetaMask on Sepolia
2. **Fill Token Details** — Enter name (e.g., "My Token"), symbol ("MTK"), supply (1000000)
3. **Fill Vesting Setup** — Enter beneficiary address and unlock date/time
4. **Review Summary** — Double-check all details
5. **Deploy** — Click "Deploy Token + Vesting" and confirm in MetaMask
6. **View Results** — See deployed contract addresses with Etherscan links
7. **Claim Tokens** — Switch to the "Claim" tab, enter addresses, and claim after unlock

## 📄 Smart Contracts

### TokenVestingFactory.sol
Factory contract that deploys both an ERC-20 token and a VestingWallet in one transaction.

```solidity
function deployTokenAndVesting(
    string name,
    string symbol,
    uint256 totalSupply,
    address beneficiary,
    uint64 startTimestamp,
    uint64 durationSeconds
) → (address token, address vestingWallet)
```

### SimpleToken.sol
Standard ERC-20 token that mints the full supply to a specified address on deployment.

### VestingWallet (OpenZeppelin)
Time-based vesting wallet. Tokens unlock linearly over the duration period. Beneficiary calls `release(tokenAddress)` to claim.

## 🔒 Security Notes

- Uses **audited OpenZeppelin** contracts (ERC20, VestingWallet)
- Factory contract is **stateless** — it just deploys and emits events
- All validation happens **both client-side and on-chain**
- **Sepolia testnet only** — not for mainnet production use without audit

## 📁 Project Structure

```
VestaFlow/
├── contracts/
│   ├── SimpleToken.sol          # ERC-20 token
│   └── TokenVestingFactory.sol  # Factory contract
├── public/
│   └── vite.svg                 # Favicon
├── src/
│   ├── components/
│   │   ├── Header.tsx           # Top nav with wallet connect
│   │   ├── DeployWizard.tsx     # 3-step deploy form
│   │   └── ClaimPanel.tsx       # Token claiming UI
│   ├── config/
│   │   ├── abi.ts               # Contract ABIs
│   │   └── wagmi.ts             # Wagmi + chain config
│   ├── App.tsx                  # Main app shell
│   ├── main.tsx                 # Entry point
│   └── index.css                # Tailwind + design system
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## 📜 License

MIT
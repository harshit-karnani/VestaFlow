import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'VestaFlow — ERC-20 + Vesting Deploy Wizard',
  projectId: 'demo-project-id-vestaflow', // Replace with WalletConnect project ID for production
  chains: [sepolia],
  transports: {
    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/4grcsnnMUq2d97xhal4aK'),
  },
  ssr: false,
});

// Factory contract address on Sepolia — must be deployed first
// For demo/hackathon, we'll use a placeholder that users deploy themselves
export const FACTORY_ADDRESS = '0xe91B9639687D68E9c0784a0aB361500F1A3dbE35' as `0x${string}`;

// Sepolia block explorer
export const EXPLORER_BASE = 'https://sepolia.etherscan.io';

export const getExplorerLink = (type: 'address' | 'tx', value: string) =>
  `${EXPLORER_BASE}/${type}/${value}`;

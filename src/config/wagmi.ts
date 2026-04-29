import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'VestaFlow — ERC-20 + Vesting Deploy Wizard',
  projectId: 'demo-project-id-vestaflow', // Replace with WalletConnect project ID for production
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: false,
});

// Factory contract address on Sepolia — must be deployed first
// For demo/hackathon, we'll use a placeholder that users deploy themselves
export const FACTORY_ADDRESS = '0x3e3a25a89Ae311540fA852507BE5362e2802C788' as `0x${string}`;

// Sepolia block explorer
export const EXPLORER_BASE = 'https://sepolia.etherscan.io';

export const getExplorerLink = (type: 'address' | 'tx', value: string) =>
  `${EXPLORER_BASE}/${type}/${value}`;

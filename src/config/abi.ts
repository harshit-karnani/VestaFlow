// ABI for the TokenVestingFactory contract
export const factoryAbi = [
  {
    type: 'function',
    name: 'deployTokenAndVesting',
    inputs: [
      { name: 'name_', type: 'string', internalType: 'string' },
      { name: 'symbol_', type: 'string', internalType: 'string' },
      { name: 'totalSupply_', type: 'uint256', internalType: 'uint256' },
      { name: 'beneficiary_', type: 'address', internalType: 'address' },
      { name: 'startTimestamp_', type: 'uint64', internalType: 'uint64' },
      { name: 'durationSeconds_', type: 'uint64', internalType: 'uint64' },
    ],
    outputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'vestingAddress', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getDeploymentCount',
    inputs: [
      { name: 'deployer', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDeployment',
    inputs: [
      { name: 'deployer', type: 'address', internalType: 'address' },
      { name: 'index', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct TokenVestingFactory.Deployment',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'vestingWallet', type: 'address', internalType: 'address' },
          { name: 'name', type: 'string', internalType: 'string' },
          { name: 'symbol', type: 'string', internalType: 'string' },
          { name: 'totalSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'startTimestamp', type: 'uint64', internalType: 'uint64' },
          { name: 'duration', type: 'uint64', internalType: 'uint64' },
          { name: 'deployedAt', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deployed',
    inputs: [
      { name: 'deployer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'vestingWallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'name', type: 'string', indexed: false, internalType: 'string' },
      { name: 'symbol', type: 'string', indexed: false, internalType: 'string' },
      { name: 'totalSupply', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'beneficiary', type: 'address', indexed: false, internalType: 'address' },
      { name: 'startTimestamp', type: 'uint64', indexed: false, internalType: 'uint64' },
      { name: 'duration', type: 'uint64', indexed: false, internalType: 'uint64' },
    ],
  },
] as const;

// ABI for OpenZeppelin VestingWallet (release functions + view functions)
export const vestingWalletAbi = [
  {
    type: 'function',
    name: 'release',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releasable',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'released',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestedAmount',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'timestamp', type: 'uint64', internalType: 'uint64' },
    ],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'start',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'duration',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'end',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
] as const;

// Standard ERC-20 ABI (subset we need)
export const erc20Abi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

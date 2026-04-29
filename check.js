import { createPublicClient, http, getContract } from 'viem';
import { sepolia } from 'viem/chains';

const vestingAbi = [
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "releasable", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "start", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "duration", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

async function main() {
  const vesting = '0x0f4272dd7018b62dc6e97ecd733504014515b0df';
  const token = '0x71eebadb4ab1c9b29b3b9f0a85d79a4c2621a6ff';

  const owner = await client.readContract({ address: vesting, abi: vestingAbi, functionName: 'owner' });
  const releasable = await client.readContract({ address: vesting, abi: vestingAbi, functionName: 'releasable', args: [token] });
  const start = await client.readContract({ address: vesting, abi: vestingAbi, functionName: 'start' });
  const duration = await client.readContract({ address: vesting, abi: vestingAbi, functionName: 'duration' });

  const bal = await client.readContract({ address: token, abi: [{ 'inputs': [{ 'internalType': 'address', 'name': 'account', 'type': 'address' }], 'name': 'balanceOf', 'outputs': [{ 'internalType': 'uint256', 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }], functionName: 'balanceOf', args: [vesting] }); console.log('Balance:', bal); console.log('Owner:', owner);
  console.log('Releasable:', releasable);
  const released = await client.readContract({ address: vesting, abi: [{ 'inputs': [{ 'internalType': 'address', 'name': 'token', 'type': 'address' }], 'name': 'released', 'outputs': [{ 'internalType': 'uint256', 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }], functionName: 'released', args: [token] }); console.log('Released:', released); const vested = await client.readContract({ address: vesting, abi: [{ 'inputs': [{ 'internalType': 'address', 'name': 'token', 'type': 'address' }, { 'internalType': 'uint64', 'name': 'timestamp', 'type': 'uint64' }], 'name': 'vestedAmount', 'outputs': [{ 'internalType': 'uint256', 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }], functionName: 'vestedAmount', args: [token, BigInt(Math.floor(Date.now() / 1000))] }); console.log('Vested:', vested); console.log('Start:', start, new Date(Number(start) * 1000).toLocaleString());
  console.log('Duration:', duration);
  const block = await client.getBlock(); console.log('Block Timestamp:', block.timestamp); console.log('Now:', Math.floor(Date.now() / 1000));
}

main().catch(console.error);

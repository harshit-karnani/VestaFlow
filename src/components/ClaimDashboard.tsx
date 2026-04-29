import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlock } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { vestingWalletAbi, erc20Abi } from '../config/abi';
import { Bolt, Activity, Cpu, RefreshCw } from 'lucide-react';
import { getDemoStats } from '../utils/demoMath';

export const ClaimDashboard: React.FC = () => {
  const { address } = useAccount();
  const [vestingAddr, setVestingAddr] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);

  const { data: block } = useBlock({ watch: true });
  const [currentTimestamp, setCurrentTimestamp] = useState<bigint>(0n);
  const [pulse, setPulse] = useState(false);
  const [lastMinute, setLastMinute] = useState(-1);

  useEffect(() => {
    if (block?.timestamp) {
      setCurrentTimestamp(block.timestamp);
    } else if (currentTimestamp === 0n) {
      setCurrentTimestamp(BigInt(Math.floor(Date.now() / 1000)));
    }
  }, [block?.timestamp]);

  // Real-time ticking 1-second interval
  useEffect(() => {
    if (!hasLookedUp) return;
    const interval = setInterval(() => {
      setCurrentTimestamp(prev => prev > 0n ? prev + 1n : BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasLookedUp]);

  const { data: startTime } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'start',
    query: { enabled: hasLookedUp && isAddress(vestingAddr) },
  });

  const { data: duration } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'duration',
    query: { enabled: hasLookedUp && isAddress(vestingAddr) },
  });

  const { data: releasedRaw, refetch: refetchReleased } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'released',
    args: [tokenAddr as `0x${string}`],
    query: { enabled: hasLookedUp && isAddress(vestingAddr) },
  });

  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [vestingAddr as `0x${string}`],
    query: { enabled: hasLookedUp && isAddress(tokenAddr) },
  });

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: hasLookedUp && isAddress(tokenAddr) },
  });

  const { writeContract: claimTokens, isPending: isClaiming } = useWriteContract();

  const handleClaim = () => {
    if (!isAddress(vestingAddr) || !isAddress(tokenAddr)) return;
    claimTokens({
      address: vestingAddr as `0x${string}`,
      abi: vestingWalletAbi,
      functionName: 'release',
      args: [tokenAddr as `0x${string}`],
    }, {
      onSuccess: () => {
        setTimeout(() => {
          refetchReleased();
          refetchBalance();
        }, 2000);
      }
    });
  };

  const totalTokensRaw = (tokenBalance || 0n) + (releasedRaw || 0n);
  const totalTokens = Number(formatUnits(totalTokensRaw, 18));
  const released = Number(formatUnits(releasedRaw || 0n, 18));
  
  const start = Number(startTime || 0n);
  const dur = Number(duration || 1n);
  const now = Number(currentTimestamp);

  // Progress logic using demoMath
  const totalMonths = dur / (30 * 24 * 60 * 60); // Convert duration in seconds back to "Months"
  const stats = getDemoStats(totalTokens, totalMonths, start, now);
  
  const vestedAmount = parseFloat(stats.claimable);
  const claimable = Math.max(0, vestedAmount - released);
  const displayClaimable = hasLookedUp ? claimable.toFixed(6) : "0.000000";

  const currentMinuteOfHour = stats.currentMinuteOfHour;

  useEffect(() => {
    const minutesElapsedTotal = now > start ? Math.floor((now - start) / 60) : 0;
    if (minutesElapsedTotal !== lastMinute && lastMinute !== -1) {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }
    setLastMinute(minutesElapsedTotal);
  }, [now, start, lastMinute]);

  const accuralRatePerHour = (totalTokens / (dur / 3600)).toFixed(3);

  if (!hasLookedUp) {
    return (
      <div className="p-16 text-[#1c1c1a] font-sans">
        <div className="max-w-2xl mx-auto bg-stone-300 p-8 border border-stone-300">
          <h2 className="font-display text-2xl font-bold uppercase mb-6 text-stone-900">Access Claim Terminal</h2>
          <div className="space-y-4">
            <div>
              <label className="font-mono text-xs font-bold text-stone-500 uppercase tracking-widest block mb-2">Vesting Contract Address</label>
              <input 
                type="text" 
                value={vestingAddr}
                onChange={e => setVestingAddr(e.target.value)}
                className="w-full bg-[#f9f9f7] border border-[#e2e2d9] p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-none"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-stone-500 uppercase tracking-widest block mb-2">Token Address</label>
              <input 
                type="text" 
                value={tokenAddr}
                onChange={e => setTokenAddr(e.target.value)}
                className="w-full bg-[#f9f9f7] border border-[#e2e2d9] p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-none"
                placeholder="0x..."
              />
            </div>
            <button 
              onClick={() => setHasLookedUp(true)}
              disabled={!isAddress(vestingAddr) || !isAddress(tokenAddr)}
              className="w-full bg-primary text-white font-mono font-bold text-sm tracking-widest uppercase py-4 mt-4 disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              Initialize Node
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-16 text-[#1c1c1a] font-sans">
      <div className="mb-12 border-b border-stone-300 pb-8 flex justify-between items-end">
        <div>
          <span className="font-mono text-xs text-primary mb-2 block tracking-widest uppercase font-bold">TERMINAL ACCESS // NODE_V1</span>
          <h2 className="font-display text-4xl text-stone-900 font-bold uppercase">04 // CLAIMS & SETTLEMENT</h2>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-stone-400 uppercase tracking-tighter">LAST UPDATED</div>
          <div className="font-mono text-lg font-medium text-stone-900">{new Date(now * 1000).toISOString().replace('T', ' ').substring(0, 19)} UTC</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-px bg-stone-300 border border-stone-300">
        {/* Main Claim Card */}
        <div className="col-span-8 bg-stone-100 p-12">
          <div className="flex flex-col gap-8">
            <div>
              <p className="font-mono text-xs text-stone-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-success"></span>
                AVAILABLE TO CLAIM
              </p>
              <h1 className={`font-display text-7xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${pulse ? 'text-primary' : 'text-success'}`}>
                {displayClaimable} <span className="text-4xl">{tokenSymbol || 'TKN'}</span>
              </h1>
              
              {/* 60-Segment Progress Bar */}
              <div className="mt-8">
                <div className="font-mono text-xs text-stone-400 uppercase mb-2">CURRENT HOUR ACCRUAL (MINUTES)</div>
                <div className="flex gap-1 h-6">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 ${i < currentMinuteOfHour ? 'bg-success' : 'bg-stone-300'} transition-colors duration-300`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleClaim}
              disabled={isClaiming || claimable <= 0}
              className="w-full bg-primary text-white py-8 flex items-center justify-center gap-6 group hover:brightness-110 transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-display font-bold uppercase text-4xl">{isClaiming ? 'PROCESSING...' : 'CLAIM ASSETS'}</span>
              <Bolt className="w-10 h-10" />
            </button>

            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-stone-300">
              <div>
                <div className="font-mono text-xs text-stone-400 uppercase mb-1">TOTAL ALLOCATION</div>
                <div className="font-mono text-lg font-medium text-stone-900">{totalTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="font-mono text-xs text-stone-400 uppercase mb-1">ACCRUAL RATE</div>
                <div className="font-mono text-lg font-medium text-stone-900">{accuralRatePerHour} / HR</div>
              </div>
              <div>
                <div className="font-mono text-xs text-stone-400 uppercase mb-1">ALREADY RELEASED</div>
                <div className="font-mono text-lg font-medium text-stone-900">{released.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details Side */}
        <div className="col-span-4 bg-stone-200 p-8 flex flex-col gap-8">
          <div>
            <h3 className="font-mono text-xs font-bold text-stone-900 uppercase mb-4 border-b border-stone-400 pb-2 flex items-center justify-between">
              SYSTEM METRICS
              <Activity className="w-4 h-4" />
            </h3>
            <div className="flex flex-col gap-4 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-stone-300 pb-2">
                <span className="text-stone-500">NETWORK HEALTH</span>
                <span className="text-success font-bold">99.98%</span>
              </div>
              <div className="flex justify-between items-center border-b border-stone-300 pb-2">
                <span className="text-stone-500">SYNC STATUS</span>
                <span className="text-stone-900 font-bold">{block ? 'CONNECTED' : 'WAITING'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-stone-300 pb-2">
                <span className="text-stone-500">CURRENT BLOCK</span>
                <span className="text-stone-900 font-bold">{block?.number ? block.number.toString() : '---'}</span>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-stone-900 p-6 text-white">
              <div className="font-mono text-xs text-stone-400 uppercase mb-4">NODE ARCHITECTURE</div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
                  <Cpu className="text-primary w-6 h-6" />
                </div>
                <div>
                  <div className="font-mono text-lg font-medium text-white">VESTAFLOW_NODE_04</div>
                  <div className="font-mono text-xs text-success">ACTIVE // EMITTING</div>
                </div>
              </div>
              
              <div className="h-24 w-full bg-stone-800 relative overflow-hidden">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ff5f1f 10px, #ff5f1f 11px)' }}></div>
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/20 to-transparent"></div>
                <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-primary/50"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="mt-12 bg-stone-100 border border-stone-300">
        <div className="bg-stone-900 px-8 py-4 flex justify-between items-center">
          <h3 className="font-mono text-xs text-white uppercase tracking-widest font-bold">TRANSACTION HISTORY // LOG</h3>
          <div className="flex gap-4">
            <button className="font-mono text-xs text-white/50 hover:text-white uppercase transition-none">EXPORT CSV</button>
            <button className="font-mono text-xs text-white/50 hover:text-white uppercase transition-none">REFRESH</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-stone-300">
                <th className="px-8 py-4 font-bold text-stone-400 uppercase tracking-tighter">DATE_UTC</th>
                <th className="px-8 py-4 font-bold text-stone-400 uppercase tracking-tighter">ACTION_ID</th>
                <th className="px-8 py-4 font-bold text-stone-400 uppercase tracking-tighter">ASSET_VAL</th>
                <th className="px-8 py-4 font-bold text-stone-400 uppercase tracking-tighter">STATUS</th>
                <th className="px-8 py-4 font-bold text-stone-400 uppercase tracking-tighter">TX_HASH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {/* Dummy data to match the mockup */}
              <tr className="hover:bg-stone-50 transition-none">
                <td className="px-8 py-4 text-stone-900">2024.10.23 09:44</td>
                <td className="px-8 py-4 text-stone-900">CLAIM_ASSET_441</td>
                <td className="px-8 py-4 font-bold">+142.12 {tokenSymbol || 'TKN'}</td>
                <td className="px-8 py-4">
                  <span className="border border-success text-success px-2 py-0.5 text-[10px] font-bold">SETTLED</span>
                </td>
                <td className="px-8 py-4 text-stone-400 font-mono">0x44fa...91a2</td>
              </tr>
              <tr className="hover:bg-stone-50 transition-none">
                <td className="px-8 py-4 text-stone-900">2024.10.22 21:12</td>
                <td className="px-8 py-4 text-stone-900">CLAIM_ASSET_440</td>
                <td className="px-8 py-4 font-bold">+98.44 {tokenSymbol || 'TKN'}</td>
                <td className="px-8 py-4">
                  <span className="border border-success text-success px-2 py-0.5 text-[10px] font-bold">SETTLED</span>
                </td>
                <td className="px-8 py-4 text-stone-400 font-mono">0x22be...12e1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlock } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { formatUnits, isAddress } from 'viem';
import { vestingWalletAbi, erc20Abi } from '../config/abi';
import { Bolt, Activity, Cpu, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

export const ClaimDashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [vestingAddr, setVestingAddr] = useState(() => localStorage.getItem('vf_vestingAddr') || '');
  const [tokenAddr, setTokenAddr] = useState(() => localStorage.getItem('vf_tokenAddr') || '');
  
  // Terminal Access State
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('Establishing Handshake...');

  const { data: block } = useBlock({ watch: true });
  const [currentTimestamp, setCurrentTimestamp] = useState<bigint>(0n);
  const [pulse, setPulse] = useState(false);
  const [lastMinute, setLastMinute] = useState(-1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (block?.timestamp) {
      setCurrentTimestamp(block.timestamp);
    } else if (currentTimestamp === 0n) {
      setCurrentTimestamp(BigInt(Math.floor(Date.now() / 1000)));
    }
  }, [block?.timestamp]);

  // Real-time ticking 1-second interval
  useEffect(() => {
    if (!isAuthorized) return;
    const interval = setInterval(() => {
      setCurrentTimestamp(prev => prev > 0n ? prev + 1n : BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  const enabled = isAuthorized && isAddress(vestingAddr) && isAddress(tokenAddr);

  const { data: startTime, refetch: refetchStart } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'start',
    query: { enabled },
  });

  const { data: duration, refetch: refetchDuration } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'duration',
    query: { enabled },
  });

  const { data: releasedRaw, refetch: refetchReleased } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'released',
    args: [tokenAddr as `0x${string}`],
    query: { enabled },
  });

  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [vestingAddr as `0x${string}`],
    query: { enabled },
  });

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled },
  });

  const queryClient = useQueryClient();

  // Nuclear cache invalidation — clears ALL wagmi contract reads unconditionally
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  // On mount / wallet connect: pull fresh data immediately
  useEffect(() => {
    if (isConnected && enabled) {
      invalidateAll();
    }
  }, [isConnected, enabled]);

  const { writeContract: claimTokens, isPending: isClaiming, data: claimTxHash } = useWriteContract();
  const { isLoading: isConfirmingClaim, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({ hash: claimTxHash });

  const [showSuccess, setShowSuccess] = useState(false);

  // Poll every 2s while tx is confirming — catches the new balance the instant the block lands
  useEffect(() => {
    if (!isConfirmingClaim) return;
    const poll = setInterval(invalidateAll, 2000);
    return () => clearInterval(poll);
  }, [isConfirmingClaim, invalidateAll]);

  // On confirmed: full cache bust + success banner
  useEffect(() => {
    if (isClaimConfirmed) {
      invalidateAll();
      // Second invalidation after a short delay to catch RPC propagation lag
      setTimeout(invalidateAll, 1500);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isClaimConfirmed, invalidateAll]);

  const handleClaim = () => {
    if (!isAddress(vestingAddr) || !isAddress(tokenAddr)) return;
    claimTokens({
      address: vestingAddr as `0x${string}`,
      abi: vestingWalletAbi,
      functionName: 'release',
      args: [tokenAddr as `0x${string}`],
    });
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      invalidateAll();
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const totalTokensRaw = (tokenBalance || 0n) + (releasedRaw || 0n);
  const totalTokens = Number(formatUnits(totalTokensRaw, 18));
  const released = Number(formatUnits(releasedRaw || 0n, 18));

  const start = Number(startTime || 0n);
  const dur = Number(duration || 1n);
  const now = Number(currentTimestamp);

  // Progress logic using actual linear vesting
  const elapsed = Math.max(0, now - start);
  const progress = dur > 0 ? Math.min(1, elapsed / dur) : 1;
  const vestedAmount = totalTokens * progress;
  const claimable = Math.max(0, vestedAmount - released);
  const displayClaimable = enabled ? claimable.toFixed(4) : "0.0000";

  const isFuture = now < start;
  const timeUntilStartSecs = isFuture ? start - now : 0;

  const currentMinuteOfHour = Math.floor((elapsed % 3600) / 60);

  useEffect(() => {
    const minutesElapsedTotal = now > start ? Math.floor((now - start) / 60) : 0;
    if (minutesElapsedTotal !== lastMinute && lastMinute !== -1) {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }
    setLastMinute(minutesElapsedTotal);
  }, [now, start, lastMinute]);

  const accuralRatePerHour = (totalTokens / (dur / 3600)).toFixed(3);

  const handleInitialize = () => {
    setIsInitializing(true);
    setLoadingText('Establishing Handshake...');
    
    setTimeout(() => {
      setLoadingText('Syncing with Sepolia Node...');
    }, 500);
    
    setTimeout(() => {
      setLoadingText('Access Granted.');
    }, 1000);
    
    setTimeout(() => {
      setIsInitializing(false);
      setIsAuthorized(true);
    }, 1500);
  };

  if (!isAuthorized) {
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
                onChange={e => { const v = e.target.value.trim(); setVestingAddr(v); localStorage.setItem('vf_vestingAddr', v); }}
                className="w-full bg-[#f9f9f7] border border-[#e2e2d9] p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-none"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-stone-500 uppercase tracking-widest block mb-2">Token Address</label>
              <input
                type="text"
                value={tokenAddr}
                onChange={e => { const v = e.target.value.trim(); setTokenAddr(v); localStorage.setItem('vf_tokenAddr', v); }}
                className="w-full bg-[#f9f9f7] border border-[#e2e2d9] p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-none"
                placeholder="0x..."
              />
            </div>
            <button
              onClick={handleInitialize}
              disabled={!isAddress(vestingAddr) || !isAddress(tokenAddr) || isInitializing}
              className="w-full bg-primary text-white font-mono font-bold text-sm tracking-widest uppercase py-4 mt-4 disabled:opacity-50 hover:bg-orange-600 transition-colors flex justify-center items-center gap-3 shadow-[0_0_15px_rgba(255,95,31,0.3)] hover:shadow-[0_0_25px_rgba(255,95,31,0.5)]"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingText}
                </>
              ) : (
                'INITIALIZE SYSTEM ACCESS'
              )}
            </button>
            <button
              onClick={() => { setVestingAddr(''); setTokenAddr(''); localStorage.removeItem('vf_vestingAddr'); localStorage.removeItem('vf_tokenAddr'); }}
              className="w-full text-stone-400 font-mono text-xs uppercase tracking-widest py-2 hover:text-stone-700 transition-colors mt-2"
            >
              Clear Inputs
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
        <div className="text-right flex flex-col items-end gap-1">
          <div className="font-mono text-xs text-stone-400 uppercase tracking-tighter">CURRENT BLOCK TIME</div>
          <div className="font-mono text-lg font-medium text-stone-900">{new Date(now * 1000).toLocaleString()} <span className="text-stone-400 text-sm ml-2">({new Date(now * 1000).toISOString().substring(11, 19)} UTC)</span></div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-px bg-stone-300 border border-stone-300">
        {/* Main Claim Card */}
        <div className="col-span-8 bg-stone-100 p-12">
          <div className="flex flex-col gap-8">
            <div>
              <p className="font-mono text-xs text-stone-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className={`w-3 h-3 ${isFuture ? 'bg-orange-400' : 'bg-success'}`}></span>
                {isFuture ? 'VESTING PENDING' : 'AVAILABLE TO CLAIM'}
              </p>

              {isFuture ? (
                <h1 className="font-display text-5xl font-bold tracking-tight text-orange-400">
                  STARTS IN {Math.ceil(timeUntilStartSecs / 60)} MINS
                </h1>
              ) : (
                <h1 className={`font-display text-7xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${pulse ? 'text-primary' : 'text-success'}`}>
                  {displayClaimable} <span className="text-4xl">{tokenSymbol || 'TKN'}</span>
                </h1>
              )}

              {/* 60-Segment Progress Bar */}
              <div className="mt-8">
                <div className="font-mono text-xs text-stone-400 uppercase mb-2">OVERALL VESTING PROGRESS ({Math.floor(progress * 100)}%)</div>
                <div className="flex gap-1 h-6">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 ${i < Math.floor(progress * 60) ? 'bg-success' : 'bg-stone-300'} transition-colors duration-300`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-mono text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">Strict Gas Limiter Active</h4>
                  <p className="text-sm text-stone-600">To prevent excessive Sepolia network fees, withdrawals are locked until your claimable balance reaches <strong>60% of the total allocation</strong> (or the stream fully vests).</p>
                </div>
              </div>

              <button
                onClick={handleClaim}
                disabled={isClaiming || isConfirmingClaim || claimable <= 0 || isFuture || (released === 0 && claimable < totalTokens * 0.6 && progress < 1)}
                className="w-full bg-primary text-white py-8 flex items-center justify-center gap-6 group hover:brightness-110 transition-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`font-display font-bold uppercase ${showSuccess ? 'text-lg tracking-widest' : 'text-4xl'}`}>
                  {showSuccess ? 'Tokens Discharged! Check your Wallet.' : isFuture ? 'NOT YET STARTED' : (released === 0 && claimable < totalTokens * 0.6 && progress < 1) ? '60% MINIMUM REQUIRED' : isClaiming ? 'SIGNING...' : isConfirmingClaim ? 'CONFIRMING...' : 'CLAIM ASSETS'}
                </span>
                {!showSuccess && <Bolt className={`w-10 h-10 ${(isClaiming || isConfirmingClaim) ? 'animate-pulse' : ''}`} />}
              </button>
            </div>

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
                <div className="flex items-center gap-4">
                  <div className="font-mono text-lg font-medium text-stone-900">{released.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <button 
                    onClick={async () => {
                      if (window.ethereum) {
                        try {
                          await window.ethereum.request({
                            method: 'wallet_watchAsset',
                            params: {
                              type: 'ERC20',
                              options: { address: tokenAddr, symbol: tokenSymbol || 'TKN', decimals: 18 },
                            },
                          });
                        } catch (e) { console.error(e); }
                      }
                    }}
                    className="text-[9px] bg-stone-300 hover:bg-stone-400 px-2 py-1 rounded text-stone-700 uppercase tracking-widest transition-colors shrink-0"
                  >
                    Add to Wallet
                  </button>
                </div>
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
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="font-mono text-xs text-white/50 hover:text-white uppercase transition-none flex items-center gap-2"
            >
              {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin" />}
              REFRESH
            </button>
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

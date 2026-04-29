import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useBlock } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { vestingWalletAbi, erc20Abi } from '../config/abi';
import { getExplorerLink } from '../config/wagmi';
import { Search, Clock, Coins, Loader2, Check, AlertCircle, ExternalLink, Lock, Unlock, RefreshCw, Timer } from 'lucide-react';

export const ClaimPanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [vestingAddr, setVestingAddr] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [countdown, setCountdown] = useState('');
  const [nextUnlock, setNextUnlock] = useState('');

  const validVesting = isAddress(vestingAddr);
  const validToken = isAddress(tokenAddr);
  const bothValid = validVesting && validToken;

  // Read vesting info — only enabled after user clicks "Look Up"
  const { data: startTime, refetch: refetchStart, error: startError, isFetching: isFetchingStart } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'start',
    query: { enabled: false },
  });

  const { data: duration, refetch: refetchDuration, error: durationError, isFetching: isFetchingDuration } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'duration',
    query: { enabled: false },
  });

  // Get network block to sync time accurately (handles local OS clock skew)
  const { data: block } = useBlock({ watch: true });
  const [currentTimestamp, setCurrentTimestamp] = useState<bigint>(0n);

  // Update timestamp whenever a new block arrives or fallback to local time with offset
  useEffect(() => {
    if (block?.timestamp) {
      setCurrentTimestamp(block.timestamp);
    } else if (currentTimestamp === 0n) {
      setCurrentTimestamp(BigInt(Math.floor(Date.now() / 1000)));
    }
  }, [block?.timestamp]);

  const { data: vestedAmountRaw, refetch: refetchVested } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'vestedAmount',
    args: [tokenAddr as `0x${string}`, currentTimestamp],
    query: { enabled: false },
  });

  const { data: releasedAmount, refetch: refetchReleased } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'released',
    args: [tokenAddr as `0x${string}`],
    query: { enabled: false },
  });

  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [vestingAddr as `0x${string}`],
    query: { enabled: false },
  });

  const { data: tokenSymbol, refetch: refetchSymbol } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: false },
  });

  const { data: ownerAddr, refetch: refetchOwner } = useReadContract({
    address: vestingAddr as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'owner',
    query: { enabled: false },
  });

  // Claim (release) tokens
  const { writeContract: claimTokens, data: claimTxHash, isPending: isClaiming, error: claimError } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({ hash: claimTxHash });

  // Refetch after claim confirmed
  useEffect(() => {
    if (isClaimConfirmed) {
      refetchVested();
      refetchReleased();
      refetchBalance();
    }
  }, [isClaimConfirmed]);

  // Countdown timer
  useEffect(() => {
    if (startTime === undefined || duration === undefined) return;

    const tick = () => {
      if (currentTimestamp === 0n) return;
      
      const now = Number(currentTimestamp);
      const start = Number(startTime);
      const dur = Number(duration);
      const endTime = start + dur;
      const diff = endTime - now;

      // Next minute unlock countdown
      if (now >= start && now < endTime) {
        const elapsed = now - start;
        const currentMinute = Math.floor(elapsed / 60);
        const nextMinuteAt = start + (currentMinute + 1) * 60;
        const secsToNext = Math.min(nextMinuteAt - now, diff);
        setNextUnlock(`${secsToNext}s`);
      } else if (now < start) {
        setNextUnlock('—');
      } else {
        setNextUnlock('Fully vested');
      }

      if (diff <= 0) {
        setCountdown('Fully vested!');
        return;
      }
      if (now < start) {
        const preStart = start - now;
        const days = Math.floor(preStart / 86400);
        const hours = Math.floor((preStart % 86400) / 3600);
        const mins = Math.floor((preStart % 3600) / 60);
        const secs = preStart % 60;
        setCountdown(`Starts in ${days}d ${hours}h ${mins}m ${secs}s`);
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      setCountdown(`${days}d ${hours}h ${mins}m ${secs}s remaining`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime, duration, currentTimestamp]);

  // Reset looked-up state when addresses change
  useEffect(() => {
    setHasLookedUp(false);
    setLookupError('');
  }, [vestingAddr, tokenAddr]);

  const handleLookup = useCallback(async () => {
    if (!bothValid) return;
    setIsLookingUp(true);
    setLookupError('');
    setHasLookedUp(false);

    try {
      const results = await Promise.allSettled([
        refetchStart(),
        refetchDuration(),
        refetchVested(),
        refetchReleased(),
        refetchBalance(),
        refetchSymbol(),
        refetchOwner(),
      ]);

      // Check if core queries (start, duration) succeeded
      const startResult = results[0];
      const durationResult = results[1];

      if (startResult.status === 'rejected' || durationResult.status === 'rejected') {
        setLookupError('Could not read contract. Make sure the vesting contract address is correct.');
      } else if (
        startResult.status === 'fulfilled' && startResult.value?.data === undefined &&
        durationResult.status === 'fulfilled' && durationResult.value?.data === undefined
      ) {
        setLookupError('No vesting data found. Check that the addresses are correct and belong to a VestingWallet.');
      } else {
        setHasLookedUp(true);
      }
    } catch (e: any) {
      setLookupError(e?.message?.slice(0, 150) || 'Failed to look up vesting info. Check the addresses and try again.');
    } finally {
      setIsLookingUp(false);
    }
  }, [bothValid, refetchStart, refetchDuration, refetchVested, refetchReleased, refetchBalance, refetchSymbol, refetchOwner]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCurrentTimestamp(BigInt(Math.floor(Date.now() / 1000)));
    try {
      await Promise.allSettled([
        refetchVested(),
        refetchReleased(),
        refetchBalance(),
        refetchStart(),
        refetchDuration(),
        refetchOwner(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchVested, refetchReleased, refetchBalance, refetchStart, refetchDuration, refetchOwner]);

  const handleClaim = () => {
    claimTokens({
      address: vestingAddr as `0x${string}`,
      abi: vestingWalletAbi,
      functionName: 'release',
      args: [tokenAddr as `0x${string}`],
    });
  };

  const isFullyVested = startTime !== undefined && duration !== undefined && currentTimestamp > 0n ? (Number(startTime) + Number(duration)) <= Number(currentTimestamp) : false;
  const vestingStarted = startTime !== undefined && currentTimestamp > 0n ? Number(startTime) <= Number(currentTimestamp) : false;
  const isBeneficiary = ownerAddr && address ? (ownerAddr as string).toLowerCase() === address.toLowerCase() : false;
  
  // Calculate releasable amount safely
  const releasedAmountSafe = releasedAmount || 0n;
  const vestedAmountSafe = vestedAmountRaw || 0n;
  const releasableAmount = vestedAmountSafe > releasedAmountSafe ? vestedAmountSafe - releasedAmountSafe : 0n;
  
  const canClaim = isBeneficiary && releasableAmount > 0n;
  const isSepolia = chainId === 11155111;
  const showResults = hasLookedUp && startTime !== undefined;

  // Vesting progress percentage
  const vestingProgress = startTime !== undefined && duration !== undefined && currentTimestamp > 0n
    ? (() => {
        const now = Number(currentTimestamp);
        const start = Number(startTime);
        const dur = Number(duration);
        if (now < start) return 0;
        if (now >= start + dur) return 100;
        return Math.floor(((now - start) / dur) * 100);
      })()
    : 0;

  // Per-minute EMI calculations
  const totalMinutes = duration !== undefined ? Math.max(Math.floor(Number(duration) / 60), 1) : 0;
  const totalTokens = tokenBalance !== undefined && releasedAmount !== undefined
    ? Number(formatUnits(tokenBalance + releasedAmount, 18))
    : Number(formatUnits(releasableAmount, 18));
  const perMinuteEMI = totalMinutes > 0 && totalTokens > 0 ? totalTokens / totalMinutes : 0;
  const per5MinEMI = perMinuteEMI * 5;
  const minutesElapsed = startTime !== undefined && duration !== undefined && currentTimestamp > 0n
    ? (() => {
        const now = Number(currentTimestamp);
        const start = Number(startTime);
        if (now < start) return 0;
        return Math.min(Math.floor((now - start) / 60), totalMinutes);
      })()
    : 0;

  if (!isConnected) {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <Lock className="w-10 h-10 text-white/20 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect Wallet to Claim</h2>
        <p className="text-white/40 text-sm">Connect your wallet to check and claim vested tokens.</p>
      </div>
    );
  }

  if (!isSepolia) {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Wrong Network</h2>
        <p className="text-white/40 text-sm">Switch to Sepolia testnet to claim tokens.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 sm:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Unlock className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Claim Tokens</h2>
          <p className="text-sm text-white/40">Enter contract addresses to check your vested tokens</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="vestingAddress" className="label-text">Vesting Contract Address</label>
          <input id="vestingAddress" className="input-field" placeholder="0x..." value={vestingAddr} onChange={(e) => setVestingAddr(e.target.value.trim())} />
          {vestingAddr && !validVesting && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Invalid address format</p>}
        </div>
        <div>
          <label htmlFor="tokenAddress" className="label-text">Token Contract Address</label>
          <input id="tokenAddress" className="input-field" placeholder="0x..." value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value.trim())} />
          {tokenAddr && !validToken && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Invalid address format</p>}
        </div>
        <button className="btn-secondary w-full flex items-center justify-center gap-2" disabled={!bothValid || isLookingUp} onClick={handleLookup}>
          {isLookingUp ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up...</> : <><Search className="w-4 h-4" /> Look Up Vesting</>}
        </button>
      </div>

      {/* Lookup Error */}
      {lookupError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {lookupError}
          </p>
        </div>
      )}

      {/* Vesting Info */}
      {showResults && (
        <div className="space-y-4 animate-slide-up">
          {/* Vesting Progress */}
          <div className={`rounded-xl p-4 border ${isFullyVested ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-brand-500/10 border-brand-500/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isFullyVested ? <Unlock className="w-4 h-4 text-emerald-400" /> : vestingStarted ? <Clock className="w-4 h-4 text-brand-400 animate-pulse" /> : <Lock className="w-4 h-4 text-white/40" />}
                <span className={`text-sm font-medium ${isFullyVested ? 'text-emerald-400' : vestingStarted ? 'text-brand-300' : 'text-white/50'}`}>
                  {isFullyVested ? 'Fully Vested' : vestingStarted ? 'Vesting in Progress' : 'Not Started'}
                </span>
              </div>
              <span className={`text-sm font-bold font-mono ${isFullyVested ? 'text-emerald-400' : 'text-brand-300'}`}>{vestingProgress}%</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isFullyVested ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-brand-600 to-brand-400'}`}
                style={{ width: `${vestingProgress}%` }}
              />
            </div>
            <p className={`text-lg font-bold font-mono text-center ${isFullyVested ? 'text-emerald-300' : 'text-white'}`}>{countdown}</p>
            {startTime !== undefined && duration !== undefined && (
              <div className="flex justify-between text-xs text-white/30 mt-2">
                <span>Start: {new Date(Number(startTime) * 1000).toLocaleDateString()}</span>
                <span>End: {new Date((Number(startTime) + Number(duration)) * 1000).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Next Unlock Countdown */}
          {vestingStarted && !isFullyVested && (
            <div className="bg-white/[0.02] rounded-xl p-3 border border-brand-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-brand-400 animate-pulse" />
                <span className="text-xs text-white/50">Next Minute Unlock</span>
              </div>
              <span className="text-sm font-bold font-mono text-brand-300">{nextUnlock}</span>
            </div>
          )}

          {/* Hourly EMI Stats */}
          {totalMinutes > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Per-Min EMI</p>
                <p className="text-sm font-bold text-brand-300">~{perMinuteEMI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-white/20">{tokenSymbol || 'tokens'}/min</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Per 5-Min</p>
                <p className="text-sm font-bold text-emerald-400">~{per5MinEMI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-white/20">{tokenSymbol || 'tokens'}/5min</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Mins Elapsed</p>
                <p className="text-sm font-bold text-white">{minutesElapsed.toLocaleString()}</p>
                <p className="text-[10px] text-white/20">of {totalMinutes.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Balances */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-xs text-white/40 mb-1">Claimable Now</p>
              <p className="text-lg font-bold text-emerald-400">
                {formatUnits(releasableAmount, 18).slice(0, 8)} <span className="text-sm font-normal text-white/30">{tokenSymbol || ''}</span>
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-xs text-white/40 mb-1">Already Claimed</p>
              <p className="text-lg font-bold text-white/60">
                {releasedAmount !== undefined ? formatUnits(releasedAmount, 18) : '0'} <span className="text-sm font-normal text-white/30">{tokenSymbol || ''}</span>
              </p>
            </div>
          </div>

          {/* Remaining in vesting */}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-1">Remaining in Vesting Contract</p>
            <p className="text-lg font-bold">
              {tokenBalance !== undefined ? formatUnits(tokenBalance, 18) : '0'} <span className="text-sm font-normal text-white/30">{tokenSymbol || ''}</span>
            </p>
          </div>

          {/* Beneficiary check */}
          {ownerAddr && !isBeneficiary && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Your wallet is not the beneficiary. Only {(ownerAddr as string).slice(0, 6)}...{(ownerAddr as string).slice(-4)} can claim.
              </p>
            </div>
          )}

          {/* Claim Error */}
          {claimError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {claimError.message?.includes('User rejected') ? 'Transaction rejected.' : 'Claim failed. Are you the beneficiary?'}
              </p>
            </div>
          )}

          {/* Claim confirmed */}
          {isClaimConfirmed && claimTxHash && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Tokens claimed successfully!
              </p>
              <a href={getExplorerLink('tx', claimTxHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:underline mt-1 inline-flex items-center gap-1">
                View on Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Claim Button */}
          <div className="flex gap-3">
            <button className="btn-secondary flex items-center gap-2" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={!canClaim || isClaiming || isClaimConfirming} onClick={handleClaim}>
              {isClaiming ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> : isClaimConfirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : !vestingStarted ? <><Lock className="w-4 h-4" /> Not Started</> : <><Coins className="w-4 h-4" /> Claim {releasableAmount > 0n ? formatUnits(releasableAmount, 18).slice(0, 8) : ''} Tokens</>}
            </button>
          </div>

          {/* Links */}
          <div className="flex gap-3 text-xs">
            <a href={getExplorerLink('address', vestingAddr)} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline flex items-center gap-1">
              Vesting Contract <ExternalLink className="w-3 h-3" />
            </a>
            <a href={getExplorerLink('address', tokenAddr)} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline flex items-center gap-1">
              Token Contract <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

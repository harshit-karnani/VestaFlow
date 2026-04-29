import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { factoryAbi, vestingWalletAbi } from '../config/abi';
import { FACTORY_ADDRESS } from '../config/wagmi';
import { formatUnits } from 'viem';

export const StreamRegistry: React.FC = () => {
  const { address } = useAccount();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch deployment count
  const { data: deploymentCountRaw } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'getDeploymentCount',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  const count = Number(deploymentCountRaw || 0n);

  // Fetch all deployments
  const contractsToRead = Array.from({ length: count }).map((_, index) => ({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'getDeployment',
    args: [address as `0x${string}`, BigInt(index)],
  }));

  const { data: deploymentsData } = useReadContracts({
    contracts: contractsToRead,
    query: { enabled: count > 0 && !!address },
  });

  // Fetch released amounts
  const releasedContractsToRead = (deploymentsData || []).map((d) => ({
    address: (d.result as any)?.vestingWallet as `0x${string}`,
    abi: vestingWalletAbi,
    functionName: 'released',
    args: [(d.result as any)?.token as `0x${string}`],
  }));

  const { data: releasedData } = useReadContracts({
    contracts: releasedContractsToRead,
    query: { enabled: !!deploymentsData && deploymentsData.length > 0 },
  });

  // Map to streams
  const streams = (deploymentsData || []).map((d, index) => {
    if (!(d as any).result) return null;
    const res = (d as any).result as any;
    
    const allocated = Number(formatUnits(res.totalSupply, 18));
    const claimedRaw = (releasedData?.[index] as any)?.result as bigint | undefined;
    const claimed = claimedRaw ? Number(formatUnits(claimedRaw, 18)) : 0;
    
    const startTimeMs = Number(res.startTimestamp) * 1000;
    const durationMinutes = Number(res.duration) / 60;
    
    const elapsedMs = Math.max(0, now - startTimeMs);
    const durationMs = durationMinutes * 60 * 1000;
    const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 1;
    const liveAccrual = allocated * progress;
    
    const isClaimed = progress >= 1 && claimed >= allocated;
    
    return {
      id: res.vestingWallet,
      recipient: res.beneficiary.slice(0, 6) + '...' + res.beneficiary.slice(-4),
      allocated,
      claimed,
      startTime: startTimeMs,
      durationMinutes,
      status: isClaimed ? 'CLAIMED' : 'FLOWING',
    };
  }).filter(Boolean) as any[];

  return (
    <div className="animate-fade-in w-full max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b-2 border-stone-900 pb-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-stone-900">
          MASTER STREAM LEDGER <span className="text-[#00d26a] ml-2 text-sm font-mono tracking-widest">• VestaFlow Operational</span>
        </h2>
        <div className="flex items-center gap-2 font-mono text-xs text-stone-500 uppercase">
          <Activity className="w-4 h-4 text-[#ff5f1f]" /> Active Streams: {streams.filter(s => s.status === 'FLOWING').length}
        </div>
      </div>

      <div className="border-2 border-stone-900 bg-stone-50 overflow-visible relative">
        <table className="w-full text-left font-mono text-xs uppercase border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-900 bg-stone-200 text-stone-600">
              <th className="py-4 px-6 font-bold tracking-widest border-r border-stone-300">Recipient</th>
              <th className="py-4 px-6 font-bold tracking-widest border-r border-stone-300">Allocated</th>
              <th className="py-4 px-6 font-bold tracking-widest border-r border-stone-300">Claimed</th>
              <th className="py-4 px-6 font-bold tracking-widest border-r border-stone-300">Live Accrual</th>
              <th className="py-4 px-6 font-bold tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {streams.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 px-6 text-center font-bold text-stone-400">
                  {address ? 'No streams deployed yet.' : 'Connect wallet to view your streams.'}
                </td>
              </tr>
            )}
            {streams.map((stream) => {
              const elapsedMs = Math.max(0, now - stream.startTime);
              const durationMs = stream.durationMinutes * 60 * 1000;
              const progress = Math.min(1, elapsedMs / durationMs);
              const liveAccrual = stream.allocated * progress;
              
              const segments = 60;
              const activeSegments = Math.floor(progress * segments);

              return (
                <tr key={stream.id} className="border-b border-stone-900 hover:bg-stone-200/50 transition-colors group relative">
                  <td className="py-6 px-6 font-bold text-stone-900 border-r border-stone-300">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-stone-900"></div>
                      {stream.recipient}
                    </div>
                  </td>
                  <td className="py-6 px-6 font-black text-[#ff5f1f] text-sm border-r border-stone-300">{stream.allocated.toLocaleString()}</td>
                  <td className="py-6 px-6 font-bold text-stone-500 border-r border-stone-300">{stream.claimed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="py-6 px-6 border-r border-stone-300 relative">
                    {stream.status === 'FLOWING' ? (
                      <div className="font-black text-[#00d26a] drop-shadow-[0_0_8px_rgba(0,210,106,0.5)] flex items-center gap-2 text-sm">
                        {liveAccrual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <Activity className="w-4 h-4 animate-pulse" />
                      </div>
                    ) : (
                      <div className="font-bold text-stone-400 text-sm">
                        {stream.allocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    
                    {/* Hover Detail: 60-segment minute bar */}
                    <div className="absolute left-6 right-6 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-[2px] bg-stone-900 p-1 pointer-events-none z-10 border-2 border-stone-900">
                      {Array.from({ length: segments }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-1.5 ${i < activeSegments ? 'bg-[#ff5f1f]' : 'bg-stone-700'}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-6 px-6">
                    {stream.status === 'FLOWING' ? (
                      <div className="flex items-center gap-2 text-[#00d26a] font-bold">
                        <div className="w-2 h-2 bg-[#00d26a] animate-pulse"></div>
                        FLOWING
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-stone-500 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        CLAIMED
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

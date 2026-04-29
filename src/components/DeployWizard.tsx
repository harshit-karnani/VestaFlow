import React, { useState, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBlock } from 'wagmi';
import { parseUnits, isAddress, decodeEventLog } from 'viem';
import { factoryAbi } from '../config/abi';
import { FACTORY_ADDRESS, getExplorerLink } from '../config/wagmi';
import { Coins, User, Clock, ChevronRight, ChevronLeft, Check, Loader2, ExternalLink, AlertCircle, Sparkles, Copy, Calendar, Timer, UploadCloud } from 'lucide-react';

// Testing mode: duration in minutes for quick testing

interface Allocation {
  address: string;
  amount: string;
}

interface FormData {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  beneficiary: string;
  vestingStartDelayMinutes: string;  // How many minutes from NOW to start (not a datetime string)
  vestingMinutes: string;
  allocations: Allocation[];
}

interface DeployResult {
  tokenAddress: string;
  vestingAddress: string;
  txHash: string;
}

const STEPS = ['Token Details', 'Vesting Setup', 'Review & Deploy'];

export const DeployWizard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: block } = useBlock();
  const [step, setStep] = useState(0);
  const [deployQueue, setDeployQueue] = useState<Allocation[]>([]);
  const [currentDeployIndex, setCurrentDeployIndex] = useState(-1);
  const [deployResults, setDeployResults] = useState<DeployResult[]>([]);
  const [copied, setCopied] = useState('');
  const [tempAmount, setTempAmount] = useState('');

  const [form, setForm] = useState<FormData>({
    tokenName: '',
    tokenSymbol: '',
    totalSupply: '',
    beneficiary: '',
    vestingStartDelayMinutes: '5', // Default: start 5 minutes from now
    vestingMinutes: '',
    allocations: [],
  });

  const { writeContract, data: txHash, error: writeError, isPending: isWriting, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Parse deployed addresses and trigger next queue item
  React.useEffect(() => {
    if (isConfirmed && receipt && txHash) {
      try {
        const deployedEvent = receipt.logs.find((log) => {
          try {
            decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
            return true;
          } catch { return false; }
        });
        if (deployedEvent) {
          const decoded = decodeEventLog({ abi: factoryAbi, data: deployedEvent.data, topics: deployedEvent.topics });
          if (decoded.eventName === 'Deployed') {
            const newRes = {
              tokenAddress: (decoded.args as any).token || deployedEvent.topics[2] ? `0x${deployedEvent.topics[2]?.slice(26)}` : '',
              vestingAddress: (decoded.args as any).vestingWallet || deployedEvent.topics[3] ? `0x${deployedEvent.topics[3]?.slice(26)}` : '',
              txHash,
            };
            setDeployResults(prev => {
               if (prev.some(r => r.txHash === txHash)) return prev;
               return [...prev, newRes];
            });
            setTimeout(() => {
              reset();
              setCurrentDeployIndex(prev => prev + 1);
            }, 1000);
          }
        }
      } catch (e) {
        console.error('Error parsing deploy event:', e);
      }
    }
  }, [isConfirmed, receipt, txHash]);

  const handleAddManual = () => {
    if (isAddress(form.beneficiary) && Number(tempAmount) > 0) {
      setForm(prev => ({
        ...prev,
        allocations: [...prev.allocations, { address: prev.beneficiary, amount: tempAmount }],
        beneficiary: ''
      }));
      setTempAmount('');
    }
  };

  const updateForm = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (step >= 0) {
      if (!form.tokenName.trim()) e.tokenName = 'Token name is required';
      if (!form.tokenSymbol.trim()) e.tokenSymbol = 'Symbol is required';
      else if (form.tokenSymbol.length > 11) e.tokenSymbol = 'Symbol too long (max 11)';
      if (!form.totalSupply) e.totalSupply = 'Supply is required';
      else if (Number(form.totalSupply) <= 0) e.totalSupply = 'Supply must be greater than 0';
    }
    if (step >= 1) {
      if (form.allocations.length === 0) {
        if (!form.beneficiary) e.beneficiary = 'Beneficiary address is required';
        else if (!isAddress(form.beneficiary)) e.beneficiary = 'Invalid Ethereum address';
      }
      if (!form.vestingStartDelayMinutes) e.vestingStartDelayMinutes = 'Start delay is required';
      else if (Number(form.vestingStartDelayMinutes) < 1) e.vestingStartDelayMinutes = 'Start delay must be at least 1 minute';
      if (!form.vestingMinutes) e.vestingMinutes = 'Duration is required';
      else if (Number(form.vestingMinutes) <= 0) e.vestingMinutes = 'Duration must be at least 1 minute';
      else if (Number(form.vestingMinutes) > 1440) e.vestingMinutes = 'Duration cannot exceed 1440 minutes (24h)';
    }
    return e;
  }, [form, step]);

  const totalAllocatedFromCSV = form.allocations.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const GLOBAL_MAX_SUPPLY = Number(form.totalSupply || 0);
  const isExceedingCap = (totalAllocatedFromCSV + Number(tempAmount || 0)) > GLOBAL_MAX_SUPPLY;
  const totalUsers = form.allocations.length > 0 ? form.allocations.length : (isAddress(form.beneficiary) ? 1 : 0);
  const allocatedTokensDisplay = form.allocations.length > 0 ? totalAllocatedFromCSV : (form.totalSupply ? Number(form.totalSupply) : 0);
  const isValidAllocationSummary = totalUsers > 0 && allocatedTokensDisplay > 0;

  const canProceed = (s: number) => {
    if (s === 0) return form.tokenName && form.tokenSymbol && Number(form.totalSupply) > 0;
    if (s === 1) return isValidAllocationSummary && Number(form.vestingStartDelayMinutes) >= 1 && Number(form.vestingMinutes) > 0 && Number(form.vestingMinutes) <= 1440;
    return true;
  };

  const isSepolia = chainId === 11155111;

  const totalMinutes = Number(form.vestingMinutes || 0);
  const durationSeconds = totalMinutes * 60;
  const delayMinutes = Number(form.vestingStartDelayMinutes || 5);
  const vestingEndDate = totalMinutes > 0
    ? new Date(Date.now() + delayMinutes * 60000 + durationSeconds * 1000)
    : null;
  const perMinuteEMI = totalMinutes > 0 && Number(form.totalSupply) > 0 ? Number(form.totalSupply) / totalMinutes : 0;
  const per5MinEMI = perMinuteEMI * 5;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\\n').filter(l => l.trim() !== '');
      const newAllocations: Allocation[] = [];
      lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const address = parts[0].trim();
          const amount = parts[1].trim();
          if (isAddress(address) && !isNaN(Number(amount))) {
            newAllocations.push({ address, amount });
          }
        }
      });
      setForm(prev => ({ ...prev, allocations: newAllocations }));
    };
    reader.readAsText(file);
  };

  const handleDeploy = () => {
    const queue = form.allocations.length > 0 
      ? form.allocations 
      : [{ address: form.beneficiary, amount: form.totalSupply }];
    setDeployQueue(queue);
    setDeployResults([]);
    setCurrentDeployIndex(0);
  };

  React.useEffect(() => {
    if (currentDeployIndex >= 0 && currentDeployIndex < deployQueue.length) {
       const alloc = deployQueue[currentDeployIndex];
       const delaySecs = Number(form.vestingStartDelayMinutes || 5) * 60;
       const baseTime = block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
       const startTs = BigInt(baseTime + delaySecs);
       const supply = parseUnits(alloc.amount || form.totalSupply, 18);
       const durSec = BigInt(durationSeconds);
       writeContract({
         address: FACTORY_ADDRESS,
         abi: factoryAbi,
         functionName: 'deployTokenAndVesting',
         args: [form.tokenName, form.tokenSymbol, supply, alloc.address as `0x${string}`, startTs, durSec],
       });
    } else if (currentDeployIndex >= deployQueue.length && deployQueue.length > 0) {
      // Finished queue
      setCurrentDeployIndex(-1);
    }
  }, [currentDeployIndex]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="glass-card p-12 text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center border border-orange-200">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
        <p className="text-stone-500 max-w-md mx-auto">Connect your MetaMask wallet on the Sepolia testnet to start deploying your token with built-in vesting.</p>
      </div>
    );
  }

  // Wrong network
  if (!isSepolia) {
    return (
      <div className="glass-card p-12 text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Wrong Network</h2>
        <p className="text-stone-500">Please switch to the <span className="text-success font-medium">Sepolia</span> testnet in your wallet to continue.</p>
      </div>
    );
  }

  // Success state
  if (deployResults.length > 0 && currentDeployIndex === -1) {
    return (
      <div className="glass-card p-8 animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center border border-success/30 animate-glow" style={{ '--tw-shadow-color': 'rgba(16, 185, 129, 0.3)' } as any}>
            <Check className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Deployment Successful! 🎉</h2>
          <p className="text-stone-500">Your token and vesting contract are live on Sepolia.</p>
        </div>

        <div className="space-y-4">
          {deployResults.map((res, idx) => (
            <div key={idx} className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <p className="text-xs text-stone-500 mb-1 font-medium uppercase tracking-wider">Deployment #{idx + 1}</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-stone-400 w-16">TOKEN</span>
                  <code className="text-sm font-mono text-primary flex-1 truncate">{res.tokenAddress}</code>
                  <a href={getExplorerLink('address', res.tokenAddress)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-stone-200"><ExternalLink className="w-3 h-3 text-stone-500" /></a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-stone-400 w-16">VESTING</span>
                  <code className="text-sm font-mono text-primary flex-1 truncate">{res.vestingAddress}</code>
                  <a href={getExplorerLink('address', res.vestingAddress)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-stone-200"><ExternalLink className="w-3 h-3 text-stone-500" /></a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-stone-400 w-16">TX</span>
                  <code className="text-sm font-mono text-stone-600 flex-1 truncate">{res.txHash}</code>
                  <a href={getExplorerLink('tx', res.txHash)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-stone-200"><ExternalLink className="w-3 h-3 text-stone-500" /></a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => { setDeployResults([]); setDeployQueue([]); setStep(0); reset(); setForm({ tokenName: '', tokenSymbol: '', totalSupply: '', beneficiary: '', vestingStartDelayMinutes: '5', vestingMinutes: '', allocations: [] }); }} className="btn-secondary flex-1">
            Deploy Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className={`w-8 h-px ${i <= step ? 'bg-primary' : 'bg-stone-200'} transition-colors`} />}
            <button onClick={() => i < step && setStep(i)} className="flex items-center gap-2 group" disabled={i > step}>
              <div className={i < step ? 'step-badge-done' : i === step ? 'step-badge-active' : 'step-badge'}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${i === step ? 'text-stone-900' : 'text-stone-500'}`}>{label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="glass-card p-6 sm:p-8">
        {/* Step 0: Token Details */}
        {step === 0 && (
          <div className="space-y-6 page-enter">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center border border-orange-200">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Token Details</h2>
                <p className="text-sm text-stone-500">Configure your ERC-20 token</p>
              </div>
            </div>

            <div>
              <label htmlFor="tokenName" className="label-text">Token Name</label>
              <input id="tokenName" className="input-field" placeholder="e.g. My Awesome Token" value={form.tokenName} onChange={(e) => updateForm('tokenName', e.target.value)} />
              {step >= 0 && errors.tokenName && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.tokenName}</p>}
            </div>

            <div>
              <label htmlFor="tokenSymbol" className="label-text">Token Symbol</label>
              <input id="tokenSymbol" className="input-field" placeholder="e.g. MAT" value={form.tokenSymbol} onChange={(e) => updateForm('tokenSymbol', e.target.value.toUpperCase())} maxLength={11} />
              {errors.tokenSymbol && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.tokenSymbol}</p>}
            </div>

            <div>
              <label htmlFor="totalSupply" className="label-text">Total Supply</label>
              <input id="totalSupply" className="input-field" type="number" placeholder="e.g. 1000000" min="1" value={form.totalSupply} onChange={(e) => updateForm('totalSupply', e.target.value)} />
              {errors.totalSupply && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.totalSupply}</p>}
              {form.totalSupply && Number(form.totalSupply) > 0 && (
                <p className="text-xs text-stone-900/30 mt-1">{Number(form.totalSupply).toLocaleString()} {form.tokenSymbol || 'tokens'} will be minted</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button className="btn-primary flex items-center gap-2" disabled={!canProceed(0)} onClick={() => setStep(1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Vesting Setup */}
        {step === 1 && (
          <div className="space-y-6 page-enter">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center border border-orange-200">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Vesting Setup</h2>
                <p className="text-sm text-stone-500">Configure who receives the tokens and when</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Panel A: Manual Input */}
              <div className="space-y-4 bg-stone-50 p-5 border-2 border-stone-900 rounded-none brutalist-panel">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b-2 border-stone-900 pb-2 flex justify-between">
                  Panel A: Manual Input
                  {form.allocations.length > 0 && <span className="bg-stone-900 text-white px-2 py-0.5 rounded text-[10px]">{form.allocations.length} IN BATCH</span>}
                </h3>

                <div>
                  <label htmlFor="beneficiary" className="label-text">Beneficiary Wallet Address</label>
                  <input id="beneficiary" className="input-field rounded-none border-2 border-stone-900" placeholder="0x..." value={form.beneficiary} onChange={(e) => updateForm('beneficiary', e.target.value)} />
                  {errors.beneficiary && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.beneficiary}</p>}
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="label-text">Amount ({form.tokenSymbol})</label>
                    <input 
                      className={`input-field rounded-none border-2 ${isExceedingCap ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-stone-900'}`} 
                      type="number" 
                      placeholder="e.g. 1000" 
                      value={tempAmount} 
                      onChange={(e) => setTempAmount(e.target.value)} 
                    />
                  </div>

                  {isExceedingCap && (
                    <div className="text-[11px] font-bold text-red-500 uppercase tracking-widest border border-red-500/20 bg-red-500/5 p-2">
                      Error: Total allocation exceeds the Global Cap of {GLOBAL_MAX_SUPPLY.toLocaleString()} {form.tokenSymbol}.
                    </div>
                  )}

                  <button
                    onClick={handleAddManual}
                    disabled={!isAddress(form.beneficiary) || Number(tempAmount) <= 0 || isExceedingCap}
                    className="w-full bg-[#ff5f1f] text-white font-mono text-xs font-bold uppercase tracking-widest p-3 disabled:opacity-50 hover:opacity-90 transition-none"
                  >
                    ADD TO BATCH
                  </button>
                </div>
              </div>

              {/* Panel B: Bulk Allocation */}
              <div className="space-y-4 bg-stone-50 p-5 border-2 border-stone-900 rounded-none brutalist-panel flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b-2 border-stone-900 pb-2">Panel B: Bulk Allocation</h3>

                <div className="relative flex-grow border-2 border-dashed border-stone-400 hover:border-[#ff5f1f] bg-stone-200/50 flex flex-col items-center justify-center p-8 transition-colors group min-h-[140px]">
                  <input type="file" accept=".csv,.json" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="w-8 h-8 text-stone-400 group-hover:text-[#ff5f1f] mb-3" />
                  <p className="text-xs font-mono font-bold text-center text-stone-600 uppercase">Drag CSV or JSON</p>
                  <p className="text-[10px] font-mono text-center text-stone-500 mt-1 uppercase">(Format: address, amount)</p>
                  {form.allocations.length > 0 && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-stone-900 text-white px-3 py-1 rounded-full text-xs font-mono">
                      <Check className="w-3 h-3" /> {form.allocations.length} Loaded
                    </div>
                  )}
                </div>

                <div className={`p-4 border-2 ${isValidAllocationSummary ? 'border-[#00d26a] bg-[#00d26a]/10' : 'border-stone-900 bg-stone-200'}`}>
                  <p className="font-mono text-xs uppercase font-bold flex items-center justify-between">
                    <span>Validation Summary:</span>
                    {isValidAllocationSummary && <Check className="w-4 h-4 text-[#00d26a]" />}
                  </p>
                  <p className="font-mono text-[11px] mt-2">
                    Total Allocated: <span className="font-black text-[#ff5f1f]">{allocatedTokensDisplay.toLocaleString()} {form.tokenSymbol}</span> across <span className="font-black">{totalUsers} User{totalUsers !== 1 ? 's' : ''}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Vesting Timing — full-width row below both panels */}
            <div className="bg-stone-50 border-2 border-stone-900 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label-text">Vesting Start Delay</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    id="vestingStartDelayMinutes"
                    className="input-field rounded-none border-2 border-stone-900 w-28 text-center font-mono font-bold text-lg"
                    type="number"
                    min="1"
                    max="1440"
                    value={form.vestingStartDelayMinutes}
                    onChange={(e) => updateForm('vestingStartDelayMinutes', e.target.value)}
                  />
                  <span className="font-mono text-sm text-stone-600 uppercase font-bold">minutes from NOW</span>
                </div>
                <p className="text-[10px] text-stone-400 font-mono mt-1 uppercase">
                  Starts: {new Date(Date.now() + Number(form.vestingStartDelayMinutes || 5) * 60000).toLocaleTimeString()} ({new Date(Date.now() + Number(form.vestingStartDelayMinutes || 5) * 60000).toLocaleDateString()})
                </p>
              </div>

              <div>
                <label htmlFor="vestingMinutes" className="label-text">Vesting Duration (minutes)</label>
                <input id="vestingMinutes" className="input-field rounded-none border-2 border-stone-900 mt-1" type="number" placeholder="e.g. 5" min="1" max="1440" value={form.vestingMinutes} onChange={(e) => updateForm('vestingMinutes', e.target.value)} />
                {errors.vestingMinutes && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.vestingMinutes}</p>}
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t-2 border-stone-900">
              <button className="btn-secondary flex items-center gap-2 rounded-none border-2 border-stone-900 uppercase font-bold text-[11px] tracking-widest" onClick={() => setStep(0)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button className="btn-primary flex items-center gap-2 rounded-none uppercase font-bold text-[11px] tracking-widest" disabled={!canProceed(1)} onClick={() => setStep(2)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Deploy */}
        {step === 2 && (
          <div className="space-y-6 page-enter">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Review & Deploy</h2>
                <p className="text-sm text-stone-500">Confirm everything looks right before deploying</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Token</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-stone-500 text-xs">Name</p><p className="font-medium">{form.tokenName}</p></div>
                  <div><p className="text-stone-500 text-xs">Symbol</p><p className="font-medium font-mono">{form.tokenSymbol}</p></div>
                  <div><p className="text-stone-500 text-xs">Supply</p><p className="font-medium">{Number(form.totalSupply).toLocaleString()}</p></div>
                </div>
              </div>

              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Vesting</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Beneficiary</span>
                    <code className="font-mono text-xs text-primary">{form.beneficiary.slice(0, 6)}...{form.beneficiary.slice(-4)}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Vesting Start</span>
                    <span>{new Date(Date.now() + Number(form.vestingStartDelayMinutes || 5) * 60000).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Duration</span>
                    <span>{form.vestingMinutes} minute{Number(form.vestingMinutes) > 1 ? 's' : ''} ({durationSeconds} seconds)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Fully Vested By</span>
                    <span>{vestingEndDate?.toLocaleString() || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Per-Minute EMI</span>
                    <span className="text-primary">~{perMinuteEMI.toLocaleString(undefined, { maximumFractionDigits: 2 })} {form.tokenSymbol}/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Amount</span>
                    <span className="font-medium">{Number(form.totalSupply).toLocaleString()} {form.tokenSymbol}</span>
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Deployer</h3>
                <code className="text-sm font-mono text-stone-600">{address}</code>
              </div>
            </div>

            {writeError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {writeError.message?.includes('User rejected') ? 'Transaction was rejected by user.' : writeError.message?.slice(0, 200) || 'Transaction failed'}
                </p>
              </div>
            )}

            {txHash && isConfirming && (
              <div className="bg-orange-100 border border-orange-200 rounded-xl p-4">
                <p className="text-sm text-primary flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming transaction...
                </p>
                <a href={getExplorerLink('tx', txHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                  View on Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button className="btn-secondary flex items-center gap-2" onClick={() => setStep(1)} disabled={isWriting || isConfirming}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button className="btn-primary flex items-center gap-2" onClick={handleDeploy} disabled={isWriting || isConfirming || (currentDeployIndex >= 0 && currentDeployIndex < deployQueue.length)}>
                {currentDeployIndex >= 0 ? <><Loader2 className="w-4 h-4 animate-spin" /> Batch Deploying {currentDeployIndex + 1}/{deployQueue.length}...</> : isWriting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> : isConfirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : <><Sparkles className="w-4 h-4" /> Deploy Token + Vesting</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

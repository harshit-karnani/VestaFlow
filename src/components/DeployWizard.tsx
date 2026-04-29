import React, { useState, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseUnits, isAddress, decodeEventLog } from 'viem';
import { factoryAbi } from '../config/abi';
import { FACTORY_ADDRESS, getExplorerLink } from '../config/wagmi';
import { Coins, User, Clock, ChevronRight, ChevronLeft, Check, Loader2, ExternalLink, AlertCircle, Sparkles, Copy, Calendar, Timer } from 'lucide-react';

// Testing mode: duration in minutes for quick testing

interface FormData {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  beneficiary: string;
  vestingStartDateTime: string;
  vestingMinutes: string;
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
  const [step, setStep] = useState(0);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [copied, setCopied] = useState('');

  const nowLocal = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState<FormData>({
    tokenName: '',
    tokenSymbol: '',
    totalSupply: '',
    beneficiary: '',
    vestingStartDateTime: nowLocal,
    vestingMinutes: '',
  });

  const { writeContract, data: txHash, error: writeError, isPending: isWriting, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Parse deployed addresses from tx receipt logs
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
            setDeployResult({
              tokenAddress: (decoded.args as any).token || deployedEvent.topics[2] ? `0x${deployedEvent.topics[2]?.slice(26)}` : '',
              vestingAddress: (decoded.args as any).vestingWallet || deployedEvent.topics[3] ? `0x${deployedEvent.topics[3]?.slice(26)}` : '',
              txHash,
            });
          }
        }
      } catch (e) {
        console.error('Error parsing deploy event:', e);
      }
    }
  }, [isConfirmed, receipt, txHash]);

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
      if (!form.beneficiary) e.beneficiary = 'Beneficiary address is required';
      else if (!isAddress(form.beneficiary)) e.beneficiary = 'Invalid Ethereum address';
      if (!form.vestingStartDateTime) e.vestingStartDateTime = 'Start date is required';
      else {
        const startTs = new Date(form.vestingStartDateTime).getTime() / 1000;
        if (startTs <= Date.now() / 1000 - 60) e.vestingStartDateTime = 'Start time must not be in the past';
      }
      if (!form.vestingMinutes) e.vestingMinutes = 'Duration is required';
      else if (Number(form.vestingMinutes) <= 0) e.vestingMinutes = 'Duration must be at least 1 minute';
      else if (Number(form.vestingMinutes) > 1440) e.vestingMinutes = 'Duration cannot exceed 1440 minutes (24h)';
    }
    return e;
  }, [form, step]);

  const canProceed = (s: number) => {
    if (s === 0) return form.tokenName && form.tokenSymbol && Number(form.totalSupply) > 0;
    if (s === 1) return isAddress(form.beneficiary) && form.vestingStartDateTime && Number(form.vestingMinutes) > 0 && Number(form.vestingMinutes) <= 1440;
    return true;
  };

  const isSepolia = chainId === 11155111;

  const totalMinutes = Number(form.vestingMinutes || 0);
  const durationSeconds = totalMinutes * 60;
  const vestingEndDate = form.vestingStartDateTime && durationSeconds > 0
    ? new Date(new Date(form.vestingStartDateTime).getTime() + durationSeconds * 1000)
    : null;
  const perMinuteEMI = totalMinutes > 0 && Number(form.totalSupply) > 0 ? Number(form.totalSupply) / totalMinutes : 0;
  const per5MinEMI = perMinuteEMI * 5;

  const handleDeploy = () => {
    const startTs = BigInt(Math.floor(new Date(form.vestingStartDateTime).getTime() / 1000));
    const supply = parseUnits(form.totalSupply, 18);
    const durSec = BigInt(durationSeconds);
    writeContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: 'deployTokenAndVesting',
      args: [form.tokenName, form.tokenSymbol, supply, form.beneficiary as `0x${string}`, startTs, durSec],
    });
  };

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
  if (deployResult) {
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
          {/* Token Address */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <p className="text-xs text-stone-500 mb-1 font-medium uppercase tracking-wider">ERC-20 Token</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-primary flex-1 truncate">{deployResult.tokenAddress}</code>
              <button onClick={() => copyToClipboard(deployResult.tokenAddress, 'token')} className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors">
                <Copy className="w-4 h-4 text-stone-500" />
              </button>
              <a href={getExplorerLink('address', deployResult.tokenAddress)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors">
                <ExternalLink className="w-4 h-4 text-stone-500" />
              </a>
            </div>
            {copied === 'token' && <p className="text-xs text-success mt-1">Copied!</p>}
          </div>

          {/* Vesting Address */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <p className="text-xs text-stone-500 mb-1 font-medium uppercase tracking-wider">Vesting Contract</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-primary flex-1 truncate">{deployResult.vestingAddress}</code>
              <button onClick={() => copyToClipboard(deployResult.vestingAddress, 'vesting')} className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors">
                <Copy className="w-4 h-4 text-stone-500" />
              </button>
              <a href={getExplorerLink('address', deployResult.vestingAddress)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors">
                <ExternalLink className="w-4 h-4 text-stone-500" />
              </a>
            </div>
            {copied === 'vesting' && <p className="text-xs text-success mt-1">Copied!</p>}
          </div>

          {/* Tx Hash */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <p className="text-xs text-stone-500 mb-1 font-medium uppercase tracking-wider">Transaction</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-stone-600 flex-1 truncate">{deployResult.txHash}</code>
              <a href={getExplorerLink('tx', deployResult.txHash)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors">
                <ExternalLink className="w-4 h-4 text-stone-500" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => { setDeployResult(null); setStep(0); reset(); setForm({ tokenName: '', tokenSymbol: '', totalSupply: '', beneficiary: '', vestingStartDateTime: new Date(Date.now() + 60000).toISOString().slice(0, 16), vestingMinutes: '' }); }} className="btn-secondary flex-1">
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

            <div>
              <label htmlFor="beneficiary" className="label-text">Beneficiary Wallet Address</label>
              <input id="beneficiary" className="input-field" placeholder="0x..." value={form.beneficiary} onChange={(e) => updateForm('beneficiary', e.target.value)} />
              {errors.beneficiary && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.beneficiary}</p>}
              <p className="text-xs text-stone-900/30 mt-1">The wallet that will receive tokens over the vesting period</p>
            </div>

            <div>
              <label htmlFor="vestingStartDateTime" className="label-text">Vesting Start Date</label>
              <input id="vestingStartDateTime" className="input-field" type="datetime-local" value={form.vestingStartDateTime} onChange={(e) => updateForm('vestingStartDateTime', e.target.value)} />
              {errors.vestingStartDateTime && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.vestingStartDateTime}</p>}
              <p className="text-xs text-stone-900/30 mt-1">When vesting begins (defaults to now)</p>
            </div>

            <div>
              <label htmlFor="vestingMinutes" className="label-text">Vesting Duration (minutes) <span className="text-stone-400">— Testing Mode</span></label>
              <input id="vestingMinutes" className="input-field" type="number" placeholder="e.g. 5" min="1" max="1440" value={form.vestingMinutes} onChange={(e) => updateForm('vestingMinutes', e.target.value)} />
              {errors.vestingMinutes && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.vestingMinutes}</p>}
              {form.vestingMinutes && Number(form.vestingMinutes) > 0 && (
                <p className="text-xs text-stone-900/30 mt-1">= <strong className="text-stone-500">{totalMinutes} minute installments</strong> ({durationSeconds} seconds total)</p>
              )}
            </div>

            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Per-Minute EMI Schedule</span>
              </div>
              <p className="text-xs text-stone-500">
                <strong className="text-stone-900">{Number(form.totalSupply).toLocaleString()} {form.tokenSymbol}</strong> will unlock over <strong className="text-stone-900">{totalMinutes} minutes</strong>.
              </p>
              {perMinuteEMI > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200">
                    <p className="text-[10px] text-stone-900/30 uppercase tracking-wider">Per-Minute EMI</p>
                    <p className="text-sm font-bold text-primary">~{perMinuteEMI.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-stone-900/30">{form.tokenSymbol}</span></p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200">
                    <p className="text-[10px] text-stone-900/30 uppercase tracking-wider">Per 5-Min EMI</p>
                    <p className="text-sm font-bold text-success">~{per5MinEMI.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-stone-900/30">{form.tokenSymbol}</span></p>
                  </div>
                </div>
              )}
              {vestingEndDate && (
                <p className="text-xs text-stone-500">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  Beneficiary can claim anytime • Fully vested by {vestingEndDate.toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button className="btn-secondary flex items-center gap-2" onClick={() => setStep(0)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button className="btn-primary flex items-center gap-2" disabled={!canProceed(1)} onClick={() => setStep(2)}>
                Review <ChevronRight className="w-4 h-4" />
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
                    <span>{new Date(form.vestingStartDateTime).toLocaleString()}</span>
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
              <button className="btn-primary flex items-center gap-2" onClick={handleDeploy} disabled={isWriting || isConfirming}>
                {isWriting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> : isConfirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : <><Sparkles className="w-4 h-4" /> Deploy Token + Vesting</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

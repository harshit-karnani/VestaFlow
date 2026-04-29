import React, { useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { config } from './config/wagmi';
import { DeployWizard } from './components/DeployWizard';
import { ClaimDashboard } from './components/ClaimDashboard';
import { StreamRegistry } from './components/StreamRegistry';
import { LayoutDashboard, Network, Wallet, Coins, Settings, Bell, HelpCircle, FileText } from 'lucide-react';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [tab, setTab] = useState<'deploy' | 'registry' | 'claim'>('claim');
  const [globalTime, setGlobalTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setGlobalTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen flex text-[#1c1c1a]">
            {/* SideNavBar */}
            <aside className="w-64 fixed h-screen border-r border-[#e2e2d9] bg-stone-200 flex flex-col py-8 z-50">
              <div className="px-6 mb-12">
                <h1 className="font-mono font-black text-stone-900 tracking-tighter text-lg uppercase">VESTAFLOW_V1</h1>
                <p className="font-mono text-[10px] tracking-widest text-[#00d26a] mt-1 uppercase">STATUS: OPERATIONAL</p>
              </div>

              <nav className="flex-grow flex flex-col gap-1">
                <button
                  onClick={() => setTab('deploy')}
                  className={`flex items-center gap-3 px-6 py-4 font-mono text-[11px] tracking-widest uppercase transition-all duration-75 text-left
                    ${tab === 'deploy' ? 'border-l-4 border-[#ff5f1f] bg-stone-300 text-stone-900 font-bold' : 'border-l-4 border-transparent text-stone-500 hover:bg-stone-300'}`}
                >
                  <Settings className="w-4 h-4" />
                  01 // ALLOCATE
                </button>
                <button
                  onClick={() => setTab('registry')}
                  className={`flex items-center gap-3 px-6 py-4 font-mono text-[11px] tracking-widest uppercase transition-all duration-75 text-left
                    ${tab === 'registry' ? 'border-l-4 border-[#ff5f1f] bg-stone-300 text-stone-900 font-bold' : 'border-l-4 border-transparent text-stone-500 hover:bg-stone-300'}`}
                >
                  <Network className="w-4 h-4" />
                  02 // STREAM REGISTRY
                </button>
                <button
                  onClick={() => setTab('claim')}
                  className={`flex items-center gap-3 px-6 py-4 font-mono text-[11px] tracking-widest uppercase transition-all duration-75 text-left
                    ${tab === 'claim' ? 'border-l-4 border-[#ff5f1f] bg-stone-300 text-stone-900 font-bold' : 'border-l-4 border-transparent text-stone-500 hover:bg-stone-300'}`}
                >
                  <Coins className="w-4 h-4" />
                  03 // CLAIM PORTAL
                </button>
              </nav>

              <div className="px-6 mb-8">
                <button onClick={() => setTab('deploy')} className="w-full bg-[#ff5f1f] text-white py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:opacity-90 transition-none">
                  LAUNCH ASSET
                </button>
              </div>

              <div className="mt-auto px-6 pt-8 border-t border-[#e2e2d9] flex flex-col gap-2">
                <a className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-stone-500 hover:text-[#ff5f1f] uppercase" href="#">
                  <HelpCircle className="w-4 h-4" />
                  SUPPORT
                </a>
                <a className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-stone-500 hover:text-[#ff5f1f] uppercase" href="#">
                  <FileText className="w-4 h-4" />
                  DOCS
                </a>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="ml-64 flex-grow relative">
              {/* TopNavBar */}
              <header className="h-20 bg-stone-200 border-b border-[#e2e2d9] flex justify-between items-center px-16 sticky top-0 z-40">
                <div className="flex items-center gap-12">
                  <div className="text-xl font-display font-black tracking-tighter text-stone-900 uppercase">VESTAFLOW</div>
                  <nav className="hidden lg:flex items-center gap-8 font-mono uppercase tracking-widest text-xs">
                    <button className="text-stone-900 border-b-2 border-[#ff5f1f] pb-1 font-bold">DASHBOARD</button>
                  </nav>
                </div>

                <div className="flex items-center gap-6">
                  <div className="font-mono text-[10px] text-stone-500 text-right uppercase tracking-widest hidden md:block border-r border-stone-300 pr-6">
                    <div className="font-bold text-stone-900">{new Date(globalTime).toLocaleTimeString()} LOCAL</div>
                    <div>{new Date(globalTime).toISOString().substring(11, 19)} UTC</div>
                  </div>
                  <div className="flex items-center gap-4 text-stone-500">
                    <Settings className="w-5 h-5 cursor-pointer hover:text-[#ff5f1f]" />
                    <Bell className="w-5 h-5 cursor-pointer hover:text-[#ff5f1f]" />
                  </div>
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                      const ready = mounted;
                      const connected = ready && account && chain;
                      return (
                        <div
                          {...(!ready && {
                            'aria-hidden': true,
                            style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                          })}
                        >
                          {(() => {
                            if (!connected) {
                              return (
                                <button onClick={openConnectModal} type="button" className="bg-[#ab3600] text-white px-6 py-2 font-mono text-xs font-bold tracking-widest uppercase hover:bg-[#ff5f1f] transition-none">
                                  CONNECT WALLET
                                </button>
                              );
                            }
                            if (chain.unsupported) {
                              return (
                                <button onClick={openChainModal} type="button" className="bg-red-600 text-white px-6 py-2 font-mono text-xs font-bold tracking-widest uppercase transition-none">
                                  Wrong network
                                </button>
                              );
                            }
                            return (
                              <button onClick={openAccountModal} type="button" className="bg-stone-900 text-white px-6 py-2 font-mono text-xs font-bold tracking-widest uppercase hover:bg-stone-800 transition-none">
                                {account.displayName}
                              </button>
                            );
                          })()}
                        </div>
                      );
                    }}
                  </ConnectButton.Custom>
                </div>
              </header>

              {/* Content */}
              {tab === 'deploy' ? (
                <div className="p-16">
                  <DeployWizard />
                </div>
              ) : tab === 'registry' ? (
                <div className="p-16">
                  <StreamRegistry />
                </div>
              ) : (
                <ClaimDashboard />
              )}

              {/* Footer */}
              <footer className="bg-stone-900 border-t border-stone-800 flex justify-between items-center px-16 py-4 w-full mt-24">
                <div className="font-mono text-[10px] tracking-tighter text-white font-black uppercase">© 2024 VESTAFLOW. ALL RIGHTS RESERVED.</div>
                <div className="flex gap-8 font-mono text-[10px] tracking-tighter text-stone-500">
                  <button className="hover:text-[#ff5f1f] uppercase">PRIVACY</button>
                  <button className="hover:text-[#ff5f1f] uppercase">TERMS</button>
                  <button className="hover:text-[#ff5f1f] uppercase">SYSTEM STATUS</button>
                </div>
              </footer>
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Coins, Users, ShoppingBag, Pickaxe, Home, ExternalLink, User, MessageCircle, LogOut } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  coins: number;
  onLogout: () => void;
  user: FirebaseUser | null;
}

export function Navbar({ activeTab, setActiveTab, coins, onLogout, user }: NavbarProps) {
  const tabs = [
    { id: 'shop', icon: ShoppingBag, label: 'Store' },
    { id: 'work', icon: Pickaxe, label: 'Earn' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-smp-bg/80 backdrop-blur-md border-b border-smp-border px-4 py-3 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setActiveTab('shop')}
          >
            <div className="w-8 h-8 bg-smp-red flex items-center justify-center pixel-corners group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-xl uppercase italic">K</span>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">KNOCKERS <span className="text-smp-red">STORE</span></span>
          </div>

          <div className="hidden sm:flex items-center gap-1 sm:gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-smp-red/10 text-smp-red' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <tab.icon size={20} />
                <span className="font-medium hidden md:block">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-smp-card px-3 py-1.5 border border-smp-border pixel-corners">
              <Coins className="text-smp-gold" size={18} />
              <span className="font-mono font-bold text-smp-gold whitespace-nowrap">
                {coins.toLocaleString()}
              </span>
            </div>
            <a 
              href="https://discord.gg/drt4CmFJF" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-[#5865F2] hover:bg-[#4752C4] transition-colors rounded-lg hidden sm:block"
            >
              <ExternalLink size={20} />
            </a>

            {user && (
              <button 
                onClick={onLogout}
                className="p-2 bg-smp-card hover:bg-smp-red/20 text-gray-400 hover:text-smp-red transition-all border border-smp-border pixel-corners"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-smp-bg/95 backdrop-blur-xl border-t border-white/10 px-2 py-3 safe-bottom">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all relative ${
                activeTab === tab.id 
                  ? 'text-smp-red' 
                  : 'text-gray-500'
              }`}
            >
              <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-3 w-8 h-1 bg-smp-red rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

export function StoreHeader() {
  return (
    <div className="relative mb-12 overflow-hidden pixel-corners bg-smp-card border border-smp-border">
      <div className="absolute inset-0 bg-gradient-to-r from-smp-red/20 to-transparent pointer-events-none" />
      <div className="p-8 md:p-12 relative flex flex-col md:flex-row items-center gap-8">
        <div className="bg-smp-red p-3 md:p-4 pixel-corners glow-red shrink-0">
          <ShoppingBag className="w-8 h-8 md:w-12 md:h-12 text-white" />
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">OFFICIAL <span className="text-smp-red italic">ARMORY</span></h1>
          <p className="text-gray-400 max-w-xl text-lg leading-relaxed">
            Equip your team for the End Fight. All ranks and kits are permanent for the current season. 
            Claim your power before the dragon awakens and the battle begins.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DiscordSection() {
  return (
    <div className="relative mb-12 overflow-hidden pixel-corners bg-[#5865F2]/10 border border-[#5865F2]/30 p-8 md:p-10">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-[#5865F2] blur-[100px] opacity-20 pointer-events-none" />
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        <div className="space-y-4 text-center md:text-left max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#5865F2] text-white text-[10px] font-bold uppercase tracking-widest pixel-corners">
            Alternative Progress
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white capitalize">
            Earn Ranks via <span className="text-[#5865F2]">Discord</span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Don't have enough coins? Join our community to participate in events and earn permanent server ranks through our official Discord server.
          </p>
        </div>
        <a 
          href="https://discord.gg/drt4CmFJF" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-8 py-5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xl pixel-corners transition-all flex items-center gap-3 shadow-[0_8px_0_0_#3d45a8] active:shadow-none active:translate-y-2 glow-indigo group"
        >
          <ExternalLink size={24} className="group-hover:rotate-12 transition-transform" />
          JOIN DISCORD
        </a>
      </div>
    </div>
  );
}

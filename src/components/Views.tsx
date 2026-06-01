/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Check, X, Coins, Pickaxe, Hammer, Gem, LayoutGrid, Clock, Users, Send, UserPlus, ShieldCheck, User, Save, Trash2, ExternalLink, Camera, Search, Plus, Phone, Bell, MoreVertical, MessageSquarePlus, Loader2 } from 'lucide-react';
import { KITS, ROLES, Kit, Role, UserProfile, FriendRequest, ChatThread, ChatMessage } from '../types';

interface ViewProps {
  coins: number;
  onBuy: (kitId: string, price: number) => Promise<boolean>;
  onBuyRole: (roleId: string, price: number) => Promise<boolean>;
  onWork: () => Promise<number>;
  ownedKits: string[];
  ownedRoles: string[];
  canWork: () => boolean;
  getTimeRemaining: () => number;
  friends: string[];
  onShare: (name: string, amount: number) => Promise<boolean>;
  profile: UserProfile;
  onUpdateProfile: (profile: Partial<UserProfile>) => void;
  friendRequests: FriendRequest[];
  sentRequests: string[];
  onSendRequest: (name: string) => Promise<boolean | 'unavailable' | 'already_friends' | 'already_sent'>;
  onAcceptRequest: (from: string) => Promise<void>;
  onDeclineRequest: (from: string) => Promise<void>;
  chats: ChatThread[];
  messages: Record<string, ChatMessage[]>;
  onSendMessage: (threadId: string, text: string) => void;
  onMarkRead: (threadId: string) => void;
  onCheckName: (name: string) => Promise<boolean>;
  onLogin?: () => void;
}

export function ShopView({ coins, onBuy, onBuyRole, ownedKits, ownedRoles }: Pick<ViewProps, 'coins' | 'onBuy' | 'onBuyRole' | 'ownedKits' | 'ownedRoles'>) {
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [shopCategory, setShopCategory] = useState<'kits' | 'roles'>('kits');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKit(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const getRankColor = (rank: string) => {
    if (rank.includes('Copper')) return 'text-orange-400 border-orange-400';
    if (rank.includes('Iron')) return 'text-slate-300 border-slate-300';
    if (rank.includes('Diamond')) return 'text-cyan-400 border-cyan-400';
    if (rank.includes('Netherite')) return 'text-smp-netherite border-smp-netherite';
    return 'text-gray-400 border-gray-400';
  };

  return (
    <div className="space-y-8 pb-32 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-left space-y-2"
        >
          <h2 className="text-4xl font-bold tracking-tight">KNOCKERS <span className="text-smp-red underline underline-offset-8">MARKET</span></h2>
          <p className="text-gray-400">Invest your coins wisely to gain the competitive edge.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex bg-smp-card p-1 pixel-corners border border-smp-border w-full md:w-auto"
        >
          <button 
            onClick={() => setShopCategory('kits')}
            className={`flex-1 md:flex-none px-6 py-3 pixel-corners font-bold transition-all ${shopCategory === 'kits' ? 'bg-smp-red text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            KITS
          </button>
          <button 
            onClick={() => setShopCategory('roles')}
            className={`flex-1 md:flex-none px-6 py-3 pixel-corners font-bold transition-all ${shopCategory === 'roles' ? 'bg-smp-red text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ROLES
          </button>
        </motion.div>
      </div>

      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {shopCategory === 'kits' ? (
            <motion.div 
              key="kits-grid"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {KITS.map((kit, i) => (
                <motion.div 
                  key={kit.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -5 }}
                  className={`bg-smp-card border-2 ${ownedKits.includes(kit.id) ? 'border-smp-red' : 'border-smp-border'} p-6 pixel-corners flex flex-col group relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="flex-1 space-y-3 relative z-10">
            <div className={`text-[10px] font-bold uppercase tracking-widest border-b pb-1 inline-block ${getRankColor(kit.rank)}`}>
              {kit.rank}
            </div>
            <h3 className="text-2xl font-bold tracking-tight">{kit.name}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{kit.description}</p>
          </div>


                  <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-3 relative z-10">
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span className="text-gray-600 text-[10px] uppercase">Cost</span>
                      <span className="text-smp-gold flex items-center gap-1">
                        <Coins size={14} />
                        {kit.price.toLocaleString()}
                      </span>
                    </div>
                    
                    <button
                      disabled={ownedKits.includes(kit.id) || coins < kit.price}
                      onClick={async () => await onBuy(kit.id, kit.price)}
                      className={`w-full py-3 pixel-corners font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                        ownedKits.includes(kit.id)
                          ? 'bg-smp-red/20 text-smp-red border border-smp-red/30 cursor-default'
                          : coins >= kit.price
                          ? 'bg-smp-red hover:bg-white hover:text-black text-white shadow-lg glow-red'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {ownedKits.includes(kit.id) ? 'ALREADY OWNED' : 'PURCHASE KIT'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="roles-grid"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="bg-white/5 border border-dashed border-gray-700 p-6 pixel-corners flex items-center justify-between gap-6 group hover:border-[#5865F2]/50 transition-colors">
                <div className="flex items-center gap-4 text-gray-400">
                  <div className="p-3 bg-[#5865F2]/10 text-[#5865F2] pixel-corners group-hover:scale-110 transition-transform">
                    <ExternalLink size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">NOT ENOUGH COINS?</p>
                    <p className="text-xs">You can also earn these ranks for free by joining our community.</p>
                  </div>
                </div>
                <a 
                  href="https://discord.gg/drt4CmFJF" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#5865F2] text-white text-xs font-bold pixel-corners hover:scale-105 transition-all shadow-[2px_2px_0_0_#3d45a8]"
                >
                  JOIN DISCORD
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ROLES.map((role, i) => (
                <div 
                  key={role.id}
                  className={`bg-smp-card border-2 ${ownedRoles.includes(role.id) ? 'border-smp-red' : 'border-smp-border'} p-8 pixel-corners space-y-6 flex flex-col group relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className="p-3 bg-white/5 pixel-corners text-smp-red">
                      <ShieldCheck size={32} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Permanent Rank</p>
                      <p className="text-smp-gold font-mono font-bold text-lg">{role.price.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex-1 relative z-10">
                    <h3 className={`text-3xl font-bold tracking-tighter uppercase italic ${role.color}`}>{role.name}</h3>
                    <p className="text-gray-400 mt-2 leading-relaxed">{role.description}</p>
                  </div>

                  <button
                    disabled={ownedRoles.includes(role.id) || coins < role.price}
                    onClick={async () => await onBuyRole(role.id, role.price)}
                    className={`w-full py-4 pixel-corners font-bold transition-all flex items-center justify-center gap-2 active:scale-95 relative z-10 ${
                      ownedRoles.includes(role.id)
                        ? 'bg-smp-red/20 text-smp-red border border-smp-red/30 cursor-default'
                        : coins >= role.price
                        ? 'bg-smp-red hover:bg-white hover:text-black text-white shadow-lg glow-red'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {ownedRoles.includes(role.id) ? (
                      <>
                        <Check size={18} strokeWidth={3} />
                        RANK ACTIVE
                      </>
                    ) : (
                      <>AUTHORIZE RANK</>
                    )}
                  </button>
                </div>
              ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedKit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedKit(null); }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-smp-card border border-smp-border p-5 md:p-8 max-w-3xl w-full pixel-corners relative shadow-2xl"
            >
              <button 
                onClick={() => setSelectedKit(null)} 
                className="absolute -top-12 right-0 md:-right-12 text-gray-400 hover:text-white transition-colors flex items-center gap-2 font-mono group"
              >
                <span className="group-hover:mr-1 transition-all">CLOSE [ESC]</span>
                <X size={32} />
              </button>
              
              <div className="grid grid-cols-1 gap-10">
                <div className="space-y-8">
                  <div>
                    <h3 className="text-4xl font-bold tracking-tight">{selectedKit.name}</h3>
                    <p className={`font-bold mt-2 text-lg italic ${getRankColor(selectedKit.rank)}`}>{selectedKit.rank}</p>
                    <p className="text-gray-400 mt-4 leading-relaxed">{selectedKit.description}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-2 border-smp-red pl-2">Included Items</p>
                    <ul className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedKit.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-200 bg-white/5 px-4 py-3 pixel-corners text-sm border border-transparent hover:border-smp-red transition-all cursor-default group">
                          <Check size={16} className="text-smp-red group-hover:scale-125 transition-transform" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-6 border-t border-smp-border flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Investment</span>
                      <div className="text-3xl font-mono font-bold text-smp-gold flex items-center gap-2">
                        <Coins size={28} />
                        {selectedKit.price.toLocaleString()}
                      </div>
                    </div>
                    <button
                      disabled={ownedKits.includes(selectedKit.id) || coins < selectedKit.price}
                      onClick={async () => {
                        if (await onBuy(selectedKit.id, selectedKit.price)) setSelectedKit(null);
                      }}
                      className={`w-full md:w-auto px-8 py-4 pixel-corners font-bold text-lg transition-all ${
                        ownedKits.includes(selectedKit.id)
                          ? 'bg-smp-red/20 text-smp-red cursor-default'
                          : coins >= selectedKit.price
                          ? 'bg-smp-red text-white hover:bg-red-500 glow-red shadow-[6px_6px_0px_0px_#991b1b] active:shadow-none active:translate-x-1 active:translate-y-1'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {ownedKits.includes(selectedKit.id) ? 'ALREADY OWNED' : 'CONFIRM PURCHASE'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WorkView({ onWork, canWork, getTimeRemaining }: Pick<ViewProps, 'onWork' | 'canWork' | 'getTimeRemaining'>) {
  const [mining, setMining] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(getTimeRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [getTimeRemaining]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startMining = async () => {
    if (!canWork() || mining) return;
    setMining(true);
    setReward(null);
    try {
      const earned = await onWork();
      setReward(earned);
    } catch (e) {
      console.error('Work failed', e);
    } finally {
      setMining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 px-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">THE <span className="text-smp-gold underline underline-offset-8 italic">GRIND</span></h2>
        <p className="text-gray-400">Wealth isn't given, it's earned. Every shift counts towards your next rank in the server.</p>
      </div>

      <div className="bg-smp-card border-2 border-smp-border p-8 md:p-16 pixel-corners text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-smp-border overflow-hidden">
          {mining && <motion.div animate={{ left: ['-100%', '100%'] }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="absolute h-full w-full bg-smp-red shadow-[0_0_10px_#ef4444]" />}
        </div>

        <div className="flex flex-col items-center justify-center gap-10">
          <div className="relative">
             <motion.div 
               animate={mining ? { rotate: [0, -30, 20, -30, 0], scale: [1, 1.1, 1] } : {}}
               transition={{ duration: 0.4, repeat: Infinity }}
               className="relative z-10"
             >
                <Pickaxe size={140} className={mining ? 'text-smp-red glow-red' : 'text-gray-700'} strokeWidth={1} />
             </motion.div>
             <AnimatePresence>
               {reward && (
                 <motion.div 
                   initial={{ opacity: 0, y: 0, scale: 0.5 }}
                   animate={{ opacity: 1, y: -150, scale: 1.5 }}
                   exit={{ opacity: 0 }}
                   className="absolute top-0 left-1/2 -translate-x-1/2 text-5xl font-mono font-bold text-smp-gold whitespace-nowrap flex items-center gap-3 z-50 pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                 >
                   <Coins size={40} /> +{reward.toLocaleString()}
                 </motion.div>
               )}
             </AnimatePresence>
             <div className="absolute inset-0 bg-smp-red/5 blur-3xl rounded-full scale-150 pointer-events-none" />
          </div>

          <div className="space-y-6 w-full max-w-sm relative z-10">
            <button
              disabled={mining || !canWork()}
              onClick={startMining}
              className={`w-full py-6 text-3xl font-bold pixel-corners transition-all ${
                mining 
                  ? 'bg-gray-800 text-gray-500 animate-pulse' 
                  : canWork() 
                  ? 'bg-smp-red text-white hover:bg-red-500 shadow-[0_10px_0_0_#991b1b] active:shadow-none active:translate-y-2 glow-red uppercase italic tracking-widest' 
                  : 'bg-gray-900 text-gray-600 border border-smp-border cursor-not-allowed'
              }`}
            >
              {mining ? 'WORKING...' : canWork() ? 'START SHIFT' : 'ON BREAK'}
            </button>
            <div className={`flex items-center justify-center gap-3 font-mono text-sm uppercase transition-colors ${canWork() ? 'text-smp-red animate-pulse' : 'text-gray-500'}`}>
              <Clock size={18} />
              {canWork() ? 'Shift ready to begin' : `Cooldown: ${formatTime(remainingTime)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Hammer, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Shift Reward', value: '1.5k - 3.5k Coins' },
          { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Shift Duration', value: '1 Minute Shift' },
          { icon: Pickaxe, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Requirement', value: 'Manual Labor' },
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="bg-smp-card border border-smp-border p-6 pixel-corners flex items-center gap-5 group hover:border-smp-red/40 transition-all"
          >
             <div className={`p-4 ${item.bg} ${item.color} pixel-corners group-hover:scale-110 transition-transform`}><item.icon size={28} /></div>
             <div>
               <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{item.label}</p>
               <p className="font-bold text-lg">{item.value}</p>
             </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function SocialView({ friends, onSendRequest, onAcceptRequest, onDeclineRequest, onShare, coins, friendRequests, sentRequests, profile }: Pick<ViewProps, 'friends' | 'onSendRequest' | 'onAcceptRequest' | 'onDeclineRequest' | 'onShare' | 'coins' | 'friendRequests' | 'sentRequests' | 'profile'>) {
  const [friendName, setFriendName] = useState('');
  const [shareAmount, setShareAmount] = useState<number>(0);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (friendName === profile.name) {
      setError("You cannot send a request to yourself.");
      return;
    }

    const result = await onSendRequest(friendName);
    
    if (result === true) {
      setFriendName('');
    } else if (result === 'unavailable') {
      setError("User Unavailable. Check the name and try again.");
    } else if (result === 'already_friends') {
      setError("You are already friends with this player.");
    } else if (result === 'already_sent') {
      setError("Friend request already sent to this player.");
    } else {
      setError("Unable to send request. Check name or status.");
    }
  };

  const handleShare = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedFriend && await onShare(selectedFriend, shareAmount)) {
      setShareAmount(0);
      setSelectedFriend(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 px-4">
      {friendRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-smp-red/10 border border-smp-red/30 p-6 pixel-corners space-y-4"
        >
          <div className="flex items-center gap-2 text-smp-red font-bold uppercase tracking-widest text-sm">
            <Users size={20} />
            Incoming Friend Requests
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friendRequests.map(req => (
              <div key={req.fromName} className="bg-smp-card p-4 border border-smp-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={`https://mc-heads.net/avatar/${req.fromName}`} className="w-8 h-8 pixel-corners" alt={req.fromName} />
                  <span className="font-bold">{req.fromName}</span>
                </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onAcceptRequest(req.fromName)}
                      className="p-4 bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white pixel-corners transition-all"
                    >
                      <Check size={20} />
                    </button>
                    <button 
                      onClick={() => onDeclineRequest(req.fromName)}
                      className="p-4 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white pixel-corners transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-3">
            <h2 className="text-4xl font-bold tracking-tight uppercase">Team <span className="text-smp-red">Roster</span></h2>
            <p className="text-gray-400">Manage your connections and send outbound requests.</p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Type exact player name..."
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                className="flex-1 bg-smp-card border border-smp-border px-5 py-4 pixel-corners focus:border-smp-red outline-none font-mono text-lg transition-all"
              />
              <button type="submit" disabled={!friendName || friendName === profile.name} className="px-6 bg-smp-red text-white pixel-corners hover:bg-red-500 glow-red active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <UserPlus size={28} />
              </button>
            </div>
            {error && (
              <p className="text-smp-red text-[10px] font-bold uppercase italic tracking-wider animate-pulse">{error}</p>
            )}
            {sentRequests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 w-full mb-1">
                  Sent Requests:
                </span>
                {sentRequests.map(name => (
                  <span key={name} className="px-2 py-1 bg-white/5 border border-white/10 text-gray-400 text-xs pixel-corners">
                    {name} (Pending)
                  </span>
                ))}
              </div>
            )}
          </form>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {friends.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-dashed border-smp-border pixel-corners text-gray-500 italic">
                Your roster is currently empty.
              </div>
            ) : (
              friends.map((friend, i) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  key={friend} 
                  onClick={() => setSelectedFriend(friend)}
                  className={`p-5 border-2 pixel-corners flex items-center justify-between cursor-pointer transition-all ${
                    selectedFriend === friend ? 'border-smp-red bg-smp-red/10' : 'border-smp-border bg-smp-card hover:bg-[#1a1414] hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <img src={`https://mc-heads.net/avatar/${friend}`} className="w-12 h-12 pixel-corners animate-pulse" alt={friend} />
                    <span className="font-bold text-xl">{friend}</span>
                  </div>
                  {selectedFriend === friend && (
                     <Check className="text-smp-red" size={20} />
                  )}
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-3">
            <h2 className="text-4xl font-bold tracking-tight">SECURE <span className="text-smp-gold">TRANSFER</span></h2>
            <p className="text-gray-400">Distribute funds securely between team members for coordinated upgrades.</p>
          </div>

          <div className={`bg-smp-card border-2 p-10 pixel-corners transition-all relative ${selectedFriend ? 'border-smp-gold bg-smp-gold/5 opacity-100 shadow-2xl' : 'border-smp-border opacity-40 pointer-events-none'}`}>
            <form onSubmit={handleShare} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <Users size={12} /> Recipient User
                </label>
                <div className="p-4 bg-white/5 border border-smp-border pixel-corners text-smp-gold font-bold text-xl flex items-center justify-between">
                  {selectedFriend || 'SELECT FROM ROSTER'}
                  {selectedFriend && <Check size={20} className="text-smp-gold animate-bounce" />}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <Coins size={12} /> Transfer Credits
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={coins}
                    value={shareAmount}
                    onChange={(e) => setShareAmount(Number(e.target.value))}
                    className="w-full bg-smp-bg border-2 border-smp-border px-6 py-4 pixel-corners font-mono text-3xl focus:border-smp-gold outline-none text-smp-gold shadow-inner"
                  />
                  <Coins className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-800" size={32} />
                </div>
                <div className="flex justify-between text-[10px] font-mono font-bold tracking-wider">
                  <span className="text-gray-500 uppercase">Available: {coins.toLocaleString()}</span>
                  <span className={shareAmount > coins ? 'text-red-500 animate-bounce' : 'text-gray-600'}>
                    {shareAmount > coins ? 'OVER LIQUIDITY LIMIT' : 'ENTER AMOUNT'}
                  </span>
                </div>
              </div>

              <button
                disabled={!selectedFriend || shareAmount <= 0 || shareAmount > coins}
                className="w-full py-5 bg-smp-gold hover:bg-yellow-500 text-black font-bold text-xl pixel-corners transition-all flex items-center justify-center gap-3 shadow-[0_8px_0_0_#92400e] active:shadow-none active:translate-y-2 uppercase italic tracking-widest disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
              >
                <Send size={24} />
                INITIATE TRANSFER
              </button>
            </form>
            {selectedFriend && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-6 pt-6 border-t border-smp-gold/20"
              >
                 <p className="text-xs text-smp-gold italic text-center opacity-80">
                   Caution: Cryptocurrency transfers on Knockers SMP are irreversible. 
                   Ensure the recipient is a trusted team member.
                 </p>
              </motion.div>
            )}
          </div>

          {!selectedFriend && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 bg-smp-red/5 border-2 border-dashed border-smp-red/20 pixel-corners flex items-center gap-4 text-smp-red"
            >
               <LayoutGrid size={32} className="shrink-0" />
               <p className="text-sm font-bold leading-relaxed uppercase tracking-wide">
                 Select an operative from your roster list to begin the secure payment process.
               </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function ProfileView({ profile, onUpdateProfile, onCheckName }: Pick<ViewProps, 'profile' | 'onUpdateProfile' | 'onCheckName'>) {
  const [formData, setFormData] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      // Check name availability
      const isAvailable = await onCheckName(formData.name);
      if (!isAvailable) {
        setErrorMessage(`The Name "${formData.name}" Has Been Taken. Try adding numbers or changing it.`);
        setStatus('error');
        setIsSaving(false);
        return;
      }

      onUpdateProfile(formData);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setErrorMessage("An error occurred while checking name status.");
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePfpChange = (name: string) => {
    // Only auto-update if the current pfp is a standard Minecraft head URL
    const isMcUrl = formData.pfp.includes('mc-heads.net');
    if (isMcUrl) {
      setFormData(prev => ({ ...prev, pfp: `https://mc-heads.net/avatar/${name}` }));
    }
  };

  const resetToMcSkin = () => {
    setFormData(prev => ({ ...prev, pfp: `https://mc-heads.net/avatar/${prev.name}` }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, pfp: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-smp-card border-2 border-smp-border pixel-corners overflow-hidden"
      >
        <div className="bg-smp-red p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />

          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-32 h-32 bg-gray-900 border-4 border-white pixel-corners overflow-hidden shadow-2xl relative z-10 group-hover:opacity-80 transition-all">
              <img 
                src={formData.pfp} 
                alt="Profile" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://mc-heads.net/avatar/Steve';
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={24} className="text-white" />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 flex flex-col gap-1 z-20">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetToMcSkin();
                }}
                className="bg-white text-black p-2 pixel-corners shadow-lg hover:bg-smp-red hover:text-white transition-colors"
                title="Reset to Minecraft Skin"
              >
                <Trash2 size={16} />
              </button>
              <div className="bg-white text-black p-2 pixel-corners shadow-lg">
                <User size={16} />
              </div>
            </div>
          </div>
          <div className="text-center md:text-left relative z-10">
            <h2 className="text-4xl font-bold text-white tracking-tighter uppercase italic">{formData.name || 'Anonymous User'}</h2>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 md:p-12 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <User size={12} /> Character Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData(prev => ({ ...prev, name: newName }));
                  handlePfpChange(newName);
                  if (errorMessage) {
                    setErrorMessage(null);
                    setStatus('idle');
                  }
                }}
                placeholder="Enter Minecraft name..."
                className={`w-full bg-smp-bg border-2 px-5 py-4 pixel-corners focus:border-smp-red outline-none transition-all font-bold ${
                  errorMessage ? 'border-red-500 animate-shake' : 'border-smp-border'
                }`}
              />
              {errorMessage && (
                <p className="text-smp-red text-xs font-bold uppercase italic tracking-wider animate-pulse flex items-center gap-2">
                  <Bell size={14} className="shrink-0" />
                  {errorMessage}
                </p>
              )}
              <p className="text-[10px] text-gray-600 italic">Changing your name automatically updates your avatar skin.</p>
            </div>


          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={12} /> Player Biography
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us about your journey on Knockers SMP..."
              rows={4}
              className="w-full bg-smp-bg border-2 border-smp-border px-5 py-4 pixel-corners focus:border-smp-red outline-none transition-all resize-none leading-relaxed"
            />
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-gray-500 text-xs flex items-center gap-2">
              <Clock size={14} />
              Last profile synchronization: Just now
            </div>
            
            <button
              type="submit"
              disabled={isSaving}
              className={`px-10 py-5 pixel-corners font-bold text-xl flex items-center gap-3 transition-all active:scale-95 shadow-[0_8px_0_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-2 group ${
                status === 'success' 
                  ? 'bg-green-500 text-white shadow-[0_8px_0_0_#166534]' 
                  : 'bg-smp-red text-white hover:bg-white hover:text-black glow-red'
              }`}
            >
              {isSaving ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Pickaxe size={24} />
                </motion.div>
              ) : status === 'success' ? (
                <Check size={24} />
              ) : (
                <Save size={24} className="group-hover:scale-110 transition-transform" />
              )}
              {isSaving ? 'UPLOADING...' : status === 'success' ? 'DATA SAVED' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 pixel-corners flex items-center gap-4 text-gray-400">
          <ShieldCheck size={32} className="text-smp-red" />
          <p className="text-xs leading-relaxed uppercase tracking-wide">
            Your profile data is encrypted and stored locally in your browser's persistent memory bank.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 pixel-corners flex items-center gap-4 text-gray-400 group cursor-help">
          <Users size={32} className="text-smp-red group-hover:scale-110 transition-transform" />
          <p className="text-xs leading-relaxed uppercase tracking-wide">
            Changing your skin name will affect how your allies see you in the Team Roster and Leaderboards.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginView({ onLogin }: Pick<ViewProps, 'onLogin'>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (onLogin) await onLogin();
    } catch (err: any) {
      console.error('Full Login Error Object:', err);
      if (err.code === 'auth/cancelled-popup-request') {
        setError('Login attempt was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Login window was closed. Please try again.');
      } else if (err.message && err.message.includes('auth/popup-blocked')) {
        setError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setError(`Login failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center minecraft-bg-pattern p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-smp-card border-4 border-smp-border p-8 md:p-12 pixel-corners text-center space-y-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-smp-red/10 to-transparent pointer-events-none" />
        
        <div className="space-y-4 relative z-10">
          <div className="w-20 h-20 bg-smp-red mx-auto flex items-center justify-center pixel-corners glow-red shadow-lg">
            <User size={48} className="text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase italic leading-none">
            KNOCKERS <br/> <span className="text-smp-red">SMP</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Protect your progress. Access your coins and team roster from any device.
          </p>
        </div>

        <div className="space-y-4 relative z-10">
          <button 
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className={`w-full py-5 bg-white text-black font-bold text-xl pixel-corners transition-all flex items-center justify-center gap-3 shadow-[0_8px_0_0_#d1d5db] active:shadow-none active:translate-y-2 hover:bg-gray-100 group ${loading ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white">G</div>
            )}
            {loading ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
          </button>
          
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-smp-red text-[10px] font-bold uppercase italic tracking-wider animate-pulse"
            >
              {error}
            </motion.p>
          )}

          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-relaxed">
            By logging in, you agree to our server rules and synchronization terms.
          </p>
        </div>

        <div className="pt-8 border-t border-white/5 opacity-50 relative z-10">
           <div className="flex items-center justify-center gap-6">
             <Pickaxe size={24} className="text-gray-600" />
             <ShieldCheck size={24} className="text-gray-600" />
             <Coins size={24} className="text-gray-600" />
           </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ChatView({ chats, messages, onSendMessage, onMarkRead, profile }: Pick<ViewProps, 'chats' | 'messages' | 'onSendMessage' | 'onMarkRead' | 'profile'>) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const activeThread = chats.find(c => c.id === activeThreadId);
  const threadMessages = activeThreadId ? messages[activeThreadId] || [] : [];

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (activeThreadId && messageText.trim()) {
      onSendMessage(activeThreadId, messageText);
      setMessageText('');
    }
  };

  const filteredChats = chats.filter(c => 
    c.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: ChatThread['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] max-h-[800px] overflow-hidden bg-smp-bg border-2 border-smp-border pixel-corners mx-0 md:mx-4 relative">
      {/* Messages Thread List - Hidden on mobile if a thread is active */}
      <div className={`${activeThreadId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 bg-[#161616] flex flex-col border-r border-white/5`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-white uppercase italic">Connections</h2>
            <div className="flex gap-2">
               <button className="p-2 bg-white/5 hover:bg-white/10 pixel-corners text-gray-400">
                 <Search size={18} />
               </button>
            </div>
          </div>

          <div className="relative">
            <input 
              type="text" 
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-white/5 px-4 py-3 pixel-corners text-sm focus:border-red-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredChats.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2 opacity-30">
              <Users size={32} className="mx-auto" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">No connections yet.<br/>Add friends to chat.</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => {
                  setActiveThreadId(chat.id);
                  onMarkRead(chat.id);
                }}
                className={`p-3 pixel-corners cursor-pointer transition-all flex items-center gap-3 relative group ${
                  activeThreadId === chat.id ? 'bg-white/10 border border-white/5 shadow-inner' : 'hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  <img 
                    src={`https://mc-heads.net/avatar/${chat.participantName}`} 
                    className={`w-12 h-12 pixel-corners transition-transform group-hover:scale-105 ${chat.status === 'offline' ? 'grayscale opacity-70' : ''}`}
                    alt={chat.participantName}
                  />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-[#161616] rounded-full ${getStatusColor(chat.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className={`font-bold truncate text-sm ${chat.unread ? 'text-white' : 'text-gray-300'}`}>
                      {chat.participantName}
                    </h3>
                    <span className="text-[10px] text-gray-600 font-mono">
                      {new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-xs truncate italic ${chat.unread ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
                    {chat.lastMessage}
                  </p>
                </div>
                {chat.unread && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-smp-red shadow-[0_0_8px_#ef4444]" />
                )}
              </div>
            ))
          )}
        </div>

        {/* User Status Bar */}
        <div className="p-3 mt-auto bg-[#0d0d0d] border-t border-white/5 flex items-center gap-3">
          <div className="relative">
            <img src={profile.pfp} className="w-10 h-10 pixel-corners" alt="Me" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-2 border-[#0d0d0d] rounded-full bg-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">{profile.name}</h4>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-500 font-mono tracking-widest">ONLINE</span>
            </div>
          </div>
          <div className="flex gap-1">
             <button className="p-2 text-gray-400 hover:text-white transition-colors"><Bell size={16} /></button>
             <button className="p-2 text-gray-400 hover:text-white transition-colors"><MoreVertical size={16} /></button>
          </div>
        </div>
      </div>

      {/* Main Chat Area - Hidden on mobile if NO thread is active */}
      <div className={`${activeThreadId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-[#0d0d0d] min-w-0`}>
        <AnimatePresence mode="wait">
          {activeThread ? (
            <motion.div 
              key={activeThread.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-w-0"
            >
              {/* Thread Header */}
              <div className="p-3 md:p-4 bg-[#161616] border-b border-white/5 flex items-center justify-between shadow-lg relative z-10">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveThreadId(null)}
                    className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                  <div className="relative">
                    <img src={`https://mc-heads.net/avatar/${activeThread.participantName}`} className="w-8 h-8 md:w-10 md:h-10 pixel-corners" alt={activeThread.participantName} />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-[#161616] rounded-full ${getStatusColor(activeThread.status)}`} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-white uppercase italic">{activeThread.participantName}</h2>
                    <p className="text-[10px] text-gray-500 font-mono tracking-widest">{activeThread.status.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex gap-2 md:gap-4 text-gray-400">
                  <button className="p-1 hover:text-white transition-colors"><Phone size={18} /></button>
                  <button className="p-1 hover:text-white transition-colors invisible md:visible"><Search size={18} /></button>
                  <button className="p-1 hover:text-white transition-colors"><MoreVertical size={18} /></button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth">
                {threadMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-12">
                     <div className="space-y-4 opacity-30">
                        <MessageSquarePlus size={64} className="mx-auto" />
                        <p className="italic text-sm">No messages yet. Forge a new connection in the SMP.</p>
                     </div>
                  </div>
                ) : (
                  threadMessages.map((msg, i) => {
                    const isLastFromSame = i > 0 && threadMessages[i-1].sender === msg.sender;
                    return (
                      <div key={msg.id} className={`flex gap-3 md:gap-4 group ${isLastFromSame ? 'mt-[-1.5rem]' : ''}`}>
                        {!isLastFromSame && (
                           <img 
                            src={msg.sender === profile.name ? profile.pfp : `https://mc-heads.net/avatar/${msg.sender}`} 
                            className="w-8 h-8 md:w-10 md:h-10 pixel-corners shrink-0 mt-1" 
                            alt={msg.sender} 
                          />
                        )}
                        <div className={`flex-1 min-w-0 ${isLastFromSame ? 'ml-11 md:ml-14' : ''}`}>
                          {!isLastFromSame && (
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`font-bold text-sm ${msg.sender === profile.name ? 'text-smp-red' : 'text-gray-300'}`}>{msg.sender}</span>
                              <span className="text-[10px] text-gray-600 font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          <p className="text-sm text-gray-400 break-words leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 md:p-4 bg-[#161616] border-t border-white/5">
                <form onSubmit={handleSend} className="relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message @${activeThread.participantName}`}
                    className="w-full bg-[#0d0d0d] border border-white/10 px-4 md:px-6 py-3 md:py-4 pixel-corners text-sm focus:border-smp-red transition-all outline-none"
                  />
                  <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 flex gap-2 md:gap-3 text-gray-600">
                     <button type="button" className="p-1 hover:text-white transition-colors invisible md:visible"><Plus size={20} /></button>
                     <button type="submit" disabled={!messageText.trim()} className="p-1 text-smp-red hover:scale-110 active:scale-95 transition-all disabled:opacity-30">
                        <Send size={20} />
                     </button>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
               <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
               >
                 <div className="w-24 h-24 bg-white/5 border-2 border-dashed border-white/10 pixel-corners flex items-center justify-center text-gray-800 mx-auto">
                    <MessageSquarePlus size={48} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-2xl font-bold uppercase italic text-gray-200 tracking-tighter">SELECT BROWSING CHANNEL</h3>
                   <p className="text-gray-500 text-sm max-w-xs mx-auto italic">Keep your communications secure. No operative selected from the registry.</p>
                 </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

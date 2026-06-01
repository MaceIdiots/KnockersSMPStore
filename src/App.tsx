/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Navbar, StoreHeader, DiscordSection } from './components/HomeViews';
import { ShopView, WorkView, ProfileView, LoginView } from './components/Views';
import { useStore } from './useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Github, MessageSquare, Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('shop');
  const { 
    state,
    currentUser,
    loading,
    login,
    loginAsGuest,
    logout,
    buyKit, 
    buyRole, 
    sellKit,
    sellRole,
    shareCoins, 
    work, 
    canWork, 
    getTimeRemaining,
    claimDailyReward,
    getDailyRewardTimeRemaining,
    updateProfile,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    sendMessage,
    markRead,
    checkNameAvailability,
    subscribeToMessages,
    adminResetAllCoins,
    withdrawKit,
    withdrawCoins
  } = useStore();

  if (loading) {
    return (
      <div className="min-h-screen minecraft-bg-pattern flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-smp-red"
        >
          <Loader2 size={48} />
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={login} onLoginAsGuest={loginAsGuest} />;
  }

  return (
    <div className="min-h-screen minecraft-bg-pattern flex flex-col">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        coins={state.coins} 
        onLogout={logout}
        user={currentUser}
      />

      <main className="flex-1 pt-24 pb-24 sm:pb-12 max-w-7xl mx-auto w-full px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'shop' && (
              <>
                <StoreHeader />
                <DiscordSection />
                <ShopView 
                  coins={state.coins} 
                  onBuy={buyKit} 
                  onBuyRole={buyRole}
                  onSellKit={sellKit}
                  onSellRole={sellRole}
                  ownedKits={state.ownedKits} 
                  ownedRoles={state.ownedRoles}
                />
              </>
            )}
            {activeTab === 'work' && (
              <WorkView 
                onWork={work} 
                canWork={canWork} 
                getTimeRemaining={getTimeRemaining}
                onClaimDailyReward={claimDailyReward}
                getDailyRewardTimeRemaining={getDailyRewardTimeRemaining}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView 
                profile={state.profile}
                onUpdateProfile={updateProfile}
                onCheckName={checkNameAvailability}
                currentUser={currentUser}
                coins={state.coins}
                ownedKits={state.ownedKits}
                ownedRoles={state.ownedRoles}
                onWithdrawKit={withdrawKit}
                onWithdrawCoins={withdrawCoins}
                onAdminResetAllCoins={adminResetAllCoins}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-smp-border py-12 px-4 bg-smp-card/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-8 h-8 bg-smp-red flex items-center justify-center pixel-corners">
                <span className="text-white font-bold italic uppercase">K</span>
              </div>
              <span className="font-bold text-xl tracking-tight uppercase">KNOCKERS <span className="text-smp-red">STORE</span></span>
            </div>
            <p className="text-gray-500 text-sm max-w-sm">
              The official armory and economy hub for Knockers SMP. 
              Earn coins, equip your team, and dominate the season.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://discord.gg/drt4CmFJF" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-smp-red transition-colors">
              <MessageSquare size={24} />
            </a>
            <div className="w-px h-6 bg-smp-border" />
            <div className="text-gray-500 text-xs font-mono">
              © 2026 KNOCKERS SMP. NOT AN OFFICIAL MINECRAFT PRODUCT.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

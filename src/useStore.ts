/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { UserState, UserProfile, FriendRequest } from './types';
import { auth, db, loginWithGoogle, OperationType, handleFirestoreError } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  addDoc
} from 'firebase/firestore';

const STORAGE_KEY = 'knockers_smp_user_state';

const DEFAULT_STATE: UserState = {
  profile: {
    name: 'Steve',
    pfp: 'https://mc-heads.net/avatar/Steve',
    bio: 'Survivalist in Knockers SMP. Grinding for Netherite.',
  },
  coins: 0,
  ownedKits: [],
  ownedRoles: [],
  friends: [],
  friendRequests: [],
  sentRequests: [],
  chats: [],
  messages: {},
  lastWorked: null,
  lastDailyReward: null,
  resetVersion: 3, // Current version
};

// Initial list of "canonical" names in the SMP to simulate "taken" names
const INITIAL_TAKEN_NAMES = new Set(['Knockbacc', 'Kuro', 'Aaravos', 'Dylan', 'Welcomer', 'Chosekon', 'Gubbylan']);

export function useStore() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UserState>(DEFAULT_STATE);

  // Handle Auth State
  useEffect(() => {
    let fired = false;
    const initAuth = async () => {
      if (fired) return;
      fired = true;
      try {
        const { checkRedirectLogin } = await import('./lib/firebase');
        const user = await checkRedirectLogin();
        if (user) {
          console.log("Found redirect user:", user.email);
          setCurrentUser(user);
        }
      } catch (e) {
        console.error("Redirect check failed:", e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        localStorage.removeItem('smp_guest_user');
      } else {
        const isGuest = localStorage.getItem('smp_guest_user') === 'true';
        if (isGuest) {
          setCurrentUser({
            uid: 'guest_user',
            email: 'guest@knockers.smp',
            displayName: 'Guest Player'
          } as any);
          // Load guest data from local storage
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setState(prev => ({ ...prev, ...parsed }));
            } catch (e) {
              console.error('Local state load failed', e);
            }
          }
        } else {
          setCurrentUser(null);
          // Load from local storage if not logged in
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setState(prev => ({ ...prev, ...parsed }));
            } catch (e) {
              console.error('Local state load failed', e);
            }
          } else {
            setState(DEFAULT_STATE);
          }
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore if logged in
  useEffect(() => {
    if (!currentUser || currentUser.uid === 'guest_user') {
      setLoading(false);
      return;
    }

    const userDoc = doc(db, 'users', currentUser.uid);

    // Profile listener
    const unsubscribeProfile = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const firestoreCoins = data.coins ?? 0;
        const currentResetVersion = data.resetVersion ?? 0;
        
        let needsUpdate = false;
        const updates: any = {};

        // If old version detected, upgrade coins to 0
        if (currentResetVersion < 3 && currentUser) {
          console.log("OLD VERSION DETECTED: Setting migration/starting coins to 0.");
          updates.coins = 0;
          updates.resetVersion = 3;
          needsUpdate = true;
        }

        // Keep / merge guest-purchased progress after login
        const guestKits = state.ownedKits.filter(id => !data.ownedKits?.includes(id));
        const guestRoles = state.ownedRoles.filter(id => !data.ownedRoles?.includes(id));
        
        if (guestKits.length > 0) {
          updates.ownedKits = arrayUnion(...guestKits);
          needsUpdate = true;
        }
        if (guestRoles.length > 0) {
          updates.ownedRoles = arrayUnion(...guestRoles);
          needsUpdate = true;
        }

        if (needsUpdate && currentUser) {
          updateDoc(userDoc, updates).catch(console.error);
          return; // Wait for the next snapshots to apply state changes to UI
        }

        setState(prev => ({
          ...prev,
          profile: data.profile || prev.profile,
          coins: firestoreCoins,
          ownedKits: data.ownedKits || prev.ownedKits,
          ownedRoles: data.ownedRoles || prev.ownedRoles,
          lastWorked: data.lastWorked || prev.lastWorked,
          lastDailyReward: data.lastDailyReward || prev.lastDailyReward,
          resetVersion: currentResetVersion,
          friends: data.friends || prev.friends,
          sentRequests: data.sentRequests || prev.sentRequests,
        }));
        setLoading(false);
      } else {
        // Create initial profile if it doesn't exist, retaining any stats accumulated as guest
        const initialProfile = {
          profile: state.profile,
          coins: state.coins || 0,
          ownedKits: state.ownedKits || [],
          ownedRoles: state.ownedRoles || [],
          lastWorked: state.lastWorked || null,
          lastDailyReward: state.lastDailyReward || null,
          resetVersion: 3,
          createdAt: serverTimestamp(),
          friends: [],
          sentRequests: []
        };
        // Register username and create profile
        const registerUsername = async () => {
          const nameDoc = doc(db, 'usernames', state.profile.name.toLowerCase());
          await setDoc(nameDoc, { uid: currentUser.uid });
          await setDoc(userDoc, initialProfile);
        };
        
        registerUsername()
          .then(() => setLoading(false))
          .catch(e => {
            handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}`);
            setLoading(false);
          });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
      setLoading(false);
    });

    // Chat threads listener
    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      const chatThreads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Map to internal UI format
      const formattedChats = chatThreads.map(chat => {
        const otherIndex = chat.participants.indexOf(currentUser.uid) === 0 ? 1 : 0;
        const otherName = chat.participantNames ? chat.participantNames[otherIndex] : 'Unknown';
        return {
          id: chat.id,
          participantName: otherName,
          lastMessage: chat.lastMessage,
          lastTimestamp: chat.lastTimestamp,
          status: 'online', // Simulated status
          unread: false // Simplified for now
        };
      });

      setState(prev => ({
        ...prev,
        chats: formattedChats
      }));
    });

    // receivedRequests listener
    const receivedRequestsCol = collection(db, 'users', currentUser.uid, 'receivedRequests');
    const unsubscribeRequests = onSnapshot(receivedRequestsCol, (snapshot) => {
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          fromName: data.name || 'Unknown',
          status: data.status || 'pending'
        };
      }) as FriendRequest[];

      setState(prev => ({
        ...prev,
        friendRequests: requests
      }));
    }, (error) => {
      console.error("Failed to fetch friend requests: ", error);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeChats();
      unsubscribeRequests();
    };
  }, [currentUser]);

  // Sync state to local storage (for guests and backup cache for logged in users)
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loading]);

  const stateRef = useRef(state);
  const userRef = useRef(currentUser);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  // Poll / check for backup from Discord on startup or after logins
  useEffect(() => {
    if (!currentUser || loading) return;

    const checkAndApplyBackup = async () => {
      try {
        const res = await fetch(`${window.location.origin}/api/check-backup?uid=${encodeURIComponent(currentUser.uid)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'ok' && data.found && data.backup) {
          console.log("RESTORE-SAVE: Found progress backup from Discord ✅", data.backup);
          const { coins, ownedKits, ownedRoles } = data.backup;
          
          setState(prev => {
            const finalCoins = Math.max(prev.coins, coins);
            const finalKits = Array.from(new Set([...prev.ownedKits, ...ownedKits]));
            const finalRoles = Array.from(new Set([...prev.ownedRoles, ...ownedRoles]));
            
            // If logged in (not guest), write to Firestore as the authenticated user
            if (currentUser.uid !== 'guest_user') {
              const userDoc = doc(db, 'users', currentUser.uid);
              updateDoc(userDoc, {
                coins: finalCoins,
                ownedKits: finalKits,
                ownedRoles: finalRoles,
              }).catch(console.error);
            }
            
            return {
              ...prev,
              coins: finalCoins,
              ownedKits: finalKits,
              ownedRoles: finalRoles,
            };
          });

          // Clear backup so it isn't repeatedly applied
          await fetch(`${window.location.origin}/api/clear-backup?uid=${encodeURIComponent(currentUser.uid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: currentUser.uid })
          }).catch(() => {});
        }
      } catch (e) {
        // Suppress noisy console error of transient 'Failed to fetch' during restarts/loads
        console.warn("RESTORE-SAVE: Progress check server was unavailable or restarting, will retrying shortly.");
      }
    };

    checkAndApplyBackup();
    const interval = setInterval(checkAndApplyBackup, 8000);
    return () => clearInterval(interval);
  }, [currentUser, loading]);

  // Handle Save Progress on Leaving / Unloading Tab (triggers Discord embeds in red)
  useEffect(() => {
    let unloadTriggered = false;

    const handleUnloadAndSave = () => {
      if (unloadTriggered) return;
      unloadTriggered = true;

      const currentState = stateRef.current;
      const user = userRef.current;
      
      const payload = {
        origin: window.location.origin,
        playerName: currentState.profile.name,
        coins: currentState.coins,
        ownedKits: currentState.ownedKits,
        ownedRoles: currentState.ownedRoles,
        uid: user ? user.uid : 'guest_user'
      };

      // Use keepalive: true to ensure the browser successfully dispatches this off-tab request
      fetch(`${window.location.origin}/api/save-progress-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(err => {
        // Silently handle the cancelled promise rejection during unloading 
        // while keepalive makes sure the payload is shipped to the server
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleUnloadAndSave();
      } else if (document.visibilityState === 'visible') {
        unloadTriggered = false;
      }
    };

    window.addEventListener('beforeunload', handleUnloadAndSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadAndSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async () => {
    await loginWithGoogle();
  };

  const loginAsGuest = () => {
    localStorage.setItem('smp_guest_user', 'true');
    setCurrentUser({
      uid: 'guest_user',
      email: 'guest@knockers.smp',
      displayName: 'Guest Player'
    } as any);
  };

  const logout = async () => {
    localStorage.removeItem('smp_guest_user');
    if (currentUser && currentUser.uid !== 'guest_user') {
      await signOut(auth);
    }
    setCurrentUser(null);
    setState(DEFAULT_STATE);
  };

  const updateProfile = async (profileUpdate: Partial<UserProfile>) => {
    const newProfile = { ...state.profile, ...profileUpdate };
    setState(prev => ({ ...prev, profile: newProfile }));

    if (currentUser && currentUser.uid !== 'guest_user') {
      try {
        const userDoc = doc(db, 'users', currentUser.uid);
        await updateDoc(userDoc, { profile: newProfile });
        
        // Also update usernames registry if name changed
        if (profileUpdate.name && profileUpdate.name !== state.profile.name) {
          const oldNameDoc = doc(db, 'usernames', state.profile.name.toLowerCase());
          const newNameDoc = doc(db, 'usernames', profileUpdate.name.toLowerCase());
          
          await setDoc(newNameDoc, { uid: currentUser.uid });
          // Delete old username registry
          const { deleteDoc } = await import('firebase/firestore');
          await deleteDoc(oldNameDoc).catch(console.error);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    }
  };

  const addCoins = async (amount: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + amount }));
    if (currentUser && currentUser.uid !== 'guest_user') {
      const { increment } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', currentUser.uid), { 
        coins: increment(amount) 
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
    }
  };

  const buyKit = async (kitId: string, price: number) => {
    if (state.coins >= price && !state.ownedKits.includes(kitId)) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - price,
        ownedKits: [...prev.ownedKits, kitId],
      }));

      // Notify Discord
      notifyPurchase([kitId], price);

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          coins: increment(-price),
          ownedKits: arrayUnion(kitId)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return true;
    }
    return false;
  };

  const buyRole = async (roleId: string, price: number) => {
    if (state.coins >= price && !state.ownedRoles.includes(roleId)) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - price,
        ownedRoles: [...prev.ownedRoles, roleId],
      }));

      // Notify Discord
      notifyPurchase([roleId], price);

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          coins: increment(-price),
          ownedRoles: arrayUnion(roleId)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return true;
    }
    return false;
  };

  const sellKit = async (kitId: string, price: number) => {
    if (state.ownedKits.includes(kitId)) {
      const sellPrice = Math.floor(price * 0.5); // 50% back
      setState(prev => ({
        ...prev,
        coins: prev.coins + sellPrice,
        ownedKits: prev.ownedKits.filter(id => id !== kitId),
      }));

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          coins: increment(sellPrice),
          ownedKits: arrayRemove(kitId)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return true;
    }
    return false;
  };

  const sellRole = async (roleId: string, price: number) => {
    if (state.ownedRoles.includes(roleId)) {
      const sellPrice = Math.floor(price * 0.5); // 50% back
      setState(prev => ({
        ...prev,
        coins: prev.coins + sellPrice,
        ownedRoles: prev.ownedRoles.filter(id => id !== roleId),
      }));

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          coins: increment(sellPrice),
          ownedRoles: arrayRemove(roleId)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return true;
    }
    return false;
  };

  const sendFriendRequest = async (name: string) => {
    if (!name || name === state.profile.name) return false;
    
    // Check in Firestore usernames registry first
    const usernameDoc = await getDoc(doc(db, 'usernames', name.toLowerCase()));
    let recipientUid: string | null = null;
    
    if (usernameDoc.exists()) {
      recipientUid = usernameDoc.data().uid;
    } else {
       // Fallback to initial registry for demo purposes
      const existsInInitial = Array.from(INITIAL_TAKEN_NAMES).some(
        taken => taken.toLowerCase() === name.trim().toLowerCase()
      );
      if (!existsInInitial) return 'unavailable';
      // In a real app we'd need their UID. Since it's a demo fallback, we simulate success.
      recipientUid = 'demo-uid-' + name;
    }
    
    if (state.friends.includes(name)) return 'already_friends';
    if (state.sentRequests.includes(name)) return 'already_sent';

    setState(prev => ({
      ...prev,
      sentRequests: [...prev.sentRequests, name]
    }));

    if (currentUser && recipientUid) {
      // Add to recipient's received requests
      const recipientReceivedRef = doc(db, 'users', recipientUid, 'receivedRequests', currentUser.uid);
      await setDoc(recipientReceivedRef, {
        name: state.profile.name,
        uid: currentUser.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'receivedRequests'));

      // Add to sender's sent requests
      await updateDoc(doc(db, 'users', currentUser.uid), {
        sentRequests: arrayUnion(name)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
    }

    return true;
  };

  const acceptFriendRequest = async (fromName: string) => {
    // Find recipient UID for the friend
    const usernameDoc = await getDoc(doc(db, 'usernames', fromName.toLowerCase()));
    let fromUid = '';
    if (usernameDoc.exists()) {
      fromUid = usernameDoc.data().uid;
    }

    if (currentUser && fromUid) {
      // Create chat thread in Firestore
      const threadId = [currentUser.uid, fromUid].sort().join('_');
      const chatRef = doc(db, 'chats', threadId);
      
      await setDoc(chatRef, {
        participants: [currentUser.uid, fromUid],
        participantNames: [state.profile.name, fromName],
        lastMessage: 'Connected! Start chatting with your new ally.',
        lastTimestamp: Date.now(),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'chats'));

      // Update current user's entry (add friend, remove from sentRequests)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        friends: arrayUnion(fromName),
        sentRequests: arrayRemove(fromName)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));

      // Update friend's entry (add friend, remove from sentRequests)
      await updateDoc(doc(db, 'users', fromUid), {
        friends: arrayUnion(state.profile.name),
        sentRequests: arrayRemove(state.profile.name)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));

      // Delete the received friend request document on both sides to stay completely clean
      const { deleteDoc } = await import('firebase/firestore');
      const receivedReqDoc = doc(db, 'users', currentUser.uid, 'receivedRequests', fromUid);
      await deleteDoc(receivedReqDoc).catch(console.error);

      const senderReceivedReqDoc = doc(db, 'users', fromUid, 'receivedRequests', currentUser.uid);
      await deleteDoc(senderReceivedReqDoc).catch(console.error);
    }

    setState(prev => {
      const threadId = [currentUser?.uid, fromUid].sort().join('_');
      const newChat = {
        id: threadId,
        participantName: fromName,
        lastMessage: 'Connected! Start chatting with your new ally.',
        lastTimestamp: Date.now(),
        status: 'online' as const,
        unread: true
      };

      return {
        ...prev,
        friends: [...prev.friends, fromName],
        friendRequests: prev.friendRequests.filter(r => r.fromName !== fromName),
        chats: [newChat, ...prev.chats],
        messages: {
          ...prev.messages,
          [threadId]: []
        }
      };
    });
  };

  const declineFriendRequest = async (fromName: string) => {
    setState(prev => ({
      ...prev,
      friendRequests: prev.friendRequests.filter(r => r.fromName !== fromName)
    }));

    if (currentUser) {
      const usernameDoc = await getDoc(doc(db, 'usernames', fromName.toLowerCase()));
      if (usernameDoc.exists()) {
        const fromUid = usernameDoc.data().uid;
        const { deleteDoc } = await import('firebase/firestore');
        const receivedReqDoc = doc(db, 'users', currentUser.uid, 'receivedRequests', fromUid);
        await deleteDoc(receivedReqDoc).catch(console.error);
      }
    }
  };

  const shareCoins = async (friendName: string, amount: number) => {
    if (state.coins >= amount && amount > 0) {
      const newCoins = state.coins - amount;
      setState(prev => ({ ...prev, coins: newCoins }));

      if (currentUser && currentUser.uid !== 'guest_user') {
        try {
          // Update sender
          const { increment } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', currentUser.uid), {
            coins: increment(-amount)
          });

          // Find recipient UID
          const usernameDoc = await getDoc(doc(db, 'usernames', friendName.toLowerCase()));
          if (usernameDoc.exists()) {
            const recipientUid = usernameDoc.data().uid;
            await updateDoc(doc(db, 'users', recipientUid), {
              coins: increment(amount)
            });
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, 'shareCoins');
        }
      }
      return true;
    }
    return false;
  };

  const canWork = () => {
    if (!state.lastWorked) return true;
    const now = Date.now();
    const cooldown = 60 * 1000;
    return now - state.lastWorked > cooldown;
  };

  const getTimeRemaining = () => {
    if (!state.lastWorked) return 0;
    const now = Date.now();
    const cooldown = 60 * 1000;
    const remaining = cooldown - (now - state.lastWorked);
    return Math.max(0, remaining);
  };

  const work = async () => {
    if (canWork()) {
      const reward = Math.floor(Math.random() * 2000) + 1500;
      const now = Date.now();
      setState(prev => ({
        ...prev,
        coins: prev.coins + reward,
        lastWorked: now,
      }));

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), {
          coins: increment(reward),
          lastWorked: now
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return reward;
    }
    return 0;
  };

  const claimDailyReward = async () => {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    
    if (!state.lastDailyReward || now - state.lastDailyReward > cooldown) {
      const reward = 1000; // Small fixed reward
      setState(prev => ({
        ...prev,
        coins: prev.coins + reward,
        lastDailyReward: now,
      }));

      if (currentUser && currentUser.uid !== 'guest_user') {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), {
          coins: increment(reward),
          lastDailyReward: now
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      return reward;
    }
    return 0;
  };

  const getDailyRewardTimeRemaining = () => {
    if (!state.lastDailyReward) return 0;
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    const remaining = cooldown - (now - state.lastDailyReward);
    return Math.max(0, remaining);
  };

  const sendMessage = async (threadId: string, text: string) => {
    if (!text.trim()) return;
    
    const now = Date.now();
    const newMessage = {
      sender: state.profile.name,
      text,
      timestamp: now,
    };

    if (currentUser && currentUser.uid !== 'guest_user') {
      const messageRef = collection(db, 'chats', threadId, 'messages');
      await addDoc(messageRef, {
        senderId: currentUser.uid,
        senderName: state.profile.name,
        text,
        timestamp: now,
        createdAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'messages'));

      // Update last message in thread
      await updateDoc(doc(db, 'chats', threadId), {
        lastMessage: `You: ${text}`,
        lastTimestamp: now,
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'chats'));
    }

    // Mark current chat unread: false
    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [threadId]: [...(prev.messages[threadId] || []), { ...newMessage, id: Math.random().toString() }]
      },
      chats: prev.chats.map(chat => 
        chat.id === threadId 
          ? { ...chat, lastMessage: `You: ${text}`, lastTimestamp: now, unread: false }
          : chat
      )
    }));
  };

  const subscribeToMessages = (threadId: string) => {
    if (!currentUser || !threadId) return () => {};
    
    const messagesQuery = query(collection(db, 'chats', threadId, 'messages'), where('timestamp', '>', 0));
    return onSnapshot(messagesQuery, (msgSnapshot) => {
      const chatMessages = msgSnapshot.docs.map(m => ({
        id: m.id,
        ...m.data()
      })).sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [threadId]: chatMessages.map((m: any) => ({
            id: m.id,
            sender: m.senderName,
            text: m.text,
            timestamp: m.timestamp
          }))
        }
      }));
    });
  };

  const markRead = (threadId: string) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => 
        chat.id === threadId ? { ...chat, unread: false } : chat
      )
    }));
  };

  const notifyPurchase = async (items: string[], amount: number) => {
    try {
      const response = await fetch('/api/notify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: state.profile.name,
          items,
          amount
        })
      });
      if (!response.ok) {
        const data = await response.json();
        console.error('Discord Notification Error:', data.message);
      }
    } catch (e) {
      console.error('Failed to send purchase notification', e);
    }
  };

  const checkNameAvailability = async (name: string) => {
    if (!name) return true;
    const normalized = name.trim().toLowerCase();
    
    // If name is the same as current profile name, it is always available
    if (state.profile.name && state.profile.name.trim().toLowerCase() === normalized) {
      return true;
    }

    try {
      // Check Firestore registry if real user
      const isRealUser = currentUser && currentUser.uid !== 'guest_user';
      if (isRealUser) {
        const nameDoc = await getDoc(doc(db, 'usernames', normalized));
        if (nameDoc.exists()) {
          const data = nameDoc.data();
          if (data && data.uid !== currentUser?.uid) {
            return false;
          }
        }
      }
    } catch (e) {
      console.warn("Firestore checkNameAvailability failed, falling back to local list:", e);
    }

    // Check against initial set
    for (const taken of INITIAL_TAKEN_NAMES) {
      if (taken.toLowerCase() === normalized) {
        return false;
      }
    }
    
    return true;
  };

  const adminResetAllCoins = async () => {
    const isRealUser = currentUser && currentUser.uid !== 'guest_user';
    
    // Wipe local state
    setState(prev => ({
      ...prev,
      coins: 0,
    }));

    if (isRealUser) {
      try {
        const { getDocs, writeBatch } = await import('firebase/firestore');
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((docSnap) => {
          if (docSnap.id === currentUser.uid) {
            batch.update(docSnap.ref, { coins: 0, resetVersion: 3 });
          } else {
            batch.update(docSnap.ref, { coins: 0 });
          }
        });
        
        await batch.commit();
        console.log("Successfully reset all users' coins to 0.");
        return true;
      } catch (e) {
        console.error("Failed to batch reset coins:", e);
        return false;
      }
    }
    return true;
  };

  const withdrawKit = async (kitId: string) => {
    if (state.ownedKits.includes(kitId)) {
      // Consume the kit
      setState(prev => ({
        ...prev,
        ownedKits: prev.ownedKits.filter(id => id !== kitId),
      }));

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const command = `/claimkit ${kitId} ${code}`;

      const isRealUser = currentUser && currentUser.uid !== 'guest_user';
      if (isRealUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          ownedKits: arrayRemove(kitId)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
      
      return {
        success: true,
        code,
        command
      };
    }
    return { success: false, code: '', command: '' };
  };

  const withdrawCoins = async (amount: number) => {
    if (state.coins >= amount && amount > 0) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - amount,
      }));

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const command = `/withdraw ${state.profile.name || 'Player'} ${amount} ${code}`;

      const isRealUser = currentUser && currentUser.uid !== 'guest_user';
      if (isRealUser) {
        const { increment } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          coins: increment(-amount)
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }

      return {
        success: true,
        code,
        command
      };
    }
    return { success: false, code: '', command: '' };
  };

  return {
    state,
    currentUser,
    loading,
    login,
    loginAsGuest,
    logout,
    updateProfile,
    addCoins,
    buyKit,
    buyRole,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    shareCoins,
    work,
    canWork,
    getTimeRemaining,
    claimDailyReward,
    getDailyRewardTimeRemaining,
    sellKit,
    sellRole,
    sendMessage,
    markRead,
    checkNameAvailability,
    subscribeToMessages,
    adminResetAllCoins,
    withdrawKit,
    withdrawCoins,
  };
}

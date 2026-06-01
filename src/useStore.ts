/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { UserState, UserProfile } from './types';
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
  coins: 100000,
  ownedKits: [],
  ownedRoles: [],
  friends: [],
  friendRequests: [],
  sentRequests: [],
  chats: [],
  messages: {},
  lastWorked: null,
};

// Initial list of "canonical" names in the SMP to simulate "taken" names
const INITIAL_TAKEN_NAMES = new Set(['Knockbacc', 'Kuro', 'Aaravos', 'Dylan', 'Welcomer', 'Chosekon', 'Gubbylan']);

export function useStore() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UserState>(DEFAULT_STATE);

  // Handle Auth State
  useEffect(() => {
    const initAuth = async () => {
      // Check if we just returned from a redirect
      const { checkRedirectLogin } = await import('./lib/firebase');
      const redirectUser = await checkRedirectLogin();
      if (redirectUser) {
        setCurrentUser(redirectUser);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        // Load from local storage if not logged in
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Ensure at least 100k even in local storage for this demo as requested
            if (typeof parsed.coins === 'number' && parsed.coins < 100000) {
              parsed.coins = 100000;
            }
            // If they are at 5000, force it to 100000
            if (parsed.coins === 5000) {
              console.log("Found 5000 coins in local storage, overwriting with 100000 as requested.");
              parsed.coins = 100000;
            }
            setState(prev => ({ ...prev, ...parsed, coins: Math.max(parsed.coins, 100000) }));
          } catch (e) {
            console.error('Local state load failed', e);
          }
        } else {
          // If no saved state, start with default
          setState(DEFAULT_STATE);
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore if logged in
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const userDoc = doc(db, 'users', currentUser.uid);

    // Profile listener
    const unsubscribeProfile = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const firestoreCoins = data.coins ?? 0;
        
        // Trial balance check: ensure user has at least 100k for demo purposes as requested
        if (firestoreCoins < 100000) {
          console.log(`FORCING BALANCE: User only had ${firestoreCoins}. Auto-top up to 100,000 for demo.`);
          updateDoc(userDoc, { coins: 100000 }).catch(console.error);
        }

        setState(prev => ({
          ...prev,
          profile: data.profile || prev.profile,
          coins: Math.max(firestoreCoins, 100000),
          ownedKits: data.ownedKits || prev.ownedKits,
          ownedRoles: data.ownedRoles || prev.ownedRoles,
          lastWorked: data.lastWorked || prev.lastWorked,
          friends: data.friends || prev.friends,
          sentRequests: data.sentRequests || prev.sentRequests,
        }));
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile = {
          profile: state.profile,
          coins: state.coins,
          ownedKits: state.ownedKits,
          ownedRoles: state.ownedRoles,
          lastWorked: state.lastWorked,
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
        
        registerUsername().catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}`));
      }
      setLoading(false);
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

      // For each chat, listen to messages
      snapshot.docs.forEach(chatDoc => {
        const messagesQuery = query(collection(db, 'chats', chatDoc.id, 'messages'), where('timestamp', '>', 0));
        onSnapshot(messagesQuery, (msgSnapshot) => {
          const chatMessages = msgSnapshot.docs.map(m => ({
            id: m.id,
            ...m.data()
          })).sort((a: any, b: any) => a.timestamp - b.timestamp);
          
          setState(prev => ({
            ...prev,
            messages: {
              ...prev.messages,
              [chatDoc.id]: chatMessages.map((m: any) => ({
                id: m.id,
                sender: m.senderName,
                text: m.text,
                timestamp: m.timestamp
              }))
            }
          }));
        });
      });
    });

    return () => {
      unsubscribeProfile();
      unsubscribeChats();
    };
  }, [currentUser]);

  // Sync state to local storage (for guests)
  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, currentUser]);

  const login = async () => {
    await loginWithGoogle();
  };

  const logout = async () => {
    await signOut(auth);
    setState(DEFAULT_STATE);
  };

  const updateProfile = async (profileUpdate: Partial<UserProfile>) => {
    const newProfile = { ...state.profile, ...profileUpdate };
    setState(prev => ({ ...prev, profile: newProfile }));

    if (currentUser) {
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
    if (currentUser) {
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

      if (currentUser) {
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

      if (currentUser) {
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

      // Update both users' friends lists
      await updateDoc(doc(db, 'users', currentUser.uid), {
        friends: arrayUnion(fromName)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));

      // Also update the other user's friends list (if permissions allow, otherwise they'll have to accept too)
      // In this SMP model, accepting a friend request should ideally be mutual if we want them both to see it immediately.
      // For now we assume the recipient accepts.
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
  };

  const shareCoins = async (friendName: string, amount: number) => {
    if (state.coins >= amount && amount > 0) {
      const newCoins = state.coins - amount;
      setState(prev => ({ ...prev, coins: newCoins }));

      if (currentUser) {
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

      if (currentUser) {
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

  const sendMessage = async (threadId: string, text: string) => {
    if (!text.trim()) return;
    
    const now = Date.now();
    const newMessage = {
      sender: state.profile.name,
      text,
      timestamp: now,
    };

    if (currentUser) {
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
    
    // Check Firestore registry
    const nameDoc = await getDoc(doc(db, 'usernames', normalized));
    if (nameDoc.exists() && nameDoc.data().uid !== currentUser?.uid) {
      return false;
    }

    // Check against initial set
    for (const taken of INITIAL_TAKEN_NAMES) {
      if (taken.toLowerCase() === normalized && name !== state.profile.name) {
        return false;
      }
    }
    
    return true;
  };

  return {
    state,
    currentUser,
    loading,
    login,
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
    sendMessage,
    markRead,
    checkNameAvailability,
  };
}

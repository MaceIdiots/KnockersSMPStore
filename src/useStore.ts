export function useStore() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UserState>(DEFAULT_STATE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
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
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const userDoc = doc(db, 'users', currentUser.uid);
    const unsubscribeProfile = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setState(prev => ({
          ...prev,
          profile: data.profile || prev.profile,
          coins: data.coins ?? 0,
          ownedKits: data.ownedKits || prev.ownedKits,
          ownedRoles: data.ownedRoles || prev.ownedRoles,
          lastWorked: data.lastWorked || prev.lastWorked,
          friends: data.friends || prev.friends,
          sentRequests: data.sentRequests || prev.sentRequests,
        }));
        setLoading(false);
      } else {
        const initialProfile = {
          profile: state.profile,
          coins: 0,
          ownedKits: [],
          ownedRoles: [],
          lastWorked: null,
          createdAt: serverTimestamp(),
          friends: [],
          sentRequests: []
        };
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
    return () => unsubscribeProfile();
  }, [currentUser]);
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
        
        if (profileUpdate.name && profileUpdate.name !== state.profile.name) {
          const oldNameDoc = doc(db, 'usernames', state.profile.name.toLowerCase());
          const newNameDoc = doc(db, 'usernames', profileUpdate.name.toLowerCase());
          
          await setDoc(newNameDoc, { uid: currentUser.uid });
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
    
    const usernameDoc = await getDoc(doc(db, 'usernames', name.toLowerCase()));
    let recipientUid: string | null = null;
    
    if (usernameDoc.exists()) {
      recipientUid = usernameDoc.data().uid;
    } else {
      const existsInInitial = Array.from(INITIAL_TAKEN_NAMES).some(
        taken => taken.toLowerCase() === name.trim().toLowerCase()
      );
      if (!existsInInitial) return 'unavailable';
      recipientUid = 'demo-uid-' + name;
    }
    
    if (state.friends.includes(name)) return 'already_friends';
    if (state.sentRequests.includes(name)) return 'already_sent';

    setState(prev => ({
      ...prev,
      sentRequests: [...prev.sentRequests, name]
    }));

    if (currentUser && recipientUid) {
      const recipientReceivedRef = doc(db, 'users', recipientUid, 'receivedRequests', currentUser.uid);
      await setDoc(recipientReceivedRef, {
        name: state.profile.name,
        uid: currentUser.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'receivedRequests'));

      await updateDoc(doc(db, 'users', currentUser.uid), {
        sentRequests: arrayUnion(name)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
    }

    return true;
  };
  const acceptFriendRequest = async (fromName: string) => {
    const usernameDoc = await getDoc(doc(db, 'usernames', fromName.toLowerCase()));
    let fromUid = '';
    if (usernameDoc.exists()) {
      fromUid = usernameDoc.data().uid;
    }

    if (currentUser && fromUid) {
      const threadId = [currentUser.uid, fromUid].sort().join('_');
      const chatRef = doc(db, 'chats', threadId);
      
      await setDoc(chatRef, {
        participants: [currentUser.uid, fromUid],
        participantNames: [state.profile.name, fromName],
        lastMessage: 'Connected! Start chatting with your new ally.',
        lastTimestamp: Date.now(),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'chats'));

      await updateDoc(doc(db, 'users', currentUser.uid), {
        friends: arrayUnion(fromName)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
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
        friendRequests: prev.friendRequests.filter((r: any) => r.fromName !== fromName),
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
      friendRequests: prev.friendRequests.filter((r: any) => r.fromName !== fromName)
    }));
  };
  const shareCoins = async (friendName: string, amount: number) => {
    if (state.coins >= amount && amount > 0) {
      const newCoins = state.coins - amount;
      setState(prev => ({ ...prev, coins: newCoins }));

      if (currentUser) {
        try {
          const { increment } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', currentUser.uid), {
            coins: increment(-amount)
          });

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
    
    const nameDoc = await getDoc(doc(db, 'usernames', normalized));
    if (nameDoc.exists() && nameDoc.data().uid !== currentUser?.uid) {
      return false;
    }

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
    subscribeToMessages,
  };
}

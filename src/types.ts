/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Kit {
  id: string;
  name: string;
  rank: string;
  price: number;
  description: string;
  items: string[];
}

export interface Role {
  id: string;
  name: string;
  price: number;
  description: string;
  color: string;
}

export interface UserProfile {
  name: string;
  pfp: string;
  bio: string;
}

export interface FriendRequest {
  fromName: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface ChatThread {
  id: string;
  participantName: string;
  lastMessage: string;
  lastTimestamp: number;
  status: 'online' | 'offline' | 'idle' | 'dnd';
  unread: boolean;
}

export interface UserState {
  profile: UserProfile;
  coins: number;
  ownedKits: string[];
  ownedRoles: string[];
  friends: string[];
  friendRequests: FriendRequest[];
  sentRequests: string[];
  chats: ChatThread[];
  messages: Record<string, ChatMessage[]>;
  lastWorked: number | null;
}

export const KITS: Kit[] = [
  {
    id: 'knocker',
    name: 'Knocker Kit',
    rank: 'Copper Kit',
    price: 22750,
    description: 'The essential starter kit. Balanced for early game survival.',
    items: ['Copper Sword', 'Copper Pickaxe', 'Full Copper Armor', '16x Steak'],
  },
  {
    id: 'elite-kit',
    name: 'Elite Kit',
    rank: 'Iron Kit',
    price: 105000,
    description: 'High-durability iron gear for consistent performance.',
    items: ['Iron Sword (Sharpness II)', 'Iron Pickaxe', 'Full Iron Armor', '32x Steak', '1x Shield'],
  },
  {
    id: 'prime-kit',
    name: 'Prime Kit',
    rank: 'Diamond Kit',
    price: 525000,
    description: 'Reinforced diamond gear for true survivalists.',
    items: ['Diamond Sword (Sharpness IV)', 'Diamond Pickaxe (Efficiency IV)', 'Full Diamond Armor', '64x Steak', '2x Golden Apple'],
  },
  {
    id: 'grandmaster-kit',
    name: 'Grandmaster Kit',
    rank: 'Netherite Kit',
    price: 1750000,
    description: 'The ultimate power. Indestructible Netherite equipment.',
    items: ['Netherite Sword (Sharpness V)', 'Netherite Pickaxe', 'Full Netherite Armor', '64x Golden Apple', 'Totem of Undying'],
  },
];

export const ROLES: Role[] = [
  {
    id: 'vip',
    name: 'VIP',
    price: 35000,
    description: 'Recognition of your support. Includes exclusive chat badge.',
    color: 'text-green-400',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    price: 175000,
    description: 'Show your experience on the server.',
    color: 'text-slate-300',
  },
  {
    id: 'elite-role',
    name: 'Elite',
    price: 700000,
    description: 'Stand out from the crowd with the Elite status.',
    color: 'text-yellow-400',
  },
  {
    id: 'mvp',
    name: 'MVP',
    price: 3500000,
    description: 'Most Valuable Player status. Premium recognition.',
    color: 'text-yellow-500',
  },
  {
    id: 'prime-role',
    name: 'Prime',
    price: 10500000,
    description: 'Top-tier membership for the most dedicated players.',
    color: 'text-purple-500',
  },
  {
    id: 'grandmaster-role',
    name: 'Grandmaster',
    price: 35000000,
    description: 'The absolute peak of hierarchy in Knockers SMP.',
    color: 'text-red-500',
  },
];

export interface Usuario {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Editor' | 'Cliente' | 'Soporte' | 'Desarrollador' | string;
  status: 'Activo' | 'Inactivo' | 'Pendiente' | string;
  subscription: string;
  avatarText: string;
  joinedAt: string;
  avatar?: string;
  phone?: string;
  department?: string;
  location?: string;
  bio?: string;
}

export interface ProfilePostComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  timeAgo: string;
  content: string;
}

export interface ProfilePost {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  timeAgo: string;
  content: string;
  image?: string;
  likesCount: number;
  isLiked: boolean;
  comments: ProfilePostComment[];
}

export interface FollowerUser {
  id: string;
  name: string;
  handle: string;
  role: string;
  avatar: string;
  location: string;
  isFollowing: boolean;
}

export interface FriendConnection {
  id: string;
  name: string;
  role: string;
  avatar: string;
  mutualFriends: number;
  department: string;
  isOnline: boolean;
}

export interface GalleryMedia {
  id: string;
  title: string;
  date: string;
  image: string;
  category: string;
  fileSize: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  plan: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface Admin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  lastLoginAt: string | null;
}

export interface AdminListedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface AdminUsersPage {
  items: AdminListedUser[];
  total: number;
  page: number;
  pageSize: number;
}

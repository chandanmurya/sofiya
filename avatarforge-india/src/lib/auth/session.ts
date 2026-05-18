// ============================================
// Session Helper - Get authenticated user
// ============================================

import { getServerSession } from 'next-auth';
import { authOptions } from './index';
import { NextResponse } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
  locale: string;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return {
    id: (session.user as any).id,
    email: session.user.email!,
    name: session.user.name || undefined,
    role: (session.user as any).role || 'USER',
    locale: (session.user as any).locale || 'en',
  };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError('Authentication required');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new AuthError('Admin access required');
  }
  return user;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

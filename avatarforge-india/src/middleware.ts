import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes require ADMIN role
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/create-avatar/:path*',
    '/clone-voice/:path*',
    '/create-video/:path*',
    '/my-videos/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/avatars/:path*',
    '/api/voices/:path*',
    '/api/videos/:path*',
    '/api/billing/:path*',
    '/api/upload/:path*',
    '/api/admin/:path*',
  ],
};

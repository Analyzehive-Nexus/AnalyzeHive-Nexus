import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication. /register must be listed even
// though it only redirects to /login - without it an anonymous visitor gets
// bounced through /login?callbackUrl=/register and back for no reason.
// /auth/verify-email is reached from a link that was never signed in to
// begin with - it has to be public for the same reason /auth/callback is.
const publicRoutes = ['/login', '/register', '/auth/callback', '/auth/verify-email']

export function proxy(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value
    const { pathname } = request.nextUrl

    const isPublicRoute = publicRoutes.includes(pathname)

    // If no token and trying to access protected route -> redirect to login
    if (!token && !isPublicRoute) {
        const loginUrl = new URL('/login', request.url)
        // Optional: save the original URL to redirect back after login
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // If has token and trying to access login -> redirect to dashboard
    if (token && isPublicRoute) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)',
    ],
}

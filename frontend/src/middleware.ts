import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        // Allow access if authenticated
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                // Allow unauthenticated access to signin/signup pages
                const { pathname } = req.nextUrl;
                if (pathname.startsWith("/signin") || pathname.startsWith("/signup")) {
                    return true;
                }
                // Require token for all other pages
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico
         * - public files
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)",
    ],
};

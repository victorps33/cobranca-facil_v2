import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/auth (NextAuth routes)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - auth/* (login page)
     */
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|auth).*)",
  ],
};

import { withAuth } from "next-auth/middleware";

// Signed-out visitors are sent to the login page with a callbackUrl so they
// return to the page they asked for. Role checks stay in the pages and APIs.
// "/" and "/rooms" are public (landing page + browsing room availability);
// booking still requires signing in, enforced by the pages and /api/bookings.
export default withAuth({
  pages: { signIn: "/auth/login" },
  callbacks: {
    authorized: ({ token }) => !!token?.id,
  },
});

export const config = {
  matcher: ["/my-bookings/:path*", "/admin/:path*"],
};

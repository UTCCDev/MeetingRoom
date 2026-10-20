"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      // Clear the session first, then do a full navigation so no page keeps
      // stale session state (the redirect variant sometimes needed a 2nd click).
      await signOut({ redirect: false });
    } finally {
      window.location.href = "/auth/login";
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSigningOut}
      // Icon only below 1024px → a 44×44 circle (same as the button height); with its label it's the normal pill.
      className="btn-secondary btn--s max-lg:w-11 max-lg:px-0 flex-none"
      aria-label="ออกจากระบบ"
    >
      <span className="icon icon--20" aria-hidden="true">logout</span>
      <span className="hidden lg:inline">{isSigningOut ? "กำลังออก…" : "ออกจากระบบ"}</span>
    </button>
  );
}

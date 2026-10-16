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
      // Icon only on phones → a 40×40 circle; with its label it's the normal pill.
      className="btn-secondary btn--s max-sm:w-10 max-sm:px-0"
      aria-label="ออกจากระบบ"
    >
      <span className="icon icon--20" aria-hidden="true">logout</span>
      <span className="hidden sm:inline">{isSigningOut ? "กำลังออก…" : "ออกจากระบบ"}</span>
    </button>
  );
}

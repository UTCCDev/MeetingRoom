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
      className="btn-secondary btn--s px-3 sm:px-4"
      aria-label="ออกจากระบบ"
    >
      <span className="icon icon--20 icon--w500" aria-hidden="true">logout</span>
      <span className="hidden sm:inline">{isSigningOut ? "กำลังออก…" : "ออกจากระบบ"}</span>
    </button>
  );
}

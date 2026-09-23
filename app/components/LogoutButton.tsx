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
      className="btn-secondary text-sm px-4 py-2 disabled:opacity-60"
    >
      {isSigningOut ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
  );
}

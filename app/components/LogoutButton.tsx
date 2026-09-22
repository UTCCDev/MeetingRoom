"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ redirectTo: "/auth/login" });
  };

  return (
    <button onClick={handleLogout} className="btn-secondary text-sm">
      ออกจากระบบ
    </button>
  );
}

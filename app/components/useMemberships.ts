"use client";

import { useEffect, useState } from "react";
import type { Membership } from "@/lib/service-rules";

/** Service memberships of the signed-in user from /api/me. null while loading. */
export function useMemberships(enabled = true): Membership[] | null {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => alive && setMemberships(Array.isArray(me?.serviceMemberships) ? me.serviceMemberships : []))
      .catch(() => alive && setMemberships([]));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return memberships;
}

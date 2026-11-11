import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";
import type { Actor } from "@/lib/validation";
import type { Membership } from "@/lib/service-rules";

/** The signed-in actor plus their service department memberships. Null when not signed in. */
export async function loadServiceActor(
  session: { user?: { id?: string } | null } | null | undefined
): Promise<(Actor & { memberships: Membership[] }) | null> {
  const actor = await loadActor(session);
  if (!actor) return null;
  const rows = await prisma.serviceMember.findMany({ where: { userId: actor.id } });
  const memberships = rows.map((m) => ({ department: m.department, role: m.role })) as Membership[];
  return { ...actor, memberships };
}

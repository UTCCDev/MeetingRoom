import { prisma } from "@/lib/prisma";
import type { Actor, Role } from "@/lib/validation";

/**
 * The signed-in user with approval flags read fresh from the DB, so flag and role
 * changes apply immediately. Null when signed out, deleted or disabled.
 */
export async function loadActor(session: { user?: { id?: string } | null } | null | undefined): Promise<Actor | null> {
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.active === false) return null;
  return {
    id: user.id,
    role: user.role as Role,
    isPresidentApprover: user.isPresidentApprover,
    autoApproveBooking: user.autoApproveBooking,
    departmentId: user.departmentId,
  };
}

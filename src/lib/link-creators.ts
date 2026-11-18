import { prisma } from "@/lib/prisma";

export interface LinkCreator {
  id: string;
  name: string | null;
  image: string | null;
}

/**
 * ShortLink.createdById has no Prisma relation, so the creator's display
 * info is looked up in one extra query (a workspace has a handful of
 * users) and keyed by id. Unknown ids map to nothing — callers render "—".
 */
export async function loadLinkCreators(
  createdByIds: (string | null)[],
): Promise<Map<string, LinkCreator>> {
  const ids = [...new Set(createdByIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, image: true },
  });
  return new Map(
    users.map((u) => [
      u.id,
      // Fall back to the email's local part so a nameless account still
      // shows something recognisable; the full email is never exposed.
      { id: u.id, name: u.name || u.email?.split("@")[0] || null, image: u.image },
    ]),
  );
}

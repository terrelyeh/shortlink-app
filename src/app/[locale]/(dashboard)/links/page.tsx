/**
 * /links — Server Component shell.
 *
 * Used to SSR the full link list which re-ran Prisma on every visit. Now
 * auth-gates the route and delegates to the client, which pulls data via
 * React Query so returning to the page is instant after the first load.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LinksClient from "./LinksClient";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const params = await searchParams;
  return <LinksClient initialCampaign={params.campaign ?? ""} />;
}

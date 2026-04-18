/**
 * /campaigns — thin Server Component.
 *
 * All the heavy fetching lives client-side via
 * `/api/analytics/campaigns-summary` (Redis-cached, windowable). This
 * page is just the auth gate + the client wrapper. The previous version
 * pre-fetched Campaign rows on the server but the client now needs
 * richer aggregate data that the API already computes, so pre-fetching
 * here would be a separate DB roundtrip to build data we immediately
 * re-fetch in the browser.
 */

import { auth } from "@/lib/auth";
import { checkWorkspaceAccess } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CampaignsClient from "./CampaignsClient";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const requestHeaders = await headers();
  const workspaceId = requestHeaders.get("x-workspace-id") || null;
  if (workspaceId && !(await checkWorkspaceAccess(workspaceId, session.user.id))) {
    redirect("/");
  }

  return <CampaignsClient />;
}

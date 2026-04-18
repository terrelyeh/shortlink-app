import { auth } from "@/lib/auth";
import { checkWorkspaceAccess } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CompareClient from "./CompareClient";

export function generateMetadata() {
  return { title: "Compare campaigns" };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ names?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const requestHeaders = await headers();
  const workspaceId = requestHeaders.get("x-workspace-id") || null;
  if (workspaceId && !(await checkWorkspaceAccess(workspaceId, session.user.id))) {
    redirect("/");
  }

  const params = await searchParams;
  const names = (params.names ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return <CompareClient initialNames={names} />;
}

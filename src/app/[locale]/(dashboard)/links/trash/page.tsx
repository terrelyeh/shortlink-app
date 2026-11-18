import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrashClient from "./TrashClient";

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  return <TrashClient />;
}

import { redirect } from "@/i18n/routing";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  // Logged-in users land directly on the Campaigns hub — the old
  // /dashboard stop was a redundant overview layer we removed.
  if (session) {
    redirect({ href: "/campaigns", locale: "zh-TW" });
  } else {
    redirect({ href: "/auth/signin", locale: "zh-TW" });
  }
}

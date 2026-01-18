import { redirect } from "@/i18n/routing";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect({ href: "/dashboard", locale: "zh-TW" });
  } else {
    redirect({ href: "/auth/signin", locale: "zh-TW" });
  }
}

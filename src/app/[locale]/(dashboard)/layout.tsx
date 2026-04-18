import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Providers } from "@/components/providers/Providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <Providers session={session}>
      <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
        <Sidebar
          userRole={session.user.role}
          userName={session.user.name}
          userImage={session.user.image}
        />
        <main className="lg:pl-[260px]">
          <div className="main">{children}</div>
        </main>
      </div>
    </Providers>
  );
}

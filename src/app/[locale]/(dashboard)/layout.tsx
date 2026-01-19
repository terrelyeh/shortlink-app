import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SessionProvider } from "next-auth/react";

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
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          userRole={session.user.role}
          userName={session.user.name}
          userImage={session.user.image}
        />
        <main className="lg:pl-72">
          <div className="p-6 lg:p-10">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}

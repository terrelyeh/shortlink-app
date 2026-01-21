import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Zap, Link2, BarChart3, Target } from "lucide-react";

export default async function SignInPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:w-[320px] lg:w-[400px] xl:w-[480px] bg-slate-900 p-6 lg:p-10 flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 bg-[#03A9F4] rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-white">EnGenius ShortLink</h1>
            <p className="text-xs lg:text-sm text-slate-400">UTM Manager</p>
          </div>
        </div>

        {/* Features - Centered vertically */}
        <div className="flex-1 flex items-center">
          <div className="space-y-5 lg:space-y-6 py-8">
            <Feature
              icon={<Link2 className="w-4 h-4 lg:w-5 lg:h-5" />}
              title="Short Links"
              description="Create branded short links that are easy to share and track"
            />
            <Feature
              icon={<Target className="w-4 h-4 lg:w-5 lg:h-5" />}
              title="UTM Tracking"
              description="Add UTM parameters automatically to measure campaign performance"
            />
            <Feature
              icon={<BarChart3 className="w-4 h-4 lg:w-5 lg:h-5" />}
              title="Analytics"
              description="Get insights on clicks, locations, devices, and more"
            />
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs lg:text-sm text-slate-500">
          © {new Date().getFullYear()} EnGenius Networks. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Sign In */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-slate-50 min-h-screen md:min-h-0">
        <div className="w-full max-w-[340px] sm:max-w-sm">
          {/* Mobile Logo */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-6">
            <div className="w-9 h-9 bg-[#03A9F4] rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">EnGenius ShortLink</h1>
              <p className="text-xs text-slate-500">UTM Manager</p>
            </div>
          </div>

          {/* Sign In Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
            </div>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-slate-700 font-medium group-hover:text-slate-900">
                  Continue with Google
                </span>
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-center text-xs sm:text-sm text-slate-500">
                Only authorized company accounts can sign in
              </p>
            </div>
          </div>

          {/* Mobile Footer */}
          <p className="md:hidden text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} EnGenius Networks
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 lg:gap-4">
      <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-slate-800 flex items-center justify-center text-[#03A9F4] flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm lg:text-base font-medium text-white">{title}</h3>
        <p className="text-xs lg:text-sm text-slate-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

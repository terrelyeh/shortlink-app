import Link from "next/link";
import { Globe2 } from "lucide-react";

export default function LinkGeoBlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="w-16 h-16 mx-auto bg-violet-100 rounded-full flex items-center justify-center">
          <Globe2 className="w-8 h-8 text-violet-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Not Available in Your Region
          </h1>
          <p className="mt-2 text-gray-600">
            This short link is restricted to specific regions. Please contact the sender if you believe this is an error.
          </p>
        </div>

        <Link
          href="/"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}

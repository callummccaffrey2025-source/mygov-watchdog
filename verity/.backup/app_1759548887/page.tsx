import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Verity
          </h1>
          <p className="text-2xl text-gray-700 mb-8">
            Australia's Political Watchdog
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
            Track every bill, follow every vote, understand every decision. 
            Democracy made simple for $1/month.
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/pricing" 
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/status" 
              className="bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition border-2 border-gray-200"
            >
              System Status
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Bill Tracker</h3>
            <p className="text-gray-600">
              Real-time monitoring of every bill in Parliament with plain-English summaries.
            </p>
          </div>
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Vote Records</h3>
            <p className="text-gray-600">
              See how every MP and Senator votes—searchable and compared against promises.
            </p>
          </div>
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Daily Brief</h3>
            <p className="text-gray-600">
              Get personalized updates on the issues and representatives that matter to you.
            </p>
          </div>
        </div>

        <div className="mt-20 text-center bg-white rounded-xl p-12 shadow-lg">
          <h2 className="text-3xl font-bold mb-4">Transparent Pricing</h2>
          <div className="text-6xl font-bold mb-2">$1<span className="text-3xl text-gray-600">/month</span></div>
          <p className="text-gray-600 mb-8">7-day free trial • Cancel anytime • No tricks</p>
          <Link 
            href="/pricing" 
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

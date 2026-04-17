import { prisma } from '../../../lib/prisma'

const DEMO_EMAIL = 'me@example.com'

export default async function FeedPage() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  })

  if (!user) {
    return (
      <main className="p-6 max-w-xl min-h-screen text-black bg-white">
        <h1 className="text-xl font-semibold mb-4">Your Feed</h1>
        <p>No user found for {DEMO_EMAIL}. Did you run the seed script?</p>
      </main>
    )
  }

  const follows = await prisma.followMP.findMany({
    where: { userId: user.id },
    include: { mp: true },
  })

  return (
    <main className="p-6 max-w-xl min-h-screen text-black bg-white">
      <h1 className="text-xl font-semibold mb-4">Your Feed</h1>

      {follows.length === 0 ? (
        <p className="text-gray-600">
          You&apos;re not following any MPs yet. Go follow someone.
        </p>
      ) : (
        <ul className="space-y-4">
          {follows.map((f) => (
            <li
              key={f.id}
              className="rounded border border-gray-300 p-4 bg-white shadow-sm"
            >
              <div className="text-lg font-medium text-black">
                {f.mp.name}{' '}
                <span className="text-xs text-gray-500">
                  ({f.mp.party} · {f.mp.electorate})
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Recent activity will appear here (votes, speeches, bills,
                media hits).
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

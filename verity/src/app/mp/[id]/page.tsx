import { prisma } from '../../../../lib/prisma'

// This server action will run on the server and hit our API route to follow
async function followAction(mpId: string) {
  "use server"

  // call our API route, which upserts FollowMP for demo user
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/follow-mp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mpId }),
    cache: "no-store",
  })
}

export default async function MPPage({ params }: { params: { id: string } }) {
  const mp = await prisma.mP.findUnique({
    where: { id: params.id },
  })

  if (!mp) {
    return (
      <main className="p-6 bg-white text-black min-h-screen">
        <p>MP not found.</p>
      </main>
    )
  }

  return (
    <main className="p-6 bg-white text-black min-h-screen max-w-xl">
      <h1 className="text-2xl font-semibold">{mp.name}</h1>
      <p className="text-gray-600 text-sm mt-2">
        {mp.party} · {mp.electorate}
      </p>

      <form action={async () => { await followAction(mp.id) }}>
        <button
          className="mt-6 rounded bg-black text-white text-sm font-medium px-4 py-2"
          type="submit"
        >
          Follow
        </button>
      </form>

      <div className="mt-8 text-gray-700 text-sm">
        Activity will appear here (votes, bills, speeches, headlines).
      </div>
    </main>
  )
}

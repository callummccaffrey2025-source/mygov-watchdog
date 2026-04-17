import { prisma } from '../../../../lib/prisma'

const DEMO_EMAIL = 'me@example.com'

export async function POST(req: Request) {
  const body = await req.json()
  const { mpId } = body

  if (!mpId) {
    return new Response(JSON.stringify({ error: 'mpId required' }), { status: 400 })
  }

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL },
  })

  const follow = await prisma.followMP.upsert({
    where: {
      userId_mpId: {
        userId: user.id,
        mpId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      mpId,
    },
  })

  return new Response(JSON.stringify({ ok: true, follow }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

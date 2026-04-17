import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // pretend this is you logging in with email
  const email = "me@example.com"

  // 1. ensure demo user exists
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })

  console.log("User:", user)

  // 2. look up one MP to follow (Albanese)
  const mp = await prisma.mP.findFirst({
    where: { name: { contains: "Albanese" } },
  })

  if (!mp) {
    console.log("No MP found to follow. Did you seed MPs yet?")
    return
  }

  // 3. connect follow
  const follow = await prisma.followMP.upsert({
    where: {
      userId_mpId: {
        userId: user.id,
        mpId: mp.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      mpId: mp.id,
    },
  })

  console.log("Followed:", follow)

  // 4. show what this user's "feed MPs" are right now
  const feed = await prisma.followMP.findMany({
    where: { userId: user.id },
    include: { mp: true },
  })

  console.log("Your followed MPs:")
  for (const item of feed) {
    console.log(`- ${item.mp.name} (${item.mp.party}) - ${item.mp.electorate}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

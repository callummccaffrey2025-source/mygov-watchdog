import { PrismaClient } from '@prisma/client'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { parse } from 'csv-parse'

const prisma = new PrismaClient()

async function main() {
  // recreate __dirname for ESM
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  const filePath = resolve(__dirname, '../data/mps.csv')

  const rows: any[] = []

  await new Promise<void>((res, rej) => {
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => res())
      .on('error', rej)
  })

  console.log(`Parsed ${rows.length} MPs`)

  for (const row of rows) {
    const id = row.id?.toString().trim()
    const name = row.name?.toString().trim()
    const party = row.party?.toString().trim()
    const electorate = row.electorate?.toString().trim()

    if (!id || !name) continue

    await prisma.mP.upsert({
      where: { id },
      update: { name, party, electorate },
      create: { id, name, party, electorate },
    })
  }

  console.log('Done seeding MPs ✅')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Seeds the predefined rooms. Rooms are the "simple room-management
 * mechanism" the spec asks for — a single data source (this file) rather
 * than an end-user-facing room-creation feature. Re-running this script is
 * safe: it upserts by slug.
 *
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const rooms = [
  {
    slug: "solo-travel",
    name: "Solo Travel",
    description: "Going it alone — tips, company for the road, and pep talks.",
    sortOrder: 1,
  },
  {
    slug: "weekend-getaways",
    name: "Weekend Getaways",
    description: "Short trips worth the drive, flight, or train ticket.",
    sortOrder: 2,
  },
  {
    slug: "budget-travel",
    name: "Budget Travel",
    description: "Stretching a trip further without stretching the truth.",
    sortOrder: 3,
  },
  {
    slug: "hidden-gems-india",
    name: "Hidden Gems in India",
    description: "Off the usual route — places worth the detour.",
    sortOrder: 4,
  },
  {
    slug: "backpacking",
    name: "Backpacking",
    description: "Light packs, long routes, and the gear debates that come with them.",
    sortOrder: 5,
  },
  {
    slug: "travel-questions",
    name: "Travel Questions",
    description: "Ask anything — visas, packing lists, \"is this a bad idea\".",
    sortOrder: 6,
  },
];

async function main() {
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { slug: room.slug },
      update: {
        name: room.name,
        description: room.description,
        sortOrder: room.sortOrder,
        isActive: true,
      },
      create: room,
    });
  }
  console.log(`Seeded ${rooms.length} rooms.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

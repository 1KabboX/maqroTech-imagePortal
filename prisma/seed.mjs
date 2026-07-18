import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@maqro.tech";
const ADMIN_PASSWORD = "admin123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin already exists: ${ADMIN_EMAIL} (${existing.publicId})`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: "Maqro Admin",
      username: "admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      publicId: "MQ-A-001",
      registeredAt: new Date(),
    },
  });

  console.log(`Admin created: ${admin.email} (${admin.publicId})`);
  console.log(`Initial password: ${ADMIN_PASSWORD} — change it after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

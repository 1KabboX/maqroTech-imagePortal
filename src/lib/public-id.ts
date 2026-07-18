import type { Prisma } from "@prisma/client";

const PREFIX: Record<"ADMIN" | "DESIGNER", string> = {
  ADMIN: "MQ-A-",
  DESIGNER: "MQ-D-",
};

/** Generates the next sequential public ID (MQ-D-001, MQ-D-002, …) inside a transaction. */
export async function nextPublicId(
  tx: Prisma.TransactionClient,
  role: "ADMIN" | "DESIGNER"
): Promise<string> {
  const prefix = PREFIX[role];
  const last = await tx.user.findFirst({
    where: { publicId: { startsWith: prefix } },
    orderBy: { publicId: "desc" },
    select: { publicId: true },
  });
  const lastNum = last?.publicId ? parseInt(last.publicId.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
}

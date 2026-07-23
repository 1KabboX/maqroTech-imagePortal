import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { prisma } from "@/lib/prisma";
import { BrandsManager } from "./BrandsManager";

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { folders: true } },
      categories: {
        orderBy: { name: "asc" },
        include: { _count: { select: { folders: true } } },
      },
    },
  });

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Brands</Typography>
        <Typography variant="body2" color="text.secondary">
          Designers pick a brand when uploading. Categories are created by designers on
          the fly — you can clean up empty ones here.
        </Typography>
      </Stack>

      <BrandsManager
        brands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          folderCount: b._count.folders,
          categories: b.categories.map((c) => ({
            id: c.id,
            name: c.name,
            folderCount: c._count.folders,
          })),
        }))}
      />
    </Stack>
  );
}

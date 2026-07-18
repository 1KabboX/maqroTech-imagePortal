import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { prisma } from "@/lib/prisma";
import { UploadClient } from "./UploadClient";

export default async function UploadPage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Upload folder</Typography>
        <Typography variant="body2" color="text.secondary">
          Pick the brand and category, then drop your whole product folder — the folder
          name is what the admin will see.
        </Typography>
      </Stack>
      <UploadClient brands={brands} />
    </Stack>
  );
}

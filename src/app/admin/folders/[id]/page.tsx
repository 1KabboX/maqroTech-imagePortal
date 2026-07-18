import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { prisma } from "@/lib/prisma";
import { FolderStatusChip } from "@/components/FolderStatusChip";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DownloadFolderButton } from "@/components/DownloadFolderButton";
import { FolderReview } from "./FolderReview";

export default async function AdminFolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const folder = await prisma.folder.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      designer: { select: { name: true, publicId: true, username: true } },
      files: { orderBy: { createdAt: "asc" } },
      activity: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!folder) notFound();

  return (
    <Stack spacing={3}>
      <Button href="/admin/folders" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
        All folders
      </Button>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">{folder.name}</Typography>
        <FolderStatusChip status={folder.status} size="medium" />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Chip label={folder.brand.name} variant="outlined" />
        <Chip label={folder.category.name} variant="outlined" color="secondary" />
        <Chip
          label={`${folder.designer.name} · ${folder.designer.publicId}`}
          variant="outlined"
        />
        <Chip label={`${folder.files.length} files`} variant="outlined" />
      </Stack>

      <DownloadFolderButton
        folderName={folder.name}
        files={folder.files.map((f) => ({ displayName: f.displayName, filePath: f.filePath }))}
      />

      {folder.designerNote && (
        <Alert severity="info">
          <strong>Designer&apos;s note:</strong> {folder.designerNote}
        </Alert>
      )}
      {folder.status === "DECLINED" && folder.adminNote && (
        <Alert severity="error">
          <strong>Your decline note:</strong> {folder.adminNote}
        </Alert>
      )}

      <FolderReview
        folderId={folder.id}
        folderName={folder.name}
        status={folder.status}
        files={folder.files.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          filePath: f.filePath,
          thumbPath: f.thumbPath,
          sizeBytes: f.sizeBytes,
          width: f.width,
          height: f.height,
        }))}
      />

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Activity
          </Typography>
          <ActivityTimeline items={folder.activity} />
        </CardContent>
      </Card>
    </Stack>
  );
}

import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signFilePath } from "@/lib/file-token";
import { FolderStatusChip } from "@/components/FolderStatusChip";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { FolderManager } from "./FolderManager";

export default async function FolderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const folder = await prisma.folder.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      files: { orderBy: { createdAt: "asc" } },
      activity: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!folder || folder.designerId !== session!.user.id) notFound();

  return (
    <Stack spacing={3}>
      <Button href="/dashboard/folders" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
        My folders
      </Button>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">{folder.name}</Typography>
        <FolderStatusChip status={folder.status} size="medium" />
      </Stack>

      <Stack direction="row" spacing={1}>
        <Chip label={folder.brand.name} variant="outlined" />
        <Chip label={folder.category.name} variant="outlined" color="secondary" />
        <Chip label={`${folder.files.length} files`} variant="outlined" />
      </Stack>

      {folder.status === "DECLINED" && folder.adminNote && (
        <Alert severity="error">
          <strong>Admin note:</strong> {folder.adminNote}
        </Alert>
      )}
      {folder.status === "COMPLETED" && (
        <Alert severity="success">
          This folder is completed and locked — the files are in use. Contact the admin if
          something needs to change.
        </Alert>
      )}
      {folder.designerNote && (
        <Alert severity="info">
          <strong>Your note:</strong> {folder.designerNote}
        </Alert>
      )}

      <FolderManager
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
          shareToken: signFilePath(f.filePath),
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

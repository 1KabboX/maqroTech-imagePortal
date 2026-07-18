import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DriveFileRenameOutlineOutlinedIcon from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

const CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  UPLOADED: { label: "Folder uploaded", icon: <UploadOutlinedIcon fontSize="small" />, color: "#2979ff" },
  RESUBMITTED: { label: "Resubmitted for review", icon: <ReplayOutlinedIcon fontSize="small" />, color: "#2979ff" },
  DECLINED: { label: "Declined", icon: <CancelOutlinedIcon fontSize="small" />, color: "#ef4444" },
  COMPLETED: { label: "Marked as completed", icon: <CheckCircleOutlinedIcon fontSize="small" />, color: "#22c55e" },
  UNLOCKED: { label: "Unlocked by admin", icon: <LockOpenOutlinedIcon fontSize="small" />, color: "#9e9e9e" },
  FILE_ADDED: { label: "File added", icon: <AddPhotoAlternateOutlinedIcon fontSize="small" />, color: "#00e5c3" },
  FILE_RENAMED: { label: "File renamed", icon: <DriveFileRenameOutlineOutlinedIcon fontSize="small" />, color: "#9e9e9e" },
  FILE_DELETED: { label: "File deleted", icon: <DeleteOutlinedIcon fontSize="small" />, color: "#9e9e9e" },
  FOLDER_RENAMED: { label: "Folder renamed", icon: <DriveFileRenameOutlineOutlinedIcon fontSize="small" />, color: "#9e9e9e" },
};

export type ActivityItem = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
};

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      {items.map((item) => {
        const cfg = CONFIG[item.action] ?? {
          label: item.action,
          icon: null,
          color: "#9e9e9e",
        };
        return (
          <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ color: cfg.color, display: "flex", pt: 0.25 }}>{cfg.icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2">
                {cfg.label}
                {item.detail && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" — "}
                    {item.detail}
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(item.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

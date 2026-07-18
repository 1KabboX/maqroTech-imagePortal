"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import {
  downloadFilesToDevice,
  type DownloadEntry,
  type DownloadMessage,
  type DownloadProgress,
} from "@/lib/download-files";

type Props = {
  folderName: string;
  files: DownloadEntry[];
  label?: string;
  variant?: "contained" | "outlined" | "text";
  size?: "small" | "medium" | "large";
};

export function DownloadFolderButton({
  folderName,
  files,
  label = "Download folder",
  variant = "contained",
  size = "medium",
}: Props) {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [message, setMessage] = useState<DownloadMessage | null>(null);

  const start = async () => {
    setMessage(null);
    setProgress({ done: 0, total: files.length });
    const result = await downloadFilesToDevice(folderName, files, setProgress);
    setProgress(null);
    setMessage(result);
  };

  return (
    <Box>
      <Button
        variant={variant}
        size={size}
        startIcon={<DownloadOutlinedIcon />}
        disabled={Boolean(progress) || files.length === 0}
        onClick={start}
      >
        {progress ? "Downloading…" : label}
      </Button>
      {progress && (
        <Box sx={{ mt: 1, maxWidth: 320 }}>
          <LinearProgress
            variant="determinate"
            value={(progress.done / progress.total) * 100}
            sx={{ borderRadius: 1, height: 6 }}
          />
          <Typography variant="caption" color="text.secondary">
            {progress.done}/{progress.total} files
          </Typography>
        </Box>
      )}
      {message && (
        <Alert severity={message.kind} sx={{ mt: 1 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
    </Box>
  );
}

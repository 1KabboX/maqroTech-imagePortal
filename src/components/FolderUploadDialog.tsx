"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";

import { collectFiles, filterImages } from "@/lib/collect-files";

type Props = {
  brandId: string;
  categoryName: string;
  /** Where to send the user after a successful upload; defaults to staying put. */
  detailPathPrefix?: string;
};

export function FolderUploadDialog({ brandId, categoryName, detailPathPrefix }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFolderName("");
    setNote("");
    setFiles([]);
    setSkipped(0);
    setError(null);
    setProgress(null);
  };

  const acceptFiles = (incoming: File[], detectedFolderName?: string) => {
    const { valid, skipped: skippedCount } = filterImages(incoming);
    setFiles(valid);
    setSkipped(skippedCount);
    setError(valid.length === 0 ? "No usable images found (JPG, PNG, WEBP)" : null);
    if (detectedFolderName && !folderName) setFolderName(detectedFolderName);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const entries = items
      .map((i) => i.webkitGetAsEntry?.())
      .filter((x): x is FileSystemEntry => Boolean(x));

    const dir = entries.find((x) => x.isDirectory);
    const collected = (await Promise.all(entries.map(collectFiles))).flat();
    acceptFiles(collected, dir?.name);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const rel = (picked[0] as File & { webkitRelativePath?: string })?.webkitRelativePath;
    const detected = rel ? rel.split("/")[0] : undefined;
    acceptFiles(picked, detected);
  };

  const canSubmit = folderName.trim() && files.length > 0 && !progress;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setProgress({ done: 0, total: files.length });

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          categoryName,
          folderName: folderName.trim(),
          designerNote: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the folder");

      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        const up = await fetch(`/api/folders/${data.id}/files?initial=1`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const body = await up.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to upload ${files[i].name}`);
        }
        setProgress({ done: i + 1, total: files.length });
      }

      setOpen(false);
      reset();
      if (detailPathPrefix) router.push(`${detailPathPrefix}/${data.id}`);
      else router.refresh();
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<DriveFolderUploadOutlinedIcon />}
        onClick={() => setOpen(true)}
      >
        Upload folder
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!progress) setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Upload folder to “{categoryName}”</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              data-upload-dropzone
              sx={{
                border: "2px dashed",
                borderColor: dragOver ? "primary.main" : "#2a2a2a",
                borderRadius: 3,
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: dragOver ? "rgba(41,121,255,0.08)" : "transparent",
                transform: dragOver ? "scale(1.015)" : "scale(1)",
                boxShadow: dragOver ? "inset 0 0 36px 0 rgba(41,121,255,0.15)" : "none",
                transition: "all 0.18s ease",
                "&:hover": { borderColor: "#3a3a3a", bgcolor: "rgba(255,255,255,0.02)" },
              }}
            >
              <DriveFolderUploadOutlinedIcon
                sx={{
                  fontSize: 44,
                  color: dragOver ? "primary.main" : "text.secondary",
                  "@keyframes dzBob": {
                    "0%, 100%": { transform: "translateY(2px)" },
                    "50%": { transform: "translateY(-4px)" },
                  },
                  animation: dragOver ? "dzBob 1s ease-in-out infinite" : "none",
                  transition: "color 0.18s ease",
                }}
              />
              <Typography sx={{ mt: 1 }}>
                {files.length > 0
                  ? `${files.length} image${files.length === 1 ? "" : "s"} ready`
                  : "Drag your folder here, or click to browse"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                JPG, PNG, WEBP — no limits
              </Typography>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                // @ts-expect-error non-standard attribute
                webkitdirectory=""
                onChange={onPick}
              />
            </Box>

            {files.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {files.slice(0, 6).map((f) => (
                  <Chip
                    key={f.name}
                    icon={<InsertPhotoOutlinedIcon />}
                    label={f.name}
                    size="small"
                    variant="outlined"
                  />
                ))}
                {files.length > 6 && (
                  <Chip label={`+${files.length - 6} more`} size="small" variant="outlined" />
                )}
              </Stack>
            )}
            {skipped > 0 && (
              <Alert severity="warning">
                {skipped} file{skipped === 1 ? " was" : "s were"} skipped (not JPG/PNG/WEBP)
              </Alert>
            )}

            <TextField
              label="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
              fullWidth
              helperText="Auto-filled from your folder — this is the name everyone will see"
            />

            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />

            {error && <Alert severity="error">{error}</Alert>}

            {progress && (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={(progress.done / progress.total) * 100}
                  sx={{ borderRadius: 1, height: 8 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Uploading {progress.done}/{progress.total}…
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(progress)} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!canSubmit} onClick={submit}>
            {progress ? "Uploading…" : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

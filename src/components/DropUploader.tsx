"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Fade from "@mui/material/Fade";
import Slide from "@mui/material/Slide";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FolderIcon from "@mui/icons-material/Folder";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import { collectFiles, filterImages, uploadImagesToFolder } from "@/lib/collect-files";

type Props = {
  brandId: string;
  categoryName: string;
};

type UploadState =
  | { phase: "uploading"; folderName: string; done: number; total: number }
  | { phase: "done"; folderName: string; total: number }
  | { phase: "error"; folderName: string; message: string };

/**
 * Google Drive-style drop target covering the whole page: drag a folder (or
 * files) from the OS anywhere onto the window and it uploads into this
 * category. A single dragged directory uploads immediately under its own
 * name; loose files ask for a folder name first.
 */
export function DropUploader({ brandId, categoryName }: Props) {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [upload, setUpload] = useState<UploadState | null>(null);
  const dragDepth = useRef(0);
  const busy = useRef(false);

  const runUpload = async (folderName: string, files: File[]) => {
    if (busy.current) return;
    busy.current = true;
    setUpload({ phase: "uploading", folderName, done: 0, total: files.length });
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, categoryName, folderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the folder");

      await uploadImagesToFolder(data.id, files, {
        initial: true,
        onProgress: (done, total) =>
          setUpload({ phase: "uploading", folderName, done, total }),
      });
      setUpload({ phase: "done", folderName, total: files.length });
      router.refresh();
    } catch (err) {
      setUpload({
        phase: "error",
        folderName,
        message: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      busy.current = false;
    }
  };

  // The success card quietly slides away on its own.
  useEffect(() => {
    if (upload?.phase !== "done") return;
    const t = setTimeout(() => setUpload(null), 5000);
    return () => clearTimeout(t);
  }, [upload]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // required so the browser allows dropping
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };
    const onDrop = async (e: DragEvent) => {
      dragDepth.current = 0;
      setDragActive(false);
      if (!hasFiles(e)) return;
      e.preventDefault();

      // The upload dialog's own dropzone handles its drops itself.
      if ((e.target as HTMLElement | null)?.closest?.("[data-upload-dropzone]")) return;

      const items = Array.from(e.dataTransfer?.items ?? []);
      const entries = items
        .map((i) => i.webkitGetAsEntry?.())
        .filter((x): x is FileSystemEntry => Boolean(x));
      if (entries.length === 0) return;

      const collected = (await Promise.all(entries.map(collectFiles))).flat();
      const { valid } = filterImages(collected);
      if (valid.length === 0) {
        setUpload({
          phase: "error",
          folderName: categoryName,
          message: "No usable images found (JPG, PNG, WEBP)",
        });
        return;
      }

      const singleDir =
        entries.length === 1 && entries[0].isDirectory ? entries[0].name : null;
      if (singleDir) {
        void runUpload(singleDir, valid);
      } else {
        setPendingFiles(valid);
        setPendingName("");
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, categoryName]);

  return (
    <>
      <Fade in={dragActive} timeout={{ enter: 180, exit: 220 }} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            bgcolor: "rgba(3,6,12,0.72)",
            backdropFilter: "blur(5px)",
            pointerEvents: "none",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: { xs: 10, sm: 16 },
              borderRadius: 4,
              border: "2px dashed",
              borderColor: "primary.main",
              bgcolor: "rgba(41,121,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "@keyframes dropGlow": {
                "0%, 100%": { boxShadow: "inset 0 0 24px 0 rgba(41,121,255,0.10)" },
                "50%": { boxShadow: "inset 0 0 72px 6px rgba(41,121,255,0.28)" },
              },
              animation: "dropGlow 1.8s ease-in-out infinite",
            }}
          >
            <Stack
              spacing={2}
              sx={{
                alignItems: "center",
                textAlign: "center",
                px: 3,
                "@keyframes dropCardIn": {
                  from: { transform: "scale(0.82) translateY(10px)", opacity: 0 },
                  to: { transform: "scale(1) translateY(0)", opacity: 1 },
                },
                animation: "dropCardIn 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.35)",
              }}
            >
              <Box sx={{ position: "relative", height: 96, width: 96 }}>
                <FolderIcon
                  sx={{
                    fontSize: 96,
                    color: "#8ab4f8",
                    filter: "drop-shadow(0 10px 24px rgba(41,121,255,0.35))",
                  }}
                />
                <FileUploadOutlinedIcon
                  sx={{
                    position: "absolute",
                    left: "50%",
                    top: "54%",
                    transform: "translate(-50%, -50%)",
                    fontSize: 34,
                    color: "#0b1524",
                    "@keyframes dropArrowBob": {
                      "0%, 100%": { translate: "0 3px", opacity: 0.85 },
                      "50%": { translate: "0 -5px", opacity: 1 },
                    },
                    animation: "dropArrowBob 1.1s ease-in-out infinite",
                  }}
                />
              </Box>
              <Typography variant="h5" sx={{ textTransform: "none", letterSpacing: 0 }}>
                Drop to upload to “{categoryName}”
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A dropped folder keeps its name — loose images become a new folder
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Fade>

      <Slide direction="up" in={Boolean(upload)} timeout={240} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 1500,
            width: 340,
            p: 2,
            borderColor: upload?.phase === "error" ? "error.main" : "#1f1f1f",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" noWrap sx={{ pr: 1 }}>
              {upload?.phase === "uploading" && `Uploading “${upload.folderName}”`}
              {upload?.phase === "done" && `“${upload.folderName}” uploaded`}
              {upload?.phase === "error" && "Upload failed"}
            </Typography>
            {upload?.phase !== "uploading" && (
              <IconButton size="small" aria-label="Dismiss" onClick={() => setUpload(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          {upload?.phase === "uploading" && (
            <>
              <LinearProgress
                variant="determinate"
                value={(upload.done / upload.total) * 100}
                sx={{
                  borderRadius: 1,
                  height: 8,
                  my: 1,
                  "& .MuiLinearProgress-bar": { transition: "transform 0.25s ease" },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {upload.done}/{upload.total} images
              </Typography>
            </>
          )}
          {upload?.phase === "done" && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}
            >
              <CheckCircleIcon
                color="success"
                sx={{
                  fontSize: 18,
                  "@keyframes donePop": {
                    "0%": { transform: "scale(0)" },
                    "70%": { transform: "scale(1.25)" },
                    "100%": { transform: "scale(1)" },
                  },
                  animation: "donePop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3)",
                }}
              />
              {upload.total} image{upload.total === 1 ? "" : "s"} in “{categoryName}”
            </Typography>
          )}
          {upload?.phase === "error" && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {upload.message}
            </Alert>
          )}
        </Paper>
      </Slide>

      <Dialog
        open={Boolean(pendingFiles)}
        onClose={() => setPendingFiles(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Name this folder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {pendingFiles?.length} image{pendingFiles?.length === 1 ? "" : "s"} will be uploaded
            to “{categoryName}” as a new folder.
          </Typography>
          <TextField
            label="Folder name"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingFiles(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!pendingName.trim()}
            onClick={() => {
              const files = pendingFiles!;
              setPendingFiles(null);
              void runUpload(pendingName.trim(), files);
            }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

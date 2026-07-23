"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Fade from "@mui/material/Fade";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DriveFileRenameOutlineOutlinedIcon from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import CloseIcon from "@mui/icons-material/Close";
import {
  declineFolderAction,
  completeFolderAction,
  unlockFolderAction,
  adminDeleteFolderAction,
} from "@/lib/actions/review-actions";
import {
  renameFileAction,
  deleteFileAction,
  deleteFilesAction,
} from "@/lib/actions/folder-manage-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SelectableFileGrid, type GridFileItem } from "@/components/SelectableFileGrid";
import { DownloadFolderButton } from "@/components/DownloadFolderButton";
import { collectFiles, filterImages, uploadImagesToFolder } from "@/lib/collect-files";

type FileItem = GridFileItem;

type Props = {
  folderId: string;
  folderName: string;
  status: "SUBMITTED" | "DECLINED" | "COMPLETED";
  files: FileItem[];
};

export function FolderReview({ folderId, folderName, status, files }: Props) {
  const router = useRouter();
  const editable = status !== "COMPLETED";
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<FileItem | null>(null);
  const [confirming, setConfirming] = useState<"complete" | "unlock" | "delete" | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [fileNameValue, setFileNameValue] = useState("");
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const busy = useRef(false);

  const selectedFiles = files.filter((f) => selected.includes(f.id));

  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setDeclineOpen(false);
        router.refresh();
      }
    });

  const addFiles = async (picked: File[]) => {
    const { valid, skipped } = filterImages(picked);
    if (valid.length === 0) {
      setError("Only JPG, PNG, and WEBP images can be added");
      return;
    }
    setError(skipped > 0 ? `${skipped} file${skipped === 1 ? "" : "s"} skipped (not an image)` : null);
    setUploading({ done: 0, total: valid.length });
    try {
      await uploadImagesToFolder(folderId, valid, {
        onProgress: (done, total) => setUploading({ done, total }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  // Full-page drag-and-drop, same pattern as the upload page's DropUploader —
  // drop a folder or loose images anywhere on the window to add them here.
  useEffect(() => {
    if (!editable) return;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
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
      if (busy.current) return;

      const items = Array.from(e.dataTransfer?.items ?? []);
      const entries = items
        .map((i) => i.webkitGetAsEntry?.())
        .filter((x): x is FileSystemEntry => Boolean(x));
      if (entries.length === 0) return;

      busy.current = true;
      try {
        const collected = (await Promise.all(entries.map(collectFiles))).flat();
        await addFiles(collected);
      } finally {
        busy.current = false;
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
  }, [editable, folderId]);

  return (
    <Stack spacing={3}>
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
            }}
          >
            <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", px: 3 }}>
              <FileUploadOutlinedIcon sx={{ fontSize: 72, color: "#8ab4f8" }} />
              <Typography variant="h5" sx={{ textTransform: "none", letterSpacing: 0 }}>
                Drop to add images to &ldquo;{folderName}&rdquo;
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Fade>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
        {status !== "COMPLETED" && (
          <>
            <Button
              variant="contained"
              color="success"
              disabled={pending}
              startIcon={<CheckCircleOutlinedIcon />}
              onClick={() => setConfirming("complete")}
            >
              Mark as completed
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={pending}
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setDeclineOpen(true)}
            >
              Decline with note
            </Button>
          </>
        )}
        {status === "COMPLETED" && (
          <Button
            variant="outlined"
            disabled={pending}
            startIcon={<LockOpenOutlinedIcon />}
            onClick={() => setConfirming("unlock")}
          >
            Unlock
          </Button>
        )}
        {editable && (
          <>
            <Button
              variant="outlined"
              disabled={Boolean(uploading)}
              startIcon={<AddPhotoAlternateOutlinedIcon />}
              onClick={() => inputRef.current?.click()}
            >
              Add images
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </>
        )}
        <Button
          variant="outlined"
          color="error"
          disabled={pending}
          startIcon={<DeleteForeverOutlinedIcon />}
          onClick={() => setConfirming("delete")}
        >
          Delete folder
        </Button>
      </Stack>

      {uploading && (
        <Box>
          <LinearProgress
            variant="determinate"
            value={(uploading.done / uploading.total) * 100}
            sx={{ borderRadius: 1, height: 8 }}
          />
          <Typography variant="caption" color="text.secondary">
            Uploading {uploading.done}/{uploading.total}…
          </Typography>
        </Box>
      )}

      <SelectableFileGrid
        files={files}
        selected={selected}
        onChange={setSelected}
        onOpen={(file) => setLightbox(file)}
        renderActions={
          editable
            ? (file) => (
                <Stack direction="row" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    aria-label={`Rename ${file.displayName}`}
                    onClick={() => {
                      setRenamingFile(file);
                      setFileNameValue(file.displayName);
                    }}
                  >
                    <DriveFileRenameOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${file.displayName}`}
                    disabled={pending}
                    onClick={() => setDeleting(file)}
                  >
                    <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              )
            : undefined
        }
      />

      {selected.length > 0 && typeof document !== "undefined" && createPortal(
        <Box
          sx={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1300,
            animation: "slideUp 0.2s ease",
            "@keyframes slideUp": {
              from: { opacity: 0, transform: "translateX(-50%) translateY(12px)" },
              to: { opacity: 1, transform: "translateX(-50%) translateY(0)" },
            },
          }}
        >
          <Paper
            elevation={12}
            sx={{
              p: 1,
              pl: 2,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "nowrap",
              border: "1px solid",
              borderColor: "primary.main",
              borderRadius: 99,
              backdropFilter: "blur(12px)",
              bgcolor: "background.paper",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selected.length} selected
            </Typography>
            <DownloadFolderButton
              folderName={folderName}
              files={selectedFiles.map((f) => ({ displayName: f.displayName, filePath: f.filePath }))}
              label="Download selected"
              variant="contained"
              size="small"
            />
            {editable && (
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={pending}
                startIcon={<DeleteOutlinedIcon />}
                onClick={() => setDeletingSelected(true)}
              >
                Delete selected
              </Button>
            )}
            <Button size="small" onClick={() => setSelected(files.map((f) => f.id))}>
              Select all
            </Button>
            <IconButton size="small" aria-label="Clear selection" onClick={() => setSelected([])}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        </Box>,
        document.body
      )}

      {files.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {selected.length > 0
            ? "Click to select or deselect · Shift-click for a range · deselect everything to go back to previewing on click"
            : "Click to preview · right-click or tick a checkbox to start selecting · drag on empty space to box-select"}
        </Typography>
      )}

      <ConfirmDialog
        open={confirming === "complete"}
        title="Mark as completed?"
        body="The folder locks — the designer won't be able to change anything anymore."
        confirmLabel="Mark as completed"
        confirmColor="success"
        pending={pending}
        onConfirm={() => {
          run(() => completeFolderAction(folderId));
          setConfirming(null);
        }}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "unlock"}
        title="Unlock this folder?"
        body="It goes back to Submitted and the designer can edit it again."
        confirmLabel="Unlock"
        pending={pending}
        onConfirm={() => {
          run(() => unlockFolderAction(folderId));
          setConfirming(null);
        }}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        title="Delete this folder?"
        body={`"${folderName}" and all ${files.length} of its images will be permanently removed. The designer will be notified.`}
        confirmLabel="Delete folder"
        confirmColor="error"
        pending={pending}
        onConfirm={() => {
          setConfirming(null);
          startTransition(async () => {
            const res = await adminDeleteFolderAction(folderId);
            if (res?.error) setError(res.error);
            else router.push("/admin/folders");
          });
        }}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete file?"
        body={deleting ? `"${deleting.displayName}" will be removed from this folder.` : undefined}
        confirmLabel="Delete"
        confirmColor="error"
        pending={pending}
        onConfirm={() => {
          if (deleting) run(() => deleteFileAction(deleting.id));
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={deletingSelected}
        title={`Delete ${selected.length} file${selected.length === 1 ? "" : "s"}?`}
        body="The selected images will be removed from this folder."
        confirmLabel="Delete"
        confirmColor="error"
        pending={pending}
        onConfirm={() => {
          run(() => deleteFilesAction(selected));
          setSelected([]);
          setDeletingSelected(false);
        }}
        onClose={() => setDeletingSelected(false)}
      />

      <Dialog
        open={Boolean(renamingFile)}
        onClose={() => setRenamingFile(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rename file</DialogTitle>
        <DialogContent>
          <TextField
            value={fileNameValue}
            onChange={(e) => setFileNameValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenamingFile(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={pending}
            onClick={() => {
              if (renamingFile) {
                run(() => renameFileAction(renamingFile.id, fileNameValue));
                setRenamingFile(null);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={declineOpen} onClose={() => setDeclineOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Decline folder</DialogTitle>
        <DialogContent>
          <TextField
            label="What needs to be fixed?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            required
            autoFocus
            sx={{ mt: 1 }}
            helperText="The designer sees this note — required"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeclineOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={pending || note.trim().length < 3}
            onClick={() => run(() => declineFolderAction(folderId, note))}
          >
            Decline
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: "#000" } } }}
      >
        {lightbox && (
          <Box sx={{ position: "relative" }}>
            <IconButton
              onClick={() => setLightbox(null)}
              aria-label="Close"
              sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.6)" }}
            >
              <CloseIcon />
            </IconButton>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${lightbox.filePath}`}
              alt={lightbox.displayName}
              style={{ width: "100%", maxHeight: "85vh", objectFit: "contain", display: "block" }}
            />
            <Typography variant="caption" sx={{ p: 1.5, display: "block", color: "#9e9e9e" }}>
              {lightbox.displayName} · {lightbox.width}×{lightbox.height}
            </Typography>
          </Box>
        )}
      </Dialog>
    </Stack>
  );
}

"use client";

import { useState, useTransition } from "react";
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
import Paper from "@mui/material/Paper";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import CloseIcon from "@mui/icons-material/Close";
import {
  declineFolderAction,
  completeFolderAction,
  unlockFolderAction,
  adminDeleteFolderAction,
} from "@/lib/actions/review-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SelectableFileGrid, type GridFileItem } from "@/components/SelectableFileGrid";
import { DownloadFolderButton } from "@/components/DownloadFolderButton";

type FileItem = GridFileItem;

type Props = {
  folderId: string;
  folderName: string;
  status: "SUBMITTED" | "DECLINED" | "COMPLETED";
  files: FileItem[];
};

export function FolderReview({ folderId, folderName, status, files }: Props) {
  const router = useRouter();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<FileItem | null>(null);
  const [confirming, setConfirming] = useState<"complete" | "unlock" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <Stack spacing={3}>
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

      <SelectableFileGrid
        files={files}
        selected={selected}
        onChange={setSelected}
        onOpen={(file) => setLightbox(file)}
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

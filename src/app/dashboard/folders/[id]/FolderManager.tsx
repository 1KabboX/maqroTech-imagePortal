"use client";

import { useRef, useState, useTransition } from "react";
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
import DriveFileRenameOutlineOutlinedIcon from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import {
  renameFolderAction,
  renameFileAction,
  deleteFileAction,
  deleteFilesAction,
  deleteFolderAction,
  resubmitFolderAction,
} from "@/lib/actions/folder-manage-actions";
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

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];

export function FolderManager({ folderId, folderName, status, files }: Props) {
  const router = useRouter();
  const editable = status !== "COMPLETED";
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderNameValue, setFolderNameValue] = useState(folderName);
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [fileNameValue, setFileNameValue] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedFiles = files.filter((f) => selected.includes(f.id));

  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else {
        setError(null);
        router.refresh();
      }
    });

  const addFiles = async (picked: File[]) => {
    const valid = picked.filter((f) =>
      ALLOWED.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase())
    );
    if (valid.length === 0) {
      setError("Only JPG, PNG, and WEBP images can be added");
      return;
    }
    setError(null);
    setUploading({ done: 0, total: valid.length });
    try {
      for (let i = 0; i < valid.length; i++) {
        const fd = new FormData();
        fd.append("file", valid[i]);
        const res = await fetch(`/api/folders/${folderId}/files`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to upload ${valid[i].name}`);
        }
        setUploading({ done: i + 1, total: valid.length });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {editable && status === "DECLINED" && (
          <Button
            variant="contained"
            disabled={pending || Boolean(uploading)}
            startIcon={<ReplayOutlinedIcon />}
            onClick={() => setResubmitting(true)}
          >
            Resubmit for review
          </Button>
        )}
        <DownloadFolderButton
          folderName={folderName}
          files={files.map((f) => ({ displayName: f.displayName, filePath: f.filePath }))}
          variant="outlined"
        />
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
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => {
                setFolderNameValue(folderName);
                setRenamingFolder(true);
              }}
            >
              Rename folder
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={pending}
              startIcon={<DeleteForeverOutlinedIcon />}
              onClick={() => setDeletingFolder(true)}
            >
              Delete folder
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

      {selected.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            pl: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            borderColor: "primary.main",
            position: "sticky",
            top: 8,
            zIndex: 3,
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
      )}

      <SelectableFileGrid
        files={files}
        selected={selected}
        onChange={setSelected}
        onOpen={(file) => window.open(`/api/files/${file.filePath}`, "_blank")}
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
      {files.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          Click to select · Ctrl-click for more · Shift-click for a range · drag on empty space to
          box-select · double-click to open
        </Typography>
      )}

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

      <ConfirmDialog
        open={deletingFolder}
        title="Delete this folder?"
        body={`"${folderName}" and all ${files.length} of its images will be permanently removed.`}
        confirmLabel="Delete folder"
        confirmColor="error"
        pending={pending}
        onConfirm={() => {
          setDeletingFolder(false);
          startTransition(async () => {
            const res = await deleteFolderAction(folderId);
            if (res?.error) setError(res.error);
            else router.push("/dashboard/folders");
          });
        }}
        onClose={() => setDeletingFolder(false)}
      />

      <ConfirmDialog
        open={resubmitting}
        title="Resubmit for review?"
        body="The folder goes back to the admin's queue as Submitted."
        confirmLabel="Resubmit"
        pending={pending}
        onConfirm={() => {
          run(() => resubmitFolderAction(folderId));
          setResubmitting(false);
        }}
        onClose={() => setResubmitting(false)}
      />

      <Dialog open={renamingFolder} onClose={() => setRenamingFolder(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rename folder</DialogTitle>
        <DialogContent>
          <TextField
            value={folderNameValue}
            onChange={(e) => setFolderNameValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenamingFolder(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={pending}
            onClick={() => {
              run(() => renameFolderAction(folderId, folderNameValue));
              setRenamingFolder(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

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
    </Stack>
  );
}

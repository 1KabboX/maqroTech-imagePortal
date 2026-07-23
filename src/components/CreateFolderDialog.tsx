"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";

type Props = {
  brandId: string;
  categoryName: string;
  /** Where to send the user after creating the folder, so they can add images next. */
  detailPathPrefix: string;
};

export function CreateFolderDialog({ brandId, categoryName, detailPathPrefix }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFolderName("");
    setNote("");
    setError(null);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const canSubmit = folderName.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
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
      setOpen(false);
      reset();
      router.push(`${detailPathPrefix}/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the folder");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CreateNewFolderOutlinedIcon />}
        onClick={() => setOpen(true)}
      >
        New folder
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>New folder in &ldquo;{categoryName}&rdquo;</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
              fullWidth
              autoFocus
              helperText="You can add images to it right after"
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={submitting} onClick={close}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!canSubmit} onClick={submit}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

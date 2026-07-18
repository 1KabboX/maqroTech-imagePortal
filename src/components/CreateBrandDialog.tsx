"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { createBrandAction } from "@/lib/actions/brand-actions";

export function CreateBrandDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createBrandAction, undefined);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setOpen(true)}>
        New brand
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form action={formAction}>
          <DialogTitle>New brand</DialogTitle>
          <DialogContent>
            {state?.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {state.error}
              </Alert>
            )}
            <TextField
              name="name"
              label="Brand name"
              required
              fullWidth
              autoFocus
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import {
  setDesignerStatusAction,
  resetDesignerPasswordAction,
  deleteDesignerAction,
} from "@/lib/actions/designer-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Designer = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  publicId: string | null;
  status: "INVITED" | "ACTIVE" | "DISABLED";
  createdAt: string;
  folderCount: number;
};

const statusChip = {
  INVITED: { label: "Invited", color: "warning" as const },
  ACTIVE: { label: "Active", color: "success" as const },
  DISABLED: { label: "Disabled", color: "default" as const },
};

export function DesignerRow({ designer }: { designer: Designer }) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const chip = statusChip[designer.status];
  const disable = designer.status !== "DISABLED";

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2">{designer.name ?? "—"}</Typography>
        <Typography variant="caption" color="text.secondary">
          {designer.username ? `@${designer.username}` : "not registered yet"}
        </Typography>
      </TableCell>
      <TableCell>{designer.email}</TableCell>
      <TableCell>
        {designer.publicId ? (
          <Chip label={designer.publicId} size="small" variant="outlined" />
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <Chip label={chip.label} color={chip.color} size="small" />
      </TableCell>
      <TableCell align="right">
        <Button
          size="small"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await resetDesignerPasswordAction(designer.id);
              if (res.password) setTempPassword(res.password);
            })
          }
        >
          Reset password
        </Button>
        {designer.status !== "INVITED" && (
          <Button
            size="small"
            color={disable ? "error" : "primary"}
            disabled={pending}
            onClick={() =>
              startTransition(() => setDesignerStatusAction(designer.id, disable))
            }
          >
            {disable ? "Disable" : "Enable"}
          </Button>
        )}
        <Button
          size="small"
          color="error"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
        >
          {designer.status === "INVITED" ? "Cancel invite" : "Delete"}
        </Button>

        <ConfirmDialog
          open={confirmingDelete}
          title={
            designer.status === "INVITED"
              ? "Cancel this invite?"
              : `Delete ${designer.name ?? designer.email}?`
          }
          body={
            designer.status === "INVITED"
              ? `${designer.email} won't be able to register with the temporary password anymore.`
              : `The account and all their folders (${designer.folderCount}) with every image will be permanently removed.`
          }
          confirmLabel={designer.status === "INVITED" ? "Cancel invite" : "Delete designer"}
          confirmColor="error"
          pending={pending}
          onConfirm={() => {
            setConfirmingDelete(false);
            startTransition(() => deleteDesignerAction(designer.id).then(() => {}));
          }}
          onClose={() => setConfirmingDelete(false)}
        />

        <Dialog open={Boolean(tempPassword)} onClose={() => setTempPassword(null)}>
          <DialogTitle>New password for {designer.name ?? designer.email}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Share this with the designer — it&apos;s shown only once:
            </DialogContentText>
            <Typography
              variant="h5"
              sx={{ mt: 2, fontFamily: "monospace", letterSpacing: 2, textTransform: "none" }}
            >
              {tempPassword}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setTempPassword(null)}>
              Done
            </Button>
          </DialogActions>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

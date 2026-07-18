"use client";

import { useState } from "react";
import { useActionState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { addDesignerAction } from "@/lib/actions/designer-actions";

export function InvitePanel() {
  const [state, formAction, pending] = useActionState(addDesignerAction, undefined);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!state?.password) return;
    await navigator.clipboard.writeText(state.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Stack spacing={2}>
      <Box component="form" action={formAction} sx={{ display: "flex", gap: 2 }}>
        <TextField
          name="email"
          type="email"
          label="Designer email"
          placeholder="designer@example.com"
          size="small"
          required
          sx={{ flex: 1, maxWidth: 380 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={pending}
          startIcon={<PersonAddAltOutlinedIcon />}
        >
          {pending ? "Adding…" : "Add designer"}
        </Button>
      </Box>

      {state?.error && <Alert severity="error">{state.error}</Alert>}

      {state?.password && (
        <Paper
          variant="outlined"
          sx={{ p: 2, maxWidth: 520, borderColor: "success.main" }}
        >
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>{state.email}</strong> added. Temporary password:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography
                variant="h5"
                sx={{ fontFamily: "monospace", letterSpacing: 2, textTransform: "none" }}
              >
                {state.password}
              </Typography>
              <Tooltip title={copied ? "Copied!" : "Copy password"}>
                <IconButton size="small" onClick={copy} aria-label="Copy password">
                  {copied ? (
                    <CheckOutlinedIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Send this to the designer yourself (WhatsApp, email, …) — it&apos;s shown only
              once. They&apos;ll log in with it and set their own name, username, and new
              password.
            </Typography>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

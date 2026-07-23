"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import {
  getDesignerVisibilityAction,
  updateDesignerVisibilityAction,
  type VisibilityFolder,
} from "@/lib/actions/share-actions";

type Props = {
  designerId: string;
  designerLabel: string;
  open: boolean;
  onClose: () => void;
};

export function DesignerVisibilityDialog({ designerId, designerLabel, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seesAll, setSeesAll] = useState(false);
  const [folders, setFolders] = useState<VisibilityFolder[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getDesignerVisibilityAction(designerId)
      .then((data) => {
        setSeesAll(data.seesAll);
        setFolders(data.folders);
        setChecked(new Set(data.folders.filter((f) => f.shared).map((f) => f.id)));
      })
      .catch(() => setError("Couldn't load this designer's visibility"))
      .finally(() => setLoading(false));
  }, [open, designerId]);

  // Folders this designer already owns can't be shared — they always see them.
  const shareable = useMemo(() => folders.filter((f) => !f.ownedByThisDesigner), [folders]);

  const grouped = useMemo(() => {
    const map = new Map<string, VisibilityFolder[]>();
    for (const f of shareable) {
      const key = `${f.brandName} › ${f.categoryName}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(f);
    }
    return [...map.entries()];
  }, [shareable]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = shareable.length > 0 && shareable.every((f) => checked.has(f.id));
  const someChecked = shareable.some((f) => checked.has(f.id));

  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(shareable.map((f) => f.id)));
  };

  const save = () => {
    setError(null);
    startSaving(async () => {
      const res = await updateDesignerVisibilityAction(designerId, seesAll, [...checked]);
      if (res?.error) setError(res.error);
      else onClose();
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>What {designerLabel} can see</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <FormControlLabel
              control={
                <Switch checked={seesAll} onChange={(e) => setSeesAll(e.target.checked)} />
              }
              label="See all folders (including anything uploaded later)"
            />
            <Typography variant="caption" color="text.secondary">
              A designer always sees their own folders. Below, pick which other folders they
              may view — they open read-only, with no sign of who owns them.
            </Typography>

            <Divider />

            {seesAll ? (
              <Alert severity="info">
                This designer can view every folder — individual choices are paused while
                &ldquo;See all folders&rdquo; is on.
              </Alert>
            ) : shareable.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                There are no other designers&apos; folders to share yet.
              </Typography>
            ) : (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allChecked}
                      indeterminate={!allChecked && someChecked}
                      onChange={toggleAll}
                    />
                  }
                  label={`Select all (${shareable.length})`}
                />
                <Stack spacing={2} sx={{ maxHeight: 340, overflowY: "auto", pr: 1 }}>
                  {grouped.map(([group, groupFolders]) => (
                    <Box key={group}>
                      <Typography
                        variant="overline"
                        color="text.secondary"
                        sx={{ display: "block", mb: 0.5 }}
                      >
                        {group}
                      </Typography>
                      {groupFolders.map((f) => (
                        <FormControlLabel
                          key={f.id}
                          sx={{ display: "flex", ml: 0 }}
                          control={
                            <Checkbox
                              size="small"
                              checked={checked.has(f.id)}
                              onChange={() => toggle(f.id)}
                            />
                          }
                          label={f.name}
                        />
                      ))}
                    </Box>
                  ))}
                </Stack>
              </>
            )}

            {!seesAll && someChecked && (
              <Chip
                label={`${checked.size} folder${checked.size === 1 ? "" : "s"} shared`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || loading}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

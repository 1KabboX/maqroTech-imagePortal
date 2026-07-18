"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import {
  createBrandAction,
  renameBrandAction,
  deleteBrandAction,
  deleteCategoryAction,
} from "@/lib/actions/brand-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Category = { id: string; name: string; folderCount: number };
type Brand = { id: string; name: string; folderCount: number; categories: Category[] };

export function BrandsManager({ brands }: { brands: Brand[] }) {
  const [createState, createAction, creating] = useActionState(createBrandAction, undefined);
  const [renaming, setRenaming] = useState<Brand | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction = (fn: () => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      const res = await fn();
      setFeedback(res?.error ?? null);
    });

  return (
    <Stack spacing={3}>
      <Box component="form" action={createAction} sx={{ display: "flex", gap: 2 }}>
        <TextField
          name="name"
          label="New brand name"
          placeholder="Fantech"
          size="small"
          required
          sx={{ flex: 1, maxWidth: 320 }}
        />
        <Button type="submit" variant="contained" disabled={creating} startIcon={<AddIcon />}>
          {creating ? "Adding…" : "Add brand"}
        </Button>
      </Box>
      {createState?.error && <Alert severity="error">{createState.error}</Alert>}
      {createState?.success && <Alert severity="success">{createState.success}</Alert>}
      {feedback && (
        <Alert severity="error" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {brands.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No brands yet. Add your first brand above — designers pick a brand when they
          upload.
        </Typography>
      )}

      <Stack spacing={2}>
        {brands.map((brand) => (
          <Card key={brand.id}>
            <CardContent>
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Typography variant="h6">{brand.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {brand.folderCount} folder{brand.folderCount === 1 ? "" : "s"}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    aria-label={`Rename ${brand.name}`}
                    onClick={() => {
                      setRenaming(brand);
                      setRenameValue(brand.name);
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${brand.name}`}
                    disabled={pending || brand.folderCount > 0}
                    onClick={() => setDeletingBrand(brand)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {brand.categories.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No categories yet — designers can add them while uploading
                  </Typography>
                )}
                {brand.categories.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.name} (${cat.folderCount})`}
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onDelete={
                      cat.folderCount === 0 && !pending
                        ? () => runAction(() => deleteCategoryAction(cat.id))
                        : undefined
                    }
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <ConfirmDialog
        open={Boolean(deletingBrand)}
        title="Delete brand?"
        body={deletingBrand ? `"${deletingBrand.name}" will be removed.` : undefined}
        confirmLabel="Delete"
        confirmColor="error"
        pending={pending}
        onConfirm={() => {
          if (deletingBrand) runAction(() => deleteBrandAction(deletingBrand.id));
          setDeletingBrand(null);
        }}
        onClose={() => setDeletingBrand(null)}
      />

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename brand</DialogTitle>
        <DialogContent>
          <TextField
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={pending}
            onClick={() => {
              if (renaming) {
                runAction(() => renameBrandAction(renaming.id, renameValue));
                setRenaming(null);
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

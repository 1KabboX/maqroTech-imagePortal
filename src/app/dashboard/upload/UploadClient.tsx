"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";

type Brand = { id: string; name: string };
type CategoryOption = { name: string; isNew?: boolean };

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];

const filter = createFilterOptions<CategoryOption>();

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res, rej)
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) =>
      (entry as FileSystemFileEntry).file(res, rej)
    );
    return [file];
  }
  if (entry.isDirectory) {
    const entries = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    const nested = await Promise.all(entries.map(collectFiles));
    return nested.flat();
  }
  return [];
}

export function UploadClient({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [category, setCategory] = useState<CategoryOption | null>(null);
  const [folderName, setFolderName] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!brandId) {
      setCategories([]);
      setCategory(null);
      return;
    }
    fetch(`/api/categories?brandId=${brandId}`)
      .then((r) => r.json())
      .then((d) =>
        setCategories((d.categories ?? []).map((c: { name: string }) => ({ name: c.name })))
      )
      .catch(() => setCategories([]));
  }, [brandId]);

  const acceptFiles = (incoming: File[], detectedFolderName?: string) => {
    const valid: File[] = [];
    let skippedCount = 0;
    for (const f of incoming) {
      if (!ALLOWED.includes(extOf(f.name))) skippedCount++;
      else valid.push(f);
    }
    setFiles(valid);
    setSkipped(skippedCount);
    setError(valid.length === 0 ? "No usable images found (JPG, PNG, WEBP)" : null);
    if (detectedFolderName && !folderName) setFolderName(detectedFolderName);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const entries = items
      .map((i) => i.webkitGetAsEntry?.())
      .filter((x): x is FileSystemEntry => Boolean(x));

    const dir = entries.find((x) => x.isDirectory);
    const collected = (await Promise.all(entries.map(collectFiles))).flat();
    acceptFiles(collected, dir?.name);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const rel = (picked[0] as File & { webkitRelativePath?: string })?.webkitRelativePath;
    const detected = rel ? rel.split("/")[0] : undefined;
    acceptFiles(picked, detected);
  };

  const canSubmit =
    brandId && category?.name.trim() && folderName.trim() && files.length > 0 && !progress;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setProgress({ done: 0, total: files.length });

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          categoryName: category!.name.trim(),
          folderName: folderName.trim(),
          designerNote: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the folder");

      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        const up = await fetch(`/api/folders/${data.id}/files?initial=1`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const body = await up.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to upload ${files[i].name}`);
        }
        setProgress({ done: i + 1, total: files.length });
      }

      router.push(`/dashboard/folders/${data.id}`);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <Card sx={{ maxWidth: 640 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <TextField
            select
            label="Brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            fullWidth
            required
          >
            {brands.length === 0 && (
              <MenuItem disabled value="">
                No brands yet — ask the admin to add one
              </MenuItem>
            )}
            {brands.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.name}
              </MenuItem>
            ))}
          </TextField>

          <Autocomplete
            value={category}
            onChange={(_, value) => {
              if (typeof value === "string") setCategory({ name: value });
              else setCategory(value);
            }}
            filterOptions={(options, params) => {
              const filtered = filter(options, params);
              const input = params.inputValue.trim();
              if (input && !options.some((o) => o.name.toLowerCase() === input.toLowerCase())) {
                filtered.push({ name: input, isNew: true });
              }
              return filtered;
            }}
            options={categories}
            getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
            renderOption={({ key, ...props }, option) => (
              <li key={key} {...props}>
                {option.isNew ? `＋ Add category "${option.name}"` : option.name}
              </li>
            )}
            freeSolo
            selectOnFocus
            handleHomeEndKeys
            disabled={!brandId}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Category"
                required
                helperText={!brandId ? "Pick a brand first" : "Pick one or type a new category"}
              />
            )}
          />

          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: dragOver ? "primary.main" : "#2a2a2a",
              borderRadius: 3,
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: dragOver ? "rgba(41,121,255,0.08)" : "transparent",
              transition: "all 0.15s",
            }}
          >
            <DriveFolderUploadOutlinedIcon
              sx={{ fontSize: 44, color: dragOver ? "primary.main" : "text.secondary" }}
            />
            <Typography sx={{ mt: 1 }}>
              {files.length > 0
                ? `${files.length} image${files.length === 1 ? "" : "s"} ready`
                : "Drag your folder here, or click to browse"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              JPG, PNG, WEBP — no limits
            </Typography>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              // @ts-expect-error non-standard attribute
              webkitdirectory=""
              onChange={onPick}
            />
          </Box>

          {files.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {files.slice(0, 8).map((f) => (
                <Chip
                  key={f.name}
                  icon={<InsertPhotoOutlinedIcon />}
                  label={f.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {files.length > 8 && (
                <Chip label={`+${files.length - 8} more`} size="small" variant="outlined" />
              )}
            </Stack>
          )}
          {skipped > 0 && (
            <Alert severity="warning">
              {skipped} file{skipped === 1 ? " was" : "s were"} skipped (not JPG/PNG/WEBP)
            </Alert>
          )}

          <TextField
            label="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            required
            fullWidth
            helperText="Auto-filled from your folder — this is the name everyone will see"
          />

          <TextField
            label="Note for admin (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          {error && <Alert severity="error">{error}</Alert>}

          {progress && (
            <Box>
              <LinearProgress
                variant="determinate"
                value={(progress.done / progress.total) * 100}
                sx={{ borderRadius: 1, height: 8 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Uploading {progress.done}/{progress.total}…
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={submit}
            startIcon={<DriveFolderUploadOutlinedIcon />}
          >
            {progress ? "Uploading…" : "Submit folder"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

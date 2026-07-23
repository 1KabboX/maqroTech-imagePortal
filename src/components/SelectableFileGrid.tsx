"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";

export type GridFileItem = {
  id: string;
  displayName: string;
  filePath: string;
  thumbPath: string;
  sizeBytes: number;
  width: number;
  height: number;
  /** Signed, expiring proof that lets another origin fetch this one file. */
  shareToken: string;
};

/** Drag type the maqro.tech admin reads to pull images across origins. */
export const SHARED_IMAGES_TYPE = "application/x-maqro-images";

type Props = {
  files: GridFileItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Plain click while nothing is selected ("open"). */
  onOpen: (file: GridFileItem) => void;
  /** Extra per-file action buttons rendered in the card footer. */
  renderActions?: (file: GridFileItem) => React.ReactNode;
};

type Rect = { left: number; top: number; width: number; height: number };

const DRAG_THRESHOLD = 5;

function intersects(a: DOMRect, b: Rect) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

// Display names can carry a folder prefix ("WHG04/Black 1.png"); DownloadURL
// is colon-delimited and wants a plain filename, so keep just the basename.
function downloadName(displayName: string) {
  const base = displayName.split(/[\\/]/).pop() ?? displayName;
  return base.replace(/:/g, "-");
}

function mimeForName(name: string) {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

// Clipboard image writes require PNG in most browsers. Sources that are
// already PNG go through untouched — re-encoding a large one costs seconds
// for a byte-identical result, which blows the clipboard's activation window.
function blobToPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return Promise.resolve(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((out) => {
        URL.revokeObjectURL(url);
        if (out) resolve(out);
        else reject(new Error("Failed to encode image"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function SelectableFileGrid({ files, selected, onChange, onOpen, renderActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const anchorRef = useRef<string | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [menuFile, setMenuFile] = useState<GridFileItem | null>(null);
  const [toast, setToast] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const selectedSet = new Set(selected);
  // Drive-style: no selection → clicks open; any selection → clicks toggle.
  const selectionMode = selected.length > 0;
  // The system clipboard can only hold one image at a time, so copying only
  // makes sense when exactly one file is targeted.
  const copyTarget = selected.length === 1 ? files.find((f) => f.id === selected[0]) ?? null : null;

  // Prefetched as files become selected (or on mousedown, for a drag with no
  // prior selection) so onDragStart can attach real files synchronously —
  // the drag payload can't be built from an async fetch once dragging starts.
  const fileCache = useRef(new Map<string, File>());
  const inFlightRef = useRef(new Set<string>());
  const prefetchFile = (file: GridFileItem) => {
    if (fileCache.current.has(file.id) || inFlightRef.current.has(file.id)) return;
    inFlightRef.current.add(file.id);
    fetch(`/api/files/${file.filePath}`)
      .then((res) => res.blob())
      .then((blob) => {
        fileCache.current.set(file.id, new File([blob], file.displayName, { type: blob.type }));
      })
      .finally(() => inFlightRef.current.delete(file.id));
  };

  // navigator.clipboard.write() must be called synchronously within the
  // click/keydown handler — any `await` beforehand can let the browser's
  // "user activation" window lapse (especially on a slow fetch), silently
  // failing with NotAllowedError. So we call write() immediately and hand it
  // a promise for the PNG data, which Chrome/Edge resolve in the background.
  const copyImageToClipboard = (file: GridFileItem) => {
    const pngPromise = (async () => {
      const cached = fileCache.current.get(file.id);
      const raw = cached ?? (await (await fetch(`/api/files/${file.filePath}`)).blob());
      return blobToPngBlob(raw);
    })();

    navigator.clipboard
      .write([new ClipboardItem({ "image/png": pngPromise })])
      .then(() => setToast({ severity: "success", text: `Copied "${file.displayName}" to clipboard` }))
      .catch((err: unknown) =>
        setToast({
          severity: "error",
          text: `Couldn't copy the image — ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
        })
      );
  };

  useEffect(() => {
    for (const id of selected) {
      const file = files.find((f) => f.id === id);
      if (file) prefetchFile(file);
    }
  }, [selected, files]);

  const dragStart = (e: React.DragEvent, file: GridFileItem) => {
    const targets =
      selectionMode && selectedSet.has(file.id) ? files.filter((f) => selectedSet.has(f.id)) : [file];

    // Real File objects, for any already prefetched. These only reach drop
    // targets inside this page — a JS-built File has no path on disk, so it
    // can't cross into another tab or app.
    for (const f of targets) {
      const cached = fileCache.current.get(f.id);
      if (cached) e.dataTransfer.items.add(cached);
    }

    // Signed URLs for every dragged file. String data survives the jump to
    // another document, so this is what makes a cross-tab drop work at all —
    // and unlike DownloadURL it is not limited to a single file.
    const shared = targets.map((f) => ({
      name: downloadName(f.displayName),
      url: `${window.location.origin}/api/files/${f.filePath}?token=${encodeURIComponent(f.shareToken)}`,
    }));
    // Deliberately not text/uri-list: that pastes as visible text, which would
    // spill these signed URLs into any chat or notes field they land on.
    e.dataTransfer.setData(SHARED_IMAGES_TYPE, JSON.stringify(shared));

    // Chrome's mechanism for dragging a file out to the desktop or another
    // app. It describes a single file, so it gets the one under the cursor.
    const name = downloadName(file.displayName);
    e.dataTransfer.setData(
      "DownloadURL",
      `${mimeForName(name)}:${name}:${shared.find((s) => s.name === name)?.url ?? shared[0].url}`
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchorRef.current = id;
    onChange([...next]);
  };

  const clickCard = (e: React.MouseEvent, file: GridFileItem) => {
    if (e.shiftKey && anchorRef.current && selectionMode) {
      const ids = files.map((f) => f.id);
      const a = ids.indexOf(anchorRef.current);
      const b = ids.indexOf(file.id);
      if (a !== -1 && b !== -1) {
        const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
        onChange([...new Set([...selected, ...range])]);
        return;
      }
    }
    if (e.ctrlKey || e.metaKey || selectionMode) {
      toggle(file.id);
      return;
    }
    onOpen(file);
  };

  const contextMenu = (e: React.MouseEvent, file: GridFileItem) => {
    e.preventDefault();
    // Right-click starts selection mode; outside the current selection it
    // selects just that file.
    if (!selectedSet.has(file.id)) {
      onChange([file.id]);
    }
    anchorRef.current = file.id;
    setMenuFile(file);
    setMenuPos({ left: e.clientX + 2, top: e.clientY - 6 });
  };

  // Marquee (rubber-band) selection on the grid background, Drive-style.
  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-file-card]")) return;
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const additive = e.ctrlKey || e.metaKey;
    const base = additive ? [...selected] : [];
    let dragging = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;

      const viewportRect: Rect = {
        left: Math.min(startX, ev.clientX),
        top: Math.min(startY, ev.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };

      const bounds = container.getBoundingClientRect();
      setMarquee({
        left: viewportRect.left - bounds.left,
        top: viewportRect.top - bounds.top,
        width: viewportRect.width,
        height: viewportRect.height,
      });

      const hit: string[] = [];
      for (const [id, el] of cardRefs.current) {
        if (intersects(el.getBoundingClientRect(), viewportRect)) hit.push(id);
      }
      onChange([...new Set([...base, ...hit])]);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMarquee(null);
      if (!dragging && !additive) onChange([]); // plain click on empty space clears
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Esc clears the selection; Ctrl/Cmd+C copies the active image.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onChange([]);
        setMenuPos(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLElement &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        const hasTextSelection = (window.getSelection()?.toString().length ?? 0) > 0;
        if (isTyping || hasTextSelection) return;

        if (copyTarget) {
          e.preventDefault();
          copyImageToClipboard(copyTarget);
        } else if (selected.length > 1) {
          e.preventDefault();
          setToast({ severity: "error", text: "Select a single image to copy" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyTarget, selected]);

  return (
    <Box
      ref={containerRef}
      onMouseDown={onBackgroundMouseDown}
      sx={{ position: "relative", userSelect: "none", minHeight: 40 }}
    >
      <Grid container spacing={2}>
        {files.map((file) => {
          const isSelected = selectedSet.has(file.id);
          return (
            <Grid key={file.id} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card
                data-file-card
                draggable
                ref={(el: HTMLElement | null) => {
                  if (el) cardRefs.current.set(file.id, el);
                  else cardRefs.current.delete(file.id);
                }}
                onClick={(e) => clickCard(e, file)}
                onContextMenu={(e) => contextMenu(e, file)}
                onMouseDown={() => prefetchFile(file)}
                onDragStart={(e) => dragStart(e, file)}
                sx={{
                  position: "relative",
                  cursor: "pointer",
                  borderColor: isSelected ? "primary.main" : undefined,
                  bgcolor: isSelected ? "rgba(41,121,255,0.10)" : undefined,
                  transition: "border-color 0.1s, background-color 0.1s",
                  "&:hover .file-select-checkbox": { opacity: 1 },
                }}
              >
                <Checkbox
                  className="file-select-checkbox"
                  size="small"
                  checked={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(file.id);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  slotProps={{ input: { "aria-label": `Select ${file.displayName}` } }}
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    zIndex: 1,
                    p: 0.5,
                    bgcolor: "rgba(0,0,0,0.55)",
                    borderRadius: 1,
                    opacity: isSelected || selectionMode ? 1 : 0,
                    transition: "opacity 0.1s",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                  }}
                />
                <Box sx={{ height: 140, bgcolor: "#1a1a1a", overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${file.thumbPath}`}
                    alt={file.displayName}
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography variant="caption" noWrap sx={{ display: "block" }}>
                    {file.displayName}
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {(file.sizeBytes / 1024).toFixed(0)} KB · {file.width}×{file.height}
                    </Typography>
                    {renderActions?.(file)}
                  </Stack>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {marquee && (
        <Box
          sx={{
            position: "absolute",
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            border: "1px solid",
            borderColor: "primary.main",
            bgcolor: "rgba(41,121,255,0.15)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      <Menu
        open={Boolean(menuPos)}
        onClose={() => setMenuPos(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuPos ?? undefined}
      >
        <MenuItem
          onClick={() => {
            // Always the file under the cursor — the clipboard holds one image,
            // so a wider selection has no bearing on what this copies.
            // Write first, close after: closing hands focus back to the card,
            // and the clipboard write must not race that.
            if (menuFile) copyImageToClipboard(menuFile);
            setMenuPos(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy image</ListItemText>
        </MenuItem>
      </Menu>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ width: "100%" }}>
            {toast.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

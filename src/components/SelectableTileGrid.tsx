"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FolderIcon from "@mui/icons-material/Folder";
import CloseIcon from "@mui/icons-material/Close";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DriveFileRenameOutlineOutlinedIcon from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import { FolderStatusChip } from "@/components/FolderStatusChip";
import {
  downloadFilesToDevice,
  type DownloadMessage,
  type DownloadProgress,
} from "@/lib/download-files";
import { getDownloadEntriesAction, type DownloadKind } from "@/lib/actions/download-actions";
import { renameFolderAction } from "@/lib/actions/folder-manage-actions";
import { renameCategoryAction } from "@/lib/actions/brand-actions";

export type TileItem = {
  id: string;
  name: string;
  href: string;
  /** Secondary line under the name (counts, designer, …). */
  caption?: string;
  /** Renders a status chip footer row — used for folder tiles. */
  status?: "SUBMITTED" | "DECLINED" | "COMPLETED";
  /** Right side of the footer row, e.g. "12 files". */
  footer?: string;
};

type Props = {
  items: TileItem[];
  /** What the tiles are — drives download scope and the context menu. */
  kind: DownloadKind;
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

function TileContent({ item }: { item: TileItem }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
      <FolderIcon sx={{ fontSize: 32, color: "#8ab4f8", flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
            {item.name}
          </Typography>
          {item.status && <FolderStatusChip status={item.status} />}
        </Stack>
        {(item.caption || item.footer) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mt: 0.25 }}>
            {[item.caption, item.footer].filter(Boolean).join(" · ")}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

/**
 * Grid of brand/category/folder tiles. A click opens the tile; right-click,
 * a checkbox tick, or dragging on empty space starts selection mode, where
 * clicks toggle instead (deselecting everything leaves the mode). Right-click
 * also opens a Download / Rename context menu, except for brands.
 */
export function SelectableTileGrid({ items, kind }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const anchorRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [renaming, setRenaming] = useState<TileItem | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [message, setMessage] = useState<DownloadMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedSet = new Set(selected);
  const hasContextMenu = kind !== "brand";
  // Drive-style: no selection → clicks open; any selection → clicks toggle.
  const selectionMode = selected.length > 0;

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchorRef.current = id;
    setSelected([...next]);
  };

  const clickTile = (e: React.MouseEvent, item: TileItem) => {
    if (e.shiftKey && anchorRef.current && selectionMode) {
      const ids = items.map((i) => i.id);
      const a = ids.indexOf(anchorRef.current);
      const b = ids.indexOf(item.id);
      if (a !== -1 && b !== -1) {
        const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
        setSelected([...new Set([...selected, ...range])]);
        return;
      }
    }
    if (e.ctrlKey || e.metaKey || selectionMode) {
      toggle(item.id);
      return;
    }
    router.push(item.href);
  };

  const contextMenu = (e: React.MouseEvent, item: TileItem) => {
    e.preventDefault();
    // Right-click starts selection mode; outside the current selection it
    // selects just that tile.
    if (!selectedSet.has(item.id)) {
      anchorRef.current = item.id;
      setSelected([item.id]);
    }
    if (hasContextMenu) setMenuPos({ left: e.clientX + 2, top: e.clientY - 6 });
  };

  // Marquee (rubber-band) selection on the grid background, Drive-style.
  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-tile-card]")) return;
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
      setSelected([...new Set([...base, ...hit])]);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMarquee(null);
      if (!dragging && !additive) setSelected([]); // plain click on empty space clears
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startDownload = async (ids: string[]) => {
    setMenuPos(null);
    setMessage(null);
    setProgress({ done: 0, total: 0 });
    const manifest = await getDownloadEntriesAction(kind, ids);
    if ("error" in manifest) {
      setProgress(null);
      setMessage({ kind: "error", text: manifest.error });
      return;
    }
    setProgress({ done: 0, total: manifest.entries.length });
    const result = await downloadFilesToDevice(manifest.root, manifest.entries, setProgress);
    setProgress(null);
    setMessage(result);
  };

  const openRename = () => {
    setMenuPos(null);
    const item = items.find((i) => i.id === selected[0]);
    if (!item) return;
    setNameValue(item.name);
    setRenaming(item);
  };

  const saveRename = () => {
    const item = renaming;
    if (!item) return;
    setRenaming(null);
    startTransition(async () => {
      const res =
        kind === "category"
          ? await renameCategoryAction(item.id, nameValue)
          : await renameFolderAction(item.id, nameValue);
      if (res?.error) setMessage({ kind: "error", text: res.error });
      else {
        setMessage(null);
        router.refresh();
      }
    });
  };

  return (
    <Stack spacing={2} className="page-transition">
      {message && (
        <Alert severity={message.kind} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {progress && (
        <Box sx={{ maxWidth: 360 }}>
          <LinearProgress
            variant={progress.total ? "determinate" : "indeterminate"}
            value={progress.total ? (progress.done / progress.total) * 100 : undefined}
            sx={{ borderRadius: 1, height: 6 }}
          />
          <Typography variant="caption" color="text.secondary">
            {progress.total
              ? `Downloading ${progress.done}/${progress.total} files…`
              : "Preparing download…"}
          </Typography>
        </Box>
      )}

      <Box
        ref={containerRef}
        onMouseDown={onBackgroundMouseDown}
        sx={{ position: "relative", userSelect: "none", minHeight: 40 }}
      >
        <Grid container spacing={2}>
          {items.map((item) => {
            const isSelected = selectedSet.has(item.id);
            return (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  data-tile-card
                  ref={(el: HTMLElement | null) => {
                    if (el) cardRefs.current.set(item.id, el);
                    else cardRefs.current.delete(item.id);
                  }}
                  sx={{
                    position: "relative",
                    borderColor: isSelected ? "primary.main" : undefined,
                    bgcolor: isSelected ? "rgba(41,121,255,0.10)" : undefined,
                    transition: "border-color 0.1s, background-color 0.1s",
                    "&:hover .tile-select-checkbox": { opacity: 1 },
                  }}
                >
                  <CardActionArea
                    onClick={(e) => clickTile(e, item)}
                    onContextMenu={(e) => contextMenu(e, item)}
                    sx={{ p: 2, pr: 5 }}
                  >
                    <TileContent item={item} />
                  </CardActionArea>
                  {/* Outside the action area so ticking it doesn't ripple or open. */}
                  <Checkbox
                    className="tile-select-checkbox"
                    size="small"
                    checked={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(item.id);
                    }}
                    slotProps={{ input: { "aria-label": `Select ${item.name}` } }}
                    sx={{
                      position: "absolute",
                      top: "50%",
                      right: 6,
                      transform: "translateY(-50%)",
                      p: 0.5,
                      opacity: isSelected || selectionMode ? 1 : 0,
                      transition: "opacity 0.1s",
                    }}
                  />
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
      </Box>

      {/* Fixed bottom-center floating toolbar — portaled to body to bypass parent transform */}
      {selectionMode && typeof document !== "undefined" && createPortal(
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
            <Button
              size="small"
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              disabled={Boolean(progress)}
              onClick={() => startDownload(selected)}
            >
              Download
            </Button>
            {hasContextMenu && selected.length === 1 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<DriveFileRenameOutlineOutlinedIcon />}
                disabled={pending}
                onClick={openRename}
              >
                Rename
              </Button>
            )}
            <Button size="small" onClick={() => setSelected(items.map((i) => i.id))}>
              Select all
            </Button>
            <IconButton size="small" aria-label="Clear selection" onClick={() => setSelected([])}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        </Box>,
        document.body
      )}

      <Menu
        open={Boolean(menuPos)}
        onClose={() => setMenuPos(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuPos ?? undefined}
      >
        <MenuItem disabled={Boolean(progress)} onClick={() => startDownload(selected)}>
          <ListItemIcon>
            <DownloadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Download{selected.length > 1 ? ` (${selected.length})` : ""}
          </ListItemText>
        </MenuItem>
        <MenuItem disabled={selected.length !== 1 || pending} onClick={openRename}>
          <ListItemIcon>
            <DriveFileRenameOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename {kind}</DialogTitle>
        <DialogContent>
          <TextField
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button variant="contained" disabled={pending} onClick={saveRename}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

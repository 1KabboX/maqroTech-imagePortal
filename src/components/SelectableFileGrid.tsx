"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";

export type GridFileItem = {
  id: string;
  displayName: string;
  filePath: string;
  thumbPath: string;
  sizeBytes: number;
  width: number;
  height: number;
};

type Props = {
  files: GridFileItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Double-click (Drive-style "open"). */
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

export function SelectableFileGrid({ files, selected, onChange, onOpen, renderActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const anchorRef = useRef<string | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const selectedSet = new Set(selected);

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchorRef.current = id;
    onChange([...next]);
  };

  const clickCard = (e: React.MouseEvent, file: GridFileItem) => {
    if (e.ctrlKey || e.metaKey) {
      toggle(file.id);
      return;
    }
    if (e.shiftKey && anchorRef.current) {
      const ids = files.map((f) => f.id);
      const a = ids.indexOf(anchorRef.current);
      const b = ids.indexOf(file.id);
      if (a !== -1 && b !== -1) {
        const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
        onChange([...new Set([...selected, ...range])]);
        return;
      }
    }
    anchorRef.current = file.id;
    onChange(selectedSet.has(file.id) && selectedSet.size === 1 ? [] : [file.id]);
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

  // Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                ref={(el: HTMLElement | null) => {
                  if (el) cardRefs.current.set(file.id, el);
                  else cardRefs.current.delete(file.id);
                }}
                onClick={(e) => clickCard(e, file)}
                onDoubleClick={() => onOpen(file)}
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
                    opacity: isSelected ? 1 : 0,
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
    </Box>
  );
}

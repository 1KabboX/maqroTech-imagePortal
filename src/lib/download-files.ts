"use client";

export type DownloadEntry = { displayName: string; filePath: string };
export type DownloadMessage = { kind: "success" | "error"; text: string };
export type DownloadProgress = { done: number; total: number };

export function sanitize(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "-").trim() || "folder";
}

/** Keeps the display name but guarantees the real file extension is present. */
function finalName(displayName: string, filePath: string) {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return displayName.toLowerCase().endsWith(ext) ? displayName : `${displayName}${ext}`;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
};

async function fetchBlob(filePath: string) {
  const res = await fetch(`/api/files/${filePath}`);
  if (!res.ok) throw new Error("Couldn't read a file from the server");
  return res.blob();
}

/**
 * Saves the given files into a folder on the user's device — directly via the
 * File System Access API where available, otherwise as a zip download.
 * Returns null when the user cancels the folder picker.
 */
export async function downloadFilesToDevice(
  folderName: string,
  files: DownloadEntry[],
  onProgress: (p: DownloadProgress) => void
): Promise<DownloadMessage | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;

  if (picker) {
    let root: FileSystemDirectoryHandle;
    try {
      root = await picker({ mode: "readwrite" });
    } catch {
      return null; // user cancelled the picker
    }
    try {
      const target = await root.getDirectoryHandle(sanitize(folderName), { create: true });
      for (let i = 0; i < files.length; i++) {
        const blob = await fetchBlob(files[i].filePath);
        const handle = await target.getFileHandle(
          sanitize(finalName(files[i].displayName, files[i].filePath)),
          { create: true }
        );
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        onProgress({ done: i + 1, total: files.length });
      }
      return { kind: "success", text: `Folder "${sanitize(folderName)}" saved` };
    } catch (err) {
      return { kind: "error", text: err instanceof Error ? err.message : "Download failed" };
    }
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const dir = zip.folder(sanitize(folderName))!;
    for (let i = 0; i < files.length; i++) {
      const blob = await fetchBlob(files[i].filePath);
      dir.file(sanitize(finalName(files[i].displayName, files[i].filePath)), blob);
      onProgress({ done: i + 1, total: files.length });
    }
    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitize(folderName)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    return {
      kind: "success",
      text: "Downloaded as zip (direct folder save needs Chrome/Edge)",
    };
  } catch (err) {
    return { kind: "error", text: err instanceof Error ? err.message : "Download failed" };
  }
}

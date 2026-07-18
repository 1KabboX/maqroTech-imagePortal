"use client";

import Chip from "@mui/material/Chip";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

const config = {
  SUBMITTED: { label: "Submitted", color: "primary" as const },
  DECLINED: { label: "Declined", color: "error" as const },
  COMPLETED: { label: "Completed", color: "success" as const },
};

export function FolderStatusChip({
  status,
  size = "small",
}: {
  status: "SUBMITTED" | "DECLINED" | "COMPLETED";
  size?: "small" | "medium";
}) {
  const c = config[status];
  return (
    <Chip
      label={c.label}
      color={c.color}
      size={size}
      icon={status === "COMPLETED" ? <LockOutlinedIcon sx={{ fontSize: 14 }} /> : undefined}
    />
  );
}

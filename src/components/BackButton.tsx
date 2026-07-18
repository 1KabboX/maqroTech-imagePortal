"use client";

import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";

export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button
      startIcon={<ArrowBackIcon />}
      sx={{ alignSelf: "flex-start" }}
      onClick={() => router.back()}
    >
      {label}
    </Button>
  );
}

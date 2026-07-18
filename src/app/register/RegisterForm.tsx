"use client";

import { useActionState, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { BrandMark } from "@/components/BrandMark";
import { registerAction } from "@/lib/actions/auth-actions";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export function RegisterForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    if (!username) {
      setAvailability("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/register/username-check?u=${encodeURIComponent(username)}`);
        const data = await res.json();
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const usernameHelp =
    availability === "taken"
      ? "That username's already taken"
      : availability === "invalid"
        ? "3–20 characters: letters, numbers, underscores"
        : availability === "available"
          ? "Username available"
          : "This will be your display handle";

  return (
    <Card sx={{ width: "100%", maxWidth: 440 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <BrandMark />
            <Typography variant="h5">Complete registration</Typography>
            <Typography variant="body2" color="text.secondary">
              You&apos;ve been added as a designer. Set up your account to continue.
            </Typography>
          </Box>

          {state?.error && <Alert severity="error">{state.error}</Alert>}

          <Box component="form" action={formAction}>
            <Stack spacing={2}>
              <TextField
                name="email"
                type="email"
                label="Email"
                value={email}
                fullWidth
                slotProps={{ input: { readOnly: true } }}
              />
              <TextField name="name" label="Full name" required fullWidth autoFocus />
              <TextField
                name="username"
                label="Username"
                required
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                error={availability === "taken" || availability === "invalid"}
                color={availability === "available" ? "success" : undefined}
                helperText={usernameHelp}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        {availability === "available" && (
                          <CheckCircleOutlineIcon color="success" fontSize="small" />
                        )}
                        {availability === "taken" && (
                          <HighlightOffIcon color="error" fontSize="small" />
                        )}
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField name="password" type="password" label="New password" required fullWidth />
              <TextField
                name="confirm"
                type="password"
                label="Confirm new password"
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={pending || availability === "taken"}
              >
                {pending ? "Creating account…" : "Create account"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

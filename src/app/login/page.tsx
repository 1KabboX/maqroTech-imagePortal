"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { BrandMark } from "@/components/BrandMark";
import { loginAction } from "@/lib/actions/auth-actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <Card sx={{ width: "100%", maxWidth: 400 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <BrandMark />
            <Typography variant="h5">Image portal</Typography>
            <Typography variant="body2" color="text.secondary">
              Log in with your email. First time here? Use the temporary password the
              admin sent you and we&apos;ll take you to registration.
            </Typography>
          </Box>

          {justRegistered && <Alert severity="success">Registration complete. Log in</Alert>}
          {state?.error && <Alert severity="error">{state.error}</Alert>}

          <Box component="form" action={formAction}>
            <Stack spacing={2}>
              <TextField name="email" type="email" label="Email" required fullWidth autoFocus />
              <TextField name="password" type="password" label="Password" fullWidth />
              <Button type="submit" variant="contained" size="large" disabled={pending}>
                {pending ? "Logging in…" : "Log in"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </Box>
  );
}

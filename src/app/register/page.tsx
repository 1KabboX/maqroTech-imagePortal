import { cookies } from "next/headers";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { prisma } from "@/lib/prisma";
import { REGISTER_COOKIE, verifyRegisterToken } from "@/lib/register-token";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const email = verifyRegisterToken(cookieStore.get(REGISTER_COOKIE)?.value);

  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { status: true } })
    : null;
  const invited = user?.status === "INVITED";

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
      {invited && email ? (
        <RegisterForm email={email} />
      ) : (
        <Card sx={{ width: "100%", maxWidth: 400 }}>
          <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="h5">Start from login</Typography>
            <Typography variant="body2" color="text.secondary">
              Log in with your email and the temporary password from the admin, and
              we&apos;ll bring you back here to finish registration.
            </Typography>
            <Button variant="contained" href="/login">
              Go to login
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

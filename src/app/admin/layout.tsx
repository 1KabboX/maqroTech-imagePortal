import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppLayout } from "@/components/AppLayout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return (
    <AppLayout
      name={session.user.name ?? "Admin"}
      role="ADMIN"
      publicId={session.user.publicId}
      unreadCount={unreadCount}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children}
      </Container>
    </AppLayout>
  );
}

import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationsList } from "@/components/NotificationsList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Viewing the page clears the unread badge; this visit still shows the highlights.
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Notifications</Typography>
      <NotificationsList items={items} />
    </Stack>
  );
}

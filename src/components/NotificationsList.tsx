import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationsList({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return (
      <Stack spacing={1} sx={{ alignItems: "center", py: 6, color: "text.secondary" }}>
        <NotificationsNoneIcon sx={{ fontSize: 40 }} />
        <Typography variant="body2">No notifications yet</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      {items.map((n) => {
        const content = (
          <Card
            sx={{
              p: 2,
              borderLeft: n.isRead ? "3px solid transparent" : "3px solid #2979ff",
              bgcolor: n.isRead ? "background.paper" : "rgba(41,121,255,0.06)",
              transition: "background 0.15s",
              "&:hover": n.link ? { bgcolor: "rgba(41,121,255,0.12)" } : undefined,
            }}
          >
            <Typography variant="subtitle2">{n.title}</Typography>
            {n.body && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {n.body}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {new Date(n.createdAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
          </Card>
        );

        return n.link ? (
          <Box
            key={n.id}
            component="a"
            href={n.link}
            sx={{ textDecoration: "none", display: "block" }}
          >
            {content}
          </Box>
        ) : (
          <Box key={n.id}>{content}</Box>
        );
      })}
    </Stack>
  );
}

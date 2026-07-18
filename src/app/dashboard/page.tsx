import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function DesignerDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const [submitted, declined, completed, declinedFolders] = await Promise.all([
    prisma.folder.count({ where: { designerId: userId, status: "SUBMITTED" } }),
    prisma.folder.count({ where: { designerId: userId, status: "DECLINED" } }),
    prisma.folder.count({ where: { designerId: userId, status: "COMPLETED" } }),
    prisma.folder.findMany({
      where: { designerId: userId, status: "DECLINED" },
      orderBy: { declinedAt: "desc" },
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } },
        _count: { select: { files: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Submitted", value: submitted, color: "primary" as const },
    { label: "Declined — needs fixing", value: declined, color: "error" as const },
    { label: "Completed", value: completed, color: "success" as const },
  ];

  return (
    <Stack spacing={4}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h4">My work</Typography>
        {session?.user.publicId && (
          <Chip label={session.user.publicId} variant="outlined" size="small" />
        )}
      </Stack>

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 1 }} color={`${s.color}.main`}>
                  {s.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          href="/dashboard/upload"
          startIcon={<UploadOutlinedIcon />}
        >
          Upload folder
        </Button>
        <Button variant="outlined" href="/dashboard/folders">
          My folders
        </Button>
      </Stack>

      <Card
        sx={{
          borderColor: declinedFolders.length > 0 ? "error.main" : "#1f1f1f",
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CampaignOutlinedIcon
                color={declinedFolders.length > 0 ? "error" : "disabled"}
              />
              <Typography variant="h6">Notice board</Typography>
              {declinedFolders.length > 0 && (
                <Chip
                  label={`${declinedFolders.length} need${declinedFolders.length === 1 ? "s" : ""} fixing`}
                  color="error"
                  size="small"
                />
              )}
            </Stack>

            {declinedFolders.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
              >
                <CheckCircleOutlinedIcon color="success" sx={{ fontSize: 18 }} />
                All clear — nothing declined right now.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {declinedFolders.map((f) => (
                  <Box
                    key={f.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "rgba(239,68,68,0.4)",
                      bgcolor: "rgba(239,68,68,0.06)",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {f.name}
                          </Typography>
                          <Chip label={f.brand.name} size="small" variant="outlined" />
                          <Chip
                            label={f.category.name}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {f._count.files} file{f._count.files === 1 ? "" : "s"}
                            {f.declinedAt &&
                              ` · declined ${f.declinedAt.toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}`}
                          </Typography>
                        </Stack>
                        {f.adminNote && (
                          <Alert severity="error" sx={{ mt: 1, py: 0.25 }}>
                            <strong>Admin:</strong> {f.adminNote}
                          </Alert>
                        )}
                      </Box>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        href={`/dashboard/folders/${f.id}`}
                        endIcon={<ArrowForwardIcon />}
                        sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
                      >
                        Fix &amp; resubmit
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

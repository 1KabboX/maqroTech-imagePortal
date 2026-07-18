import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { prisma } from "@/lib/prisma";

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function AdminDashboard() {
  const [designerCount, invitedCount, folderCount, declinedFolders, updatedFolders] =
    await Promise.all([
      prisma.user.count({ where: { role: "DESIGNER", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "DESIGNER", status: "INVITED" } }),
      prisma.folder.count(),
      prisma.folder.findMany({
        where: { status: "DECLINED" },
        orderBy: { declinedAt: "desc" },
        include: {
          brand: { select: { name: true } },
          category: { select: { name: true } },
          designer: { select: { name: true, publicId: true } },
          _count: { select: { files: true } },
        },
      }),
      // Declined earlier, resubmitted by the designer, waiting for a fresh review.
      prisma.folder.findMany({
        where: { status: "SUBMITTED", declinedAt: { not: null } },
        orderBy: { submittedAt: "desc" },
        include: {
          brand: { select: { name: true } },
          category: { select: { name: true } },
          designer: { select: { name: true, publicId: true } },
          _count: { select: { files: true } },
        },
      }),
    ]);

  const stats = [
    { label: "Active designers", value: designerCount },
    { label: "Pending invites", value: invitedCount },
    { label: "Submitted folders", value: folderCount },
  ];

  const noticeCount = declinedFolders.length + updatedFolders.length;

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Dashboard</Typography>

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {s.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" href="/admin/folders" startIcon={<FolderOutlinedIcon />}>
          Review folders
        </Button>
        <Button variant="outlined" href="/admin/brands">
          Manage brands
        </Button>
        <Button variant="outlined" href="/admin/designers" startIcon={<GroupOutlinedIcon />}>
          Manage designers
        </Button>
      </Stack>

      <Card sx={{ borderColor: noticeCount > 0 ? "primary.main" : "#1f1f1f" }}>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CampaignOutlinedIcon color={noticeCount > 0 ? "primary" : "disabled"} />
              <Typography variant="h6">Notice board</Typography>
              {updatedFolders.length > 0 && (
                <Chip
                  label={`${updatedFolders.length} updated`}
                  color="secondary"
                  size="small"
                />
              )}
              {declinedFolders.length > 0 && (
                <Chip
                  label={`${declinedFolders.length} declined`}
                  color="error"
                  size="small"
                />
              )}
            </Stack>

            {noticeCount === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
              >
                <CheckCircleOutlinedIcon color="success" sx={{ fontSize: 18 }} />
                All clear — no declines waiting, nothing resubmitted.
              </Typography>
            )}

            {updatedFolders.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  Updated — resubmitted, ready for review
                </Typography>
                {updatedFolders.map((f) => (
                  <Box
                    key={f.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "rgba(0,229,195,0.35)",
                      bgcolor: "rgba(0,229,195,0.05)",
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
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}
                        >
                          <Chip label="Updated" color="secondary" size="small" />
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
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {f.designer.name} ({f.designer.publicId}) · {f._count.files} file
                          {f._count.files === 1 ? "" : "s"} · resubmitted{" "}
                          {shortDate(f.submittedAt)}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        color="secondary"
                        size="small"
                        href={`/admin/folders/${f.id}`}
                        endIcon={<ArrowForwardIcon />}
                        sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
                      >
                        Review
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {declinedFolders.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  Declined — waiting on the designer
                </Typography>
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
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}
                        >
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
                            {f.designer.name} ({f.designer.publicId}) · {f._count.files} file
                            {f._count.files === 1 ? "" : "s"}
                            {f.declinedAt && ` · declined ${shortDate(f.declinedAt)}`}
                          </Typography>
                        </Stack>
                        {f.adminNote && (
                          <Alert severity="error" sx={{ mt: 1, py: 0.25 }}>
                            <strong>Your note:</strong> {f.adminNote}
                          </Alert>
                        )}
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        href={`/admin/folders/${f.id}`}
                        endIcon={<ArrowForwardIcon />}
                        sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
                      >
                        View
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

import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { prisma } from "@/lib/prisma";
import { InvitePanel } from "./InvitePanel";
import { DesignerRow } from "./DesignerRow";

export default async function DesignersPage() {
  const designers = await prisma.user.findMany({
    where: { role: "DESIGNER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { folders: true } } },
  });

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Designers</Typography>
        <Typography variant="body2" color="text.secondary">
          Add a designer by email — a temporary password is generated for you to send
          them. They&apos;ll log in with it and set their own name, username, and new
          password.
        </Typography>
      </Stack>

      <InvitePanel />

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Designer</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {designers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No designers yet. Add your first designer above.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {designers.map((d) => (
                <DesignerRow
                  key={d.id}
                  designer={{
                    id: d.id,
                    email: d.email,
                    name: d.name,
                    username: d.username,
                    publicId: d.publicId,
                    status: d.status,
                    createdAt: d.createdAt.toISOString(),
                    folderCount: d._count.folders,
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}

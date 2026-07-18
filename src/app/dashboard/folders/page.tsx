import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import FolderIcon from "@mui/icons-material/Folder";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FolderStatusChip } from "@/components/FolderStatusChip";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { FolderUploadDialog } from "@/components/FolderUploadDialog";
import { DropUploader } from "@/components/DropUploader";

function DriveTile({
  href,
  name,
  meta,
}: {
  href: string;
  name: string;
  meta: string;
}) {
  return (
    <Card>
      <CardActionArea href={href} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <FolderIcon sx={{ fontSize: 36, color: "#8ab4f8" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {meta}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function PageHeader({
  crumbs,
  title,
  action,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack spacing={1}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
        {crumbs.map((c) =>
          c.href ? (
            <MuiLink
              key={c.label}
              href={c.href}
              underline="hover"
              color="text.secondary"
              variant="body2"
            >
              {c.label}
            </MuiLink>
          ) : (
            <Typography key={c.label} variant="body2" color="text.primary">
              {c.label}
            </Typography>
          )
        )}
      </Breadcrumbs>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">{title}</Typography>
        {action}
      </Stack>
    </Stack>
  );
}

export default async function FoldersPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; category?: string }>;
}) {
  const session = await auth();
  const designerId = session!.user.id;
  const { brand: brandId, category: categoryId } = await searchParams;

  // Level 3 — the designer's folders inside a brand/category, plus upload
  if (brandId && categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { brand: { select: { id: true, name: true } } },
    });
    if (!category || category.brand.id !== brandId) notFound();

    const folders = await prisma.folder.findMany({
      where: { designerId, brandId, categoryId },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      include: {
        _count: { select: { files: true } },
      },
    });

    return (
      <Stack spacing={4}>
        <PageHeader
          crumbs={[
            { label: "Folders", href: "/dashboard/folders" },
            { label: category.brand.name, href: `/dashboard/folders?brand=${brandId}` },
            { label: category.name },
          ]}
          title={category.name}
          action={<FolderUploadDialog brandId={brandId} categoryName={category.name} />}
        />
        <DropUploader brandId={brandId} categoryName={category.name} />

        {folders.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No folders from you in this category yet — drag one in from your computer, or use
            the Upload button.
          </Typography>
        )}

        <Grid container spacing={2}>
          {folders.map((f) => (
            <Grid key={f.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardActionArea href={`/dashboard/folders/${f.id}`} sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                      <FolderIcon sx={{ fontSize: 36, color: "#8ab4f8" }} />
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                        {f.name}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <FolderStatusChip status={f.status} />
                      <Typography variant="caption" color="text.secondary">
                        {f._count.files} file{f._count.files === 1 ? "" : "s"}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    );
  }

  const grouped = await prisma.folder.groupBy({
    by: ["brandId", "categoryId"],
    where: { designerId },
    _count: { _all: true },
  });

  // Level 2 — all categories inside a brand; designers can create categories
  if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) notFound();

    const categories = await prisma.category.findMany({
      where: { brandId },
      orderBy: { name: "asc" },
    });
    const countByCategory = new Map(
      grouped.filter((g) => g.brandId === brandId).map((r) => [r.categoryId, r._count._all])
    );

    return (
      <Stack spacing={4}>
        <PageHeader
          crumbs={[
            { label: "Folders", href: "/dashboard/folders" },
            { label: brand.name },
          ]}
          title={brand.name}
          action={<CreateCategoryDialog brandId={brandId} />}
        />

        {categories.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No categories in this brand yet — create the first one.
          </Typography>
        )}

        <Grid container spacing={2}>
          {categories.map((c) => {
            const count = countByCategory.get(c.id) ?? 0;
            return (
              <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <DriveTile
                  href={`/dashboard/folders?brand=${brandId}&category=${c.id}`}
                  name={c.name}
                  meta={`${count} folder${count === 1 ? "" : "s"} from you`}
                />
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    );
  }

  // Level 1 — all brands (read-only for designers)
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { categories: true } } },
  });
  const folderCountByBrand = new Map<string, number>();
  for (const g of grouped) {
    folderCountByBrand.set(g.brandId, (folderCountByBrand.get(g.brandId) ?? 0) + g._count._all);
  }

  return (
    <Stack spacing={4}>
      <PageHeader crumbs={[{ label: "Folders" }]} title="Folders" />

      {brands.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No brands yet — ask the admin to add one.
        </Typography>
      )}

      <Grid container spacing={2}>
        {brands.map((b) => {
          const mine = folderCountByBrand.get(b.id) ?? 0;
          return (
            <Grid key={b.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <DriveTile
                href={`/dashboard/folders?brand=${b.id}`}
                name={b.name}
                meta={`${b._count.categories} categor${b._count.categories === 1 ? "y" : "ies"} · ${mine} folder${mine === 1 ? "" : "s"} from you`}
              />
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}

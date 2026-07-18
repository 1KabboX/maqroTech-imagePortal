import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import FolderIcon from "@mui/icons-material/Folder";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { prisma } from "@/lib/prisma";
import type { FolderStatus, Prisma } from "@prisma/client";
import { FolderStatusChip } from "@/components/FolderStatusChip";
import { CreateBrandDialog } from "@/components/CreateBrandDialog";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { FolderUploadDialog } from "@/components/FolderUploadDialog";
import { DropUploader } from "@/components/DropUploader";

const TABS: { label: string; value?: FolderStatus }[] = [
  { label: "All" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Completed", value: "COMPLETED" },
];

function DriveTile({ href, name, meta }: { href: string; name: string; meta: string }) {
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

export default async function AdminFoldersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    brandId?: string;
    categoryId?: string;
    designerId?: string;
  }>;
}) {
  const { status, q, brandId, categoryId, designerId } = await searchParams;
  const filter = TABS.find((t) => t.value === status)?.value;

  const keepParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q, brandId, categoryId, designerId, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/folders?${s}` : "/admin/folders";
  };

  const baseWhere: Prisma.FolderWhereInput = {
    ...(filter ? { status: filter } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(designerId ? { designerId } : {}),
  };

  const designers = await prisma.user.findMany({
    where: { role: "DESIGNER", status: { not: "INVITED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, publicId: true },
  });

  const filterBar = (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        {TABS.map((tab) => (
          <Button
            key={tab.label}
            variant={filter === tab.value ? "contained" : "outlined"}
            size="small"
            href={keepParams({ status: tab.value })}
          >
            {tab.label}
          </Button>
        ))}
      </Stack>

      <form method="GET" action="/admin/folders">
        {filter && <input type="hidden" name="status" value={filter} />}
        {brandId && <input type="hidden" name="brandId" value={brandId} />}
        {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search folder name…"
            style={{
              background: "#121212",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              color: "#fff",
              padding: "8px 12px",
              minWidth: 220,
            }}
          />
          <select
            name="designerId"
            defaultValue={designerId ?? ""}
            style={{
              background: "#121212",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              color: "#fff",
              padding: "8px 12px",
            }}
          >
            <option value="">All designers</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.publicId})
              </option>
            ))}
          </select>
          <Button type="submit" variant="outlined" size="small">
            Filter
          </Button>
          {(q || designerId) && (
            <Button href={keepParams({ q: undefined, designerId: undefined })} size="small">
              Clear
            </Button>
          )}
        </Stack>
      </form>
    </Stack>
  );

  // Level 3 — folders inside a brand/category
  if (brandId && categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { brand: { select: { id: true, name: true } } },
    });
    if (!category || category.brand.id !== brandId) notFound();

    const folders = await prisma.folder.findMany({
      where: { ...baseWhere, brandId, categoryId },
      orderBy: { submittedAt: "desc" },
      include: {
        designer: { select: { name: true, publicId: true } },
        _count: { select: { files: true } },
      },
    });

    return (
      <Stack spacing={4}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <MuiLink
            href={keepParams({ brandId: undefined, categoryId: undefined })}
            underline="hover"
            color="text.secondary"
            variant="body2"
          >
            Folders
          </MuiLink>
          <MuiLink
            href={keepParams({ categoryId: undefined })}
            underline="hover"
            color="text.secondary"
            variant="body2"
          >
            {category.brand.name}
          </MuiLink>
          <Typography variant="body2" color="text.primary">
            {category.name}
          </Typography>
        </Breadcrumbs>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h4">{category.name}</Typography>
          <FolderUploadDialog brandId={brandId} categoryName={category.name} />
        </Stack>
        <DropUploader brandId={brandId} categoryName={category.name} />

        {filterBar}

        {folders.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No folders match here yet.
          </Typography>
        )}

        <Grid container spacing={2}>
          {folders.map((f) => (
            <Grid key={f.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardActionArea href={`/admin/folders/${f.id}`} sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                      <FolderIcon sx={{ fontSize: 36, color: "#8ab4f8" }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                          {f.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {f.designer.name} ({f.designer.publicId})
                        </Typography>
                      </Box>
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
    where: baseWhere,
    _count: { _all: true },
  });

  // Level 2 — all categories inside a brand
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
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <MuiLink
            href={keepParams({ brandId: undefined, categoryId: undefined })}
            underline="hover"
            color="text.secondary"
            variant="body2"
          >
            Folders
          </MuiLink>
          <Typography variant="body2" color="text.primary">
            {brand.name}
          </Typography>
        </Breadcrumbs>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h4">{brand.name}</Typography>
          <CreateCategoryDialog brandId={brandId} />
        </Stack>

        {filterBar}

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
                  href={keepParams({ categoryId: c.id })}
                  name={c.name}
                  meta={`${count} folder${count === 1 ? "" : "s"}`}
                />
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    );
  }

  // Level 1 — all brands
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
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">Folders</Typography>
        <CreateBrandDialog />
      </Stack>

      {filterBar}

      {brands.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No brands yet — create the first one.
        </Typography>
      )}

      <Grid container spacing={2}>
        {brands.map((b) => {
          const folderCount = folderCountByBrand.get(b.id) ?? 0;
          return (
            <Grid key={b.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <DriveTile
                href={keepParams({ brandId: b.id })}
                name={b.name}
                meta={`${b._count.categories} categor${b._count.categories === 1 ? "y" : "ies"} · ${folderCount} folder${folderCount === 1 ? "" : "s"}`}
              />
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}

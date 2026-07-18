import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { prisma } from "@/lib/prisma";
import type { FolderStatus, Prisma } from "@prisma/client";
import { CreateBrandDialog } from "@/components/CreateBrandDialog";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { FolderUploadDialog } from "@/components/FolderUploadDialog";
import { DropUploader } from "@/components/DropUploader";
import { SelectableTileGrid } from "@/components/SelectableTileGrid";

const TABS: { label: string; value?: FolderStatus }[] = [
  { label: "All" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Completed", value: "COMPLETED" },
];

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

  const selectStyle = {
    background: "#121212",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    color: "#fff",
    padding: "8px 12px",
  };

  const filterBar = (
    <form method="GET" action="/admin/folders">
      {brandId && <input type="hidden" name="brandId" value={brandId} />}
      {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search folder name…"
          style={{ ...selectStyle, minWidth: 220 }}
        />
        <select name="status" defaultValue={filter ?? ""} style={selectStyle}>
          {TABS.map((tab) => (
            <option key={tab.label} value={tab.value ?? ""}>
              {tab.label}
            </option>
          ))}
        </select>
        <select name="designerId" defaultValue={designerId ?? ""} style={selectStyle}>
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
        {(q || designerId || filter) && (
          <Button
            href={keepParams({ q: undefined, designerId: undefined, status: undefined })}
            size="small"
          >
            Clear
          </Button>
        )}
      </Stack>
    </form>
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

        <SelectableTileGrid
          key={`folders:${brandId}:${categoryId}:${filter ?? ""}:${q ?? ""}:${designerId ?? ""}`}
          kind="folder"
          items={folders.map((f) => ({
            id: f.id,
            name: f.name,
            href: `/admin/folders/${f.id}`,
            status: f.status,
            footer: `${f._count.files} file${f._count.files === 1 ? "" : "s"}`,
          }))}
        />
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

        <SelectableTileGrid
          key={`categories:${brandId}`}
          kind="category"
          items={categories.map((c) => {
            const count = countByCategory.get(c.id) ?? 0;
            return {
              id: c.id,
              name: c.name,
              href: keepParams({ categoryId: c.id }),
              caption: `${count} folder${count === 1 ? "" : "s"}`,
            };
          })}
        />
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

      <SelectableTileGrid
        key={`brands:${filter ?? ""}:${q ?? ""}:${designerId ?? ""}`}
        kind="brand"
        items={brands.map((b) => {
          const folderCount = folderCountByBrand.get(b.id) ?? 0;
          return {
            id: b.id,
            name: b.name,
            href: keepParams({ brandId: b.id }),
            caption: `${b._count.categories} categor${b._count.categories === 1 ? "y" : "ies"} · ${folderCount} folder${folderCount === 1 ? "" : "s"}`,
          };
        })}
      />
    </Stack>
  );
}

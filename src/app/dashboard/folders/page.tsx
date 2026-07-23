import { notFound } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { FolderUploadDialog } from "@/components/FolderUploadDialog";
import { DropUploader } from "@/components/DropUploader";
import { SelectableTileGrid } from "@/components/SelectableTileGrid";

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
          action={
            <Stack direction="row" spacing={1}>
              <CreateFolderDialog
                brandId={brandId}
                categoryName={category.name}
                detailPathPrefix="/dashboard/folders"
              />
              <FolderUploadDialog brandId={brandId} categoryName={category.name} />
            </Stack>
          }
        />
        <DropUploader brandId={brandId} categoryName={category.name} />

        {folders.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No folders from you in this category yet — drag one in from your computer, or use
            the Upload button.
          </Typography>
        )}

        <SelectableTileGrid
          key={`folders:${brandId}:${categoryId}`}
          kind="folder"
          items={folders.map((f) => ({
            id: f.id,
            name: f.name,
            href: `/dashboard/folders/${f.id}`,
            status: f.status,
            footer: `${f._count.files} file${f._count.files === 1 ? "" : "s"}`,
          }))}
        />
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

        <SelectableTileGrid
          key={`categories:${brandId}`}
          kind="category"
          items={categories.map((c) => {
            const count = countByCategory.get(c.id) ?? 0;
            return {
              id: c.id,
              name: c.name,
              href: `/dashboard/folders?brand=${brandId}&category=${c.id}`,
              caption: `${count} folder${count === 1 ? "" : "s"} from you`,
            };
          })}
        />
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

      <SelectableTileGrid
        key="brands"
        kind="brand"
        items={brands.map((b) => {
          const mine = folderCountByBrand.get(b.id) ?? 0;
          return {
            id: b.id,
            name: b.name,
            href: `/dashboard/folders?brand=${b.id}`,
            caption: `${b._count.categories} categor${b._count.categories === 1 ? "y" : "ies"} · ${mine} folder${mine === 1 ? "" : "s"} from you`,
          };
        })}
      />
    </Stack>
  );
}

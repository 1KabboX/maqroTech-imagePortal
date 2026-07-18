import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
      <Typography
        component="span"
        sx={{ fontWeight: 800, letterSpacing: "0.08em", fontSize: 18, color: "#fff" }}
      >
        MAQRO
        <Box component="span" sx={{ color: "primary.main" }}>
          .TECH
        </Box>
      </Typography>
      {subtitle && (
        <Typography component="span" sx={{ color: "text.secondary", fontSize: 13 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

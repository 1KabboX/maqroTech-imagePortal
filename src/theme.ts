"use client";
import { createTheme } from "@mui/material/styles";

export const maqroTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#050505",
      paper: "#121212",
    },
    primary: {
      main: "#2979ff",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#00e5c3",
      contrastText: "#04342c",
    },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
    text: {
      primary: "#ffffff",
      secondary: "#9e9e9e",
    },
    divider: "#1f1f1f",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-geist-sans), Roboto, Arial, sans-serif",
    h4: { fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" },
    h5: { fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #1f1f1f",
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#0a0a0a",
          backgroundImage: "none",
          borderBottom: "1px solid #1f1f1f",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      variants: [
        {
          props: { variant: "contained", color: "inherit" },
          style: {
            backgroundColor: "#ffffff",
            color: "#000000",
            "&:hover": { backgroundColor: "#e0e0e0" },
          },
        },
      ],
    },
  },
});

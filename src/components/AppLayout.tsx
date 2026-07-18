"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import Badge from "@mui/material/Badge";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import LogoutIcon from "@mui/icons-material/Logout";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ClassOutlinedIcon from "@mui/icons-material/ClassOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";

import { BrandMark } from "@/components/BrandMark";
import { signOutAction } from "@/lib/actions/auth-actions";

const drawerWidth = 260;

type Props = {
  name: string;
  role: "ADMIN" | "DESIGNER";
  publicId?: string | null;
  unreadCount?: number;
  children: React.ReactNode;
};

const NAV_LINKS = {
  ADMIN: [
    { label: "Dashboard", href: "/admin", icon: <DashboardOutlinedIcon /> },
    { label: "Folders", href: "/admin/folders", icon: <FolderOutlinedIcon /> },
    { label: "Brands", href: "/admin/brands", icon: <ClassOutlinedIcon /> },
    { label: "Designers", href: "/admin/designers", icon: <GroupOutlinedIcon /> },
  ],
  DESIGNER: [
    { label: "Dashboard", href: "/dashboard", icon: <DashboardOutlinedIcon /> },
    { label: "Upload", href: "/dashboard/upload", icon: <UploadOutlinedIcon /> },
    { label: "My folders", href: "/dashboard/folders", icon: <FolderOutlinedIcon /> },
  ],
};

export function AppLayout({ name, role, publicId, unreadCount = 0, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const pathname = usePathname();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const drawer = (
    <div>
      <Toolbar sx={{ justifyContent: "center", py: 2 }}>
        <BrandMark subtitle={role === "ADMIN" ? "Admin" : "Portal"} />
      </Toolbar>
      <Divider />
      <List sx={{ px: 2, pt: 3, display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV_LINKS[role].map((item) => {
          const active = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                href={item.href}
                sx={{
                  borderRadius: 2,
                  bgcolor: active ? "rgba(41,121,255,0.08)" : "transparent",
                  color: active ? "primary.main" : "text.secondary",
                  "&:hover": {
                    bgcolor: active ? "rgba(41,121,255,0.12)" : "rgba(255,255,255,0.05)",
                    color: active ? "primary.main" : "text.primary",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: "inherit",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  disableTypography
                  primary={<Typography sx={{ fontWeight: active ? 600 : 500 }}>{item.label}</Typography>}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: "background.default",
          backgroundImage: "none",
          borderBottom: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            aria-label="Notifications"
            href={role === "ADMIN" ? "/admin/notifications" : "/dashboard/notifications"}
            sx={{ color: "text.secondary", mr: 1 }}
          >
            <Badge badgeContent={unreadCount} color="primary">
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Account menu">
            <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14 }}>
              {initials || "?"}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <ListItemText primary={name} secondary={role === "ADMIN" ? "Admin" : "Designer"} />
              {publicId && <Chip label={publicId} size="small" variant="outlined" sx={{ mt: 0.5 }} />}
            </Box>
            <Divider />
            <form action={signOutAction}>
              <MenuItem component="button" type="submit" sx={{ width: "100%" }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Log out
              </MenuItem>
            </form>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: "64px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import { useThemeMode } from "@/components/providers/theme-mode-context";
import { zIndexScale } from "@/theme/portal-editals-theme";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 220;

type NavItem = {
  href: string;
  label: string;
  icon: typeof SearchOutlinedIcon;
};

const toolsNavItems: NavItem[] = [
  { href: "/analyzer", label: "Analista", icon: AnalyticsOutlinedIcon },
  { href: "/dashboard", label: "Busca", icon: SearchOutlinedIcon },
  { href: "/favorites", label: "Favoritos", icon: FavoriteBorderIcon },
  { href: "/alerts", label: "Alertas", icon: NotificationsOutlinedIcon },
  { href: "/history", label: "Histórico", icon: HistoryOutlinedIcon },
];

const settingsNavItems: NavItem[] = [
  { href: "/ai-training", label: "Treinamento IA", icon: PsychologyOutlinedIcon },
  { href: "/admin", label: "Admin", icon: AdminPanelSettingsOutlinedIcon },
];

const navGroups: { title: string; items: NavItem[] }[] = [
  { title: "Ferramentas", items: toolsNavItems },
  { title: "Configurações", items: settingsNavItems },
];

export function Sidebar() {
  const pathname = usePathname();
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();

  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const storedValue = window.localStorage.getItem("sidebar-collapsed");

    if (storedValue === null) {
      return;
    }

    setCollapsed(storedValue === "true");
  }, []);

  const isExpanded = !collapsed;

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("sidebar-collapsed", String(next));
  };

  const drawerWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <Drawer
      variant="permanent"
      aria-label="Navegação principal"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: "nowrap",
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: zIndexScale.sidebar,
          borderRight: "1px solid",
          borderColor: "grey.200",
          bgcolor: "background.paper",
          boxShadow: "none",
          overflowX: "hidden",
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: collapsed
              ? theme.transitions.duration.leavingScreen
              : theme.transitions.duration.enteringScreen,
          }),
        },
        transition: theme.transitions.create("width", {
          easing: theme.transitions.easing.sharp,
          duration: collapsed
            ? theme.transitions.duration.leavingScreen
            : theme.transitions.duration.enteringScreen,
        }),
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: isExpanded ? "flex-start" : "center",
            gap: 1,
            overflow: "hidden",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <TrackChangesIcon sx={{ color: "primary.main", fontSize: 22, flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "primary.main",
                whiteSpace: "nowrap",
              }}
            >
              Radar de Licitações
            </Typography>
          )}
        </Box>

        {/* Nav items por categoria */}
        <Box
          component="nav"
          aria-label="Menu principal"
          sx={{
            flex: 1,
            px: 1,
            py: 0.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
            overflowY: "auto",
            "& .MuiListItemButton-root": { flexShrink: 0 },
          }}
        >
          {navGroups.map((group, groupIndex) => (
            <Box key={group.title} sx={{ width: "100%" }}>
              {isExpanded ? (
                <Typography
                  component="p"
                  variant="caption"
                  sx={{
                    py: 1,
                    px: 1.5,
                    color: "text.secondary",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    m: 0,
                  }}
                >
                  {group.title}
                </Typography>
              ) : groupIndex > 0 ? (
                <Divider sx={{ my: 0.75, mx: 0.5 }} />
              ) : null}
              <List dense disablePadding sx={{ py: 0 }}>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const selected =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <Tooltip
                      key={href}
                      title={label}
                      placement="right"
                      disableHoverListener={isExpanded}
                      disableFocusListener={isExpanded}
                      disableTouchListener={isExpanded}
                    >
                      <ListItemButton
                        component={Link}
                        href={href}
                        selected={selected}
                        aria-current={selected ? "page" : undefined}
                        sx={{
                          borderRadius: 1.5,
                          py: 1,
                          minHeight: 44,
                          maxHeight: 44,
                          px: isExpanded ? 1.5 : 0,
                          justifyContent: isExpanded ? "flex-start" : "center",
                          transition:
                            "background-color 0.15s ease, border-color 0.15s ease",
                          borderLeft: "3px solid transparent",
                          "&:hover": { bgcolor: "action.hover" },
                          "&.Mui-selected": {
                            bgcolor: "rgba(15, 118, 110, 0.08)",
                            borderLeftColor: "primary.main",
                            "&:hover": { bgcolor: "rgba(15, 118, 110, 0.12)" },
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: isExpanded ? 36 : "auto",
                            justifyContent: "center",
                          }}
                        >
                          <Icon sx={{ fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={label}
                          primaryTypographyProps={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                          }}
                          sx={{
                            opacity: isExpanded ? 1 : 0,
                            transition: theme.transitions.create("opacity", {
                              duration: theme.transitions.duration.shorter,
                            }),
                            overflow: "hidden",
                            m: 0,
                          }}
                        />
                      </ListItemButton>
                    </Tooltip>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>

        {/* Rodapé: tema e recolher sidebar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: isExpanded ? "space-between" : "center",
            flexDirection: isExpanded ? "row" : "column",
            gap: 0.5,
            p: 1,
            borderTop: "1px solid",
            borderColor: "grey.200",
          }}
        >
          <Tooltip
            title={mode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            placement="right"
            disableHoverListener={isExpanded}
          >
            <IconButton
              size="small"
              onClick={toggleMode}
              color="inherit"
              aria-label={mode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              sx={{ color: "text.secondary" }}
            >
              {mode === "dark" ? (
                <LightModeOutlined fontSize="small" />
              ) : (
                <DarkModeOutlined fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleToggle} aria-label={isExpanded ? "Recolher menu" : "Expandir menu"}>
            {collapsed ? (
              <ChevronRightIcon fontSize="small" />
            ) : (
              <ChevronLeftIcon fontSize="small" />
            )}
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
}

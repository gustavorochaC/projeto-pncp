"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";

interface AnalyzerSectionCardProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  onRegenerate?: () => void;
  children: React.ReactNode;
}

export function AnalyzerSectionCard({
  title,
  icon,
  loading,
  onRegenerate,
  children,
}: AnalyzerSectionCardProps) {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardHeader
        avatar={icon}
        title={title}
        titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
        action={
          onRegenerate ? (
            <Tooltip title="Regenerar">
              <span>
                <IconButton size="small" onClick={onRegenerate} disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : null
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        {loading ? (
          <>
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="85%" />
            <Skeleton variant="text" width="70%" />
          </>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

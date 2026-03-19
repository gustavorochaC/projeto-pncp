"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { usePathname, useSearchParams } from "next/navigation";
import type { NoticeListItem } from "@pncp/types";
import {
  buildNoticeDetailHref,
  buildReturnTo,
} from "@/lib/notice-navigation";
import { NoticeStatusBadge } from "./notice-status-badge";

function fmtDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function MetaRow({ items }: { items: [string, string][] }) {
  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {items.map(([label, value]) => (
        <Typography key={label} variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
            {label}:{" "}
          </Box>
          {value}
        </Typography>
      ))}
    </Box>
  );
}

function NoticeCard({
  notice,
  href,
  isHighlighted,
}: {
  notice: NoticeListItem;
  href: string;
  isHighlighted: boolean;
}) {
  const title = notice.noticeNumber
    ? `${notice.modality} n.\u00ba ${notice.noticeNumber}`
    : notice.modality;

  const location =
    notice.city && notice.state
      ? `${notice.city} - ${notice.state}`
      : notice.state ?? notice.city ?? "-";

  return (
    <Paper
      variant="outlined"
      data-notice-id={notice.id}
      sx={{
        p: 2.5,
        borderRadius: 2,
        borderColor: isHighlighted ? "primary.main" : "divider",
        boxShadow: isHighlighted ? 4 : 0,
        bgcolor: isHighlighted ? "rgba(25, 118, 210, 0.08)" : "background.paper",
        transition:
          "box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease",
        "&:hover": { boxShadow: 3 },
      }}
    >
      <Stack spacing={1}>
        {/* Line 1: title */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {title}
        </Typography>

        {/* Line 2: PNCP ID */}
        <Typography variant="caption" color="text.secondary">
          ID ATA PNCP:{" "}
          <Box component="span" sx={{ fontFamily: "monospace" }}>
            {notice.externalId}
          </Box>
        </Typography>

        {/* Line 3: Modalidade + Ultima atualizacao */}
        <MetaRow
          items={[
            ["Modalidade", notice.modality],
            ["\u00daltima atualiza\u00e7\u00e3o", fmtDate(notice.updatedAt)],
          ]}
        />

        {/* Line 4: Orgao + Local */}
        <MetaRow
          items={[
            ["\u00d3rg\u00e3o", notice.agency],
            ["Local", location],
          ]}
        />

        {/* Line 5: Objeto */}
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
          <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
            Objeto:{" "}
          </Box>
          {notice.object}
        </Typography>

        <Divider sx={{ my: 0.5 }} />

        {/* Footer */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <NoticeStatusBadge status={notice.status} />
          <Box sx={{ flex: 1 }} />
          <Button
            component={Link}
            href={href}
            variant="outlined"
            size="small"
            startIcon={<OpenInNewOutlinedIcon fontSize="small" aria-hidden />}
            aria-label={`Abrir detalhes do edital: ${title}`}
          >
            Abrir detalhes
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export function NoticeCardList({
  items,
  highlightedNoticeId,
}: {
  items: NoticeListItem[];
  highlightedNoticeId?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = buildReturnTo(pathname, searchParams);

  return (
    <Stack spacing={2}>
      {items.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          href={buildNoticeDetailHref(notice.id, returnTo)}
          isHighlighted={notice.id === highlightedNoticeId}
        />
      ))}
    </Stack>
  );
}

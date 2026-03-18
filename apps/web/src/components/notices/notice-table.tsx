import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import type { NoticeListItem } from "@pncp/types";
import { NoticeStatusBadge } from "./notice-status-badge";

const headers = ["Órgão", "Objeto", "Modalidade", "Publicação", "Abertura", "Valor", "Status", "Ações"];

export function NoticeTable({ items }: { items: NoticeListItem[] }) {
  return (
    <TableContainer component={Paper} sx={{ overflow: "hidden", borderRadius: 2 }}>
      <Table size="medium" stickyHeader>
        <TableHead>
          <TableRow>
            {headers.map((label) => (
              <TableCell
                key={label}
                component="th"
                scope="col"
                sx={{
                  fontWeight: 600,
                  bgcolor: "grey.100",
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: "0.75rem",
                  py: 1.5,
                  px: 2,
                }}
              >
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((notice) => (
            <TableRow
              key={notice.id}
              hover
              sx={{
                transition: "background-color 0.15s ease",
                "&:nth-of-type(even)": { bgcolor: "rgba(0,0,0,0.02)" },
              }}
            >
              <TableCell sx={{ fontWeight: 500, py: 1.5, px: 2 }}>{notice.agency}</TableCell>
              <TableCell sx={{ maxWidth: 360, py: 1.5, px: 2 }}>{notice.object}</TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>{notice.modality}</TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>{notice.publishedAt?.slice(0, 10) ?? "-"}</TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>{notice.openingAt?.slice(0, 10) ?? "-"}</TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>
                {notice.estimatedValue
                  ? notice.estimatedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "-"}
              </TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>
                <NoticeStatusBadge status={notice.status} />
              </TableCell>
              <TableCell sx={{ py: 1.5, px: 2 }}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    component={Link}
                    href={`/notices/${notice.id}`}
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewOutlinedIcon fontSize="small" aria-hidden />}
                    aria-label={`Abrir detalhes: ${notice.modality} ${notice.noticeNumber ?? ""} ${notice.agency}`.trim()}
                  >
                    Abrir detalhes
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="info"
                    startIcon={<SmartToyOutlinedIcon fontSize="small" aria-hidden />}
                    aria-label="Perguntar à IA sobre este edital"
                  >
                    Perguntar à IA
                  </Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

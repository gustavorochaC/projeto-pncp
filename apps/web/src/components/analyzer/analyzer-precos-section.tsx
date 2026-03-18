"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import AttachMoneyOutlinedIcon from "@mui/icons-material/AttachMoneyOutlined";
import type { AnalyzerSectionResult, NoticeItem } from "@pncp/types";
import { AnalyzerSectionCard } from "./analyzer-section-card";

interface Props {
  result: AnalyzerSectionResult | null;
  loading: boolean;
  onRegenerate: () => void;
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AnalyzerPrecosSection({ result, loading, onRegenerate }: Props) {
  const itens = (result?.metadata?.itens ?? []) as NoticeItem[];

  return (
    <AnalyzerSectionCard
      title="Preços e Itens"
      icon={<AttachMoneyOutlinedIcon color="success" />}
      loading={loading}
      onRegenerate={onRegenerate}
    >
      {result ? (
        <Box>
          {itens.length > 0 && (
            <>
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell>Descrição</TableCell>
                      <TableCell align="right">Qtd</TableCell>
                      <TableCell align="right">Vl. Unit.</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.numeroItem}>
                        <TableCell>{item.numeroItem}</TableCell>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell align="right">
                          {item.quantidade ?? "-"} {item.unidadeMedida ?? ""}
                        </TableCell>
                        <TableCell align="right">{formatBRL(item.valorUnitarioEstimado)}</TableCell>
                        <TableCell align="right">{formatBRL(item.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Divider sx={{ mb: 1 }} />
            </>
          )}
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {result.content}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Clique em regenerar para analisar os preços e itens.
        </Typography>
      )}
    </AnalyzerSectionCard>
  );
}

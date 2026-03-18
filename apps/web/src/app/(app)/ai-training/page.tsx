"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import {
  useTrainingRules,
  useCreateTrainingRule,
  useUpdateTrainingRule,
  useDeleteTrainingRule,
} from "@/hooks/use-training-rules";
import type { AITrainingRuleItem } from "@pncp/types";

interface RuleDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: AITrainingRuleItem;
}

function RuleDialog({ open, onClose, initial }: RuleDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const createRule = useCreateTrainingRule();
  const updateRule = useUpdateTrainingRule();

  const isEditing = Boolean(initial);
  const isPending = createRule.isPending || updateRule.isPending;

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;
    if (isEditing && initial) {
      updateRule.mutate(
        { id: initial.id, payload: { name: name.trim(), content: content.trim() } },
        { onSuccess: onClose },
      );
    } else {
      createRule.mutate(
        { name: name.trim(), content: content.trim() },
        { onSuccess: onClose },
      );
    }
  };

  const handleClose = () => {
    if (!isPending) onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? "Editar instrução" : "Nova instrução"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder="Ex.: Foco em prazos e datas"
            disabled={isPending}
          />
          <TextField
            label="Instrução"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            multiline
            rows={4}
            placeholder="Ex.: Sempre destaque os prazos mais importantes e alertas sobre vencimentos próximos."
            disabled={isPending}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!name.trim() || !content.trim() || isPending}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AITrainingPage() {
  const { data: rules, isLoading } = useTrainingRules();
  const updateRule = useUpdateTrainingRule();
  const deleteRule = useDeleteTrainingRule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AITrainingRuleItem | undefined>(undefined);

  const handleOpenCreate = () => {
    setEditingRule(undefined);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: AITrainingRuleItem) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Remover esta instrução?")) {
      deleteRule.mutate(id);
    }
  };

  const handleToggle = (rule: AITrainingRuleItem) => {
    updateRule.mutate({ id: rule.id, payload: { isActive: !rule.isActive } });
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Treinamento de IA
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Crie instruções personalizadas para todas as consultas à IA
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={handleOpenCreate}
          sx={{ flexShrink: 0 }}
        >
          Nova regra
        </Button>
      </Stack>

      {isLoading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : !rules || rules.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
        >
          <PsychologyOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
          <Typography variant="body1" color="text.secondary" align="center">
            Nenhuma instrução criada ainda.
            <br />
            Crie sua primeira instrução para personalizar as respostas da IA.
          </Typography>
          <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={handleOpenCreate}>
            Criar instrução
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rules.map((rule) => (
            <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="flex-start" gap={1.5}>
                <Switch
                  checked={rule.isActive}
                  onChange={() => handleToggle(rule)}
                  size="small"
                  sx={{ mt: 0.5, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600}>
                      {rule.name}
                    </Typography>
                    {!rule.isActive && (
                      <Chip label="Inativa" size="small" variant="outlined" color="default" />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      mt: 0.25,
                    }}
                  >
                    {rule.content}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.5} flexShrink={0}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleOpenEdit(rule)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleteRule.isPending}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="caption" color="text.secondary">
        As instruções ativas são enviadas para a IA em todas as consultas sobre editais.
        Use-as para personalizar o estilo, foco ou formato das respostas.
      </Typography>

      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editingRule}
      />
    </Box>
  );
}

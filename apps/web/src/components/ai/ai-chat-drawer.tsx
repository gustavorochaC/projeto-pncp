"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import CloseIcon from "@mui/icons-material/Close";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { AIMessageBubble } from "./ai-message-bubble";
import {
  useAIStatus,
  useAskAI,
  useConversationMessages,
  useConversations,
  useProcessDocuments,
  useProcessingStatus,
} from "@/hooks/use-ai-chat";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { AIMessageItem, AskAIRequest, AskAIResponse, DocumentProcessingStatus } from "@pncp/types";

const PARTICIPATION_REQUIREMENTS_QUESTION =
  "Extrair requisitos de participacao e habilitacao deste edital.";

interface Props {
  open: boolean;
  onClose: () => void;
  noticeId: string;
}

type DraftSubmission = {
  id: string;
  question: string;
  conversationId: string | null;
  mode?: AskAIRequest["mode"];
  status: "loading" | "done" | "error";
  response?: AskAIResponse;
  errorMessage?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Nao foi possivel responder agora. Tente novamente.";
}

function buildDraftMessages(draft: DraftSubmission): AIMessageItem[] {
  const createdAt = new Date().toISOString();

  const userMessage: AIMessageItem = {
    id: `${draft.id}-user`,
    role: "user",
    content: draft.question,
    citations: [],
    createdAt,
  };

  if (draft.status === "loading") {
    return [
      userMessage,
      {
        id: `${draft.id}-assistant-loading`,
        role: "assistant",
        content: "Analisando o edital...",
        citations: [],
        confidence: "low",
        createdAt,
      },
    ];
  }

  if (draft.status === "error") {
    return [userMessage];
  }

  return [
    userMessage,
      {
        id: `${draft.id}-assistant-done`,
        role: "assistant",
        content: draft.response?.answer ?? "Nao consegui gerar uma resposta no momento.",
        citations: draft.response?.citations ?? [],
        confidence: draft.response?.confidence ?? "low",
        structuredData: draft.response?.structuredData,
        createdAt,
      },
    ];
}

function draftAlreadyRendered(messages: AIMessageItem[], draft: DraftSubmission): boolean {
  if (draft.status !== "done" || !draft.response) {
    return false;
  }

  const hasUserMessage = messages.some((message) => {
    return message.role === "user" && message.content === draft.question;
  });

  const hasAssistantMessage = messages.some((message) => {
    return message.role === "assistant" && message.content === draft.response?.answer;
  });

  return hasUserMessage && hasAssistantMessage;
}

function ProcessingStagesCard({
  status,
  isPending,
  isError,
  errorMessage,
  onRetry,
}: {
  status: DocumentProcessingStatus["status"] | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
}) {
  const shouldRender = isPending || isError || status === "idle" || status === "processing" || status === "error";

  if (!shouldRender) {
    return null;
  }

  const stageIndex =
    isError || status === "error" ? 0 : isPending || status === "idle" ? 1 : status === "processing" ? 2 : 3;

  const stepValue = stageIndex === 0 ? 0 : stageIndex === 1 ? 33 : stageIndex === 2 ? 66 : 100;

  const steps = [
    { label: "Preparando", description: "Buscando os arquivos do edital" },
    { label: "Extraindo", description: "Lendo o conteudo dos documentos" },
    { label: "Indexando", description: "Organizando o contexto do RAG" },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        mx: 2,
        mt: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: "grey.50",
      }}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Enriquecimento documental
          </Typography>
          <Typography variant="caption" color="text.secondary">
            A IA continua respondendo com os dados que ja tem, enquanto o edital e processado em segundo plano.
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={stepValue}
          sx={{ height: 8, borderRadius: 999, bgcolor: "grey.200" }}
        />

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {steps.map((step, index) => {
            const isComplete = stageIndex > index + 1;
            const isActive = stageIndex === index + 1;

            return (
              <Chip
                key={step.label}
                size="small"
                label={`${index + 1}. ${step.label}`}
                color={isActive ? "primary" : isComplete ? "success" : "default"}
                variant={isActive || isComplete ? "filled" : "outlined"}
                sx={{ fontWeight: 600 }}
              />
            );
          })}
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {isError || status === "error"
            ? "Nao foi possivel enriquecer os documentos automaticamente."
            : isPending
              ? "Processando os documentos agora."
              : status === "processing"
                ? "Os documentos estao sendo indexados."
                : "O processamento sera iniciado automaticamente apos a primeira resposta da IA."}
        </Typography>

        {(isError || status === "error") && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button size="small" color="inherit" onClick={onRetry}>
                Tentar novamente
              </Button>
            }
          >
            {errorMessage ?? "Nao conseguimos processar os documentos agora."}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export function AIChatDrawer({ open, onClose, noticeId }: Props) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [draftSubmission, setDraftSubmission] = useState<DraftSubmission | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoProcessTriggeredRef = useRef<string | null>(null);
  const activeSubmissionIdRef = useRef<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createSupabaseClient> | null>(null);
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  if (!supabaseRef.current) {
    supabaseRef.current = createSupabaseClient();
  }

  const aiStatusQuery = useAIStatus();
  const conversationsQuery = useConversations(noticeId);
  const messagesQuery = useConversationMessages(activeConversationId);
  const processingStatusQuery = useProcessingStatus(noticeId);
  const askAI = useAskAI(noticeId);
  const processDocuments = useProcessDocuments(noticeId);

  const conversations = conversationsQuery.data;
  const messages = messagesQuery.data ?? [];
  const processingStatus = processingStatusQuery.data;
  const processingAttempt = processDocuments.data;
  const hasProcessingAttempt =
    processDocuments.isPending || processDocuments.isError || Boolean(processingAttempt);
  const effectiveProcessingStatus = processDocuments.isPending
    ? "processing"
    : processingAttempt?.status ?? processingStatus?.status;
  const effectiveProcessingError =
    processDocuments.error instanceof Error
      ? processDocuments.error.message
      : processingAttempt?.message ?? processingStatus?.message;
  const processingAttemptFailed =
    processDocuments.isError ||
    (hasProcessingAttempt &&
      effectiveProcessingStatus !== undefined &&
      effectiveProcessingStatus !== "done" &&
      effectiveProcessingStatus !== "processing");

  useEffect(() => {
    if (!open) {
      setInputText("");
      setDraftSubmission(null);
      setQuickActionError(null);
      activeSubmissionIdRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    autoProcessTriggeredRef.current = null;
    setDraftSubmission(null);
    setInputText("");
    setQuickActionError(null);
    setActiveConversationId(null);
    activeSubmissionIdRef.current = null;
  }, [noticeId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseRef.current;

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled || error) {
        return;
      }

      setChatUserId(data.user?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [draftSubmission, messages]);

  const queryError = conversationsQuery.error ?? messagesQuery.error ?? aiStatusQuery.error ?? processingStatusQuery.error;

  const displayedMessages = useMemo(() => {
    if (!draftSubmission) {
      return messages;
    }

    if (draftAlreadyRendered(messages, draftSubmission)) {
      return messages;
    }

    return [...messages, ...buildDraftMessages(draftSubmission)];
  }, [draftSubmission, messages]);

  const handleRefreshQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["aiStatus"] });
    void queryClient.invalidateQueries({ queryKey: ["conversations", noticeId] });
    void queryClient.invalidateQueries({ queryKey: ["messages"] });
    void queryClient.invalidateQueries({ queryKey: ["processingStatus", noticeId] });
  };

  const startBackgroundProcessing = () => {
    if (autoProcessTriggeredRef.current === noticeId) {
      return;
    }

    if (processDocuments.isPending) {
      return;
    }

    if (!processingStatus || processingStatus.status === "done" || processingStatus.status === "processing") {
      return;
    }

    autoProcessTriggeredRef.current = noticeId;
    processDocuments.mutate(undefined, {
      onSuccess: (status) => {
        if (status.status !== "done") {
          autoProcessTriggeredRef.current = null;
        }
      },
      onError: () => {
        autoProcessTriggeredRef.current = null;
      },
    });
  };

  const submitQuestion = (rawQuestion: string, options?: { mode?: AskAIRequest["mode"] }) => {
    const question = rawQuestion.trim();
    if (!question || askAI.isPending) {
      return;
    }

    setQuickActionError(null);
    const draftId = crypto.randomUUID();
    activeSubmissionIdRef.current = draftId;
    setInputText("");
    setDraftSubmission({
      id: draftId,
      question,
      conversationId: activeConversationId,
      mode: options?.mode,
      status: "loading",
    });

    askAI.mutate(
      {
        question,
        conversationId: activeConversationId ?? undefined,
        userId: chatUserId ?? undefined,
        mode: options?.mode,
      },
      {
        onSuccess: (data) => {
          if (activeSubmissionIdRef.current !== draftId) {
            return;
          }

          startTransition(() => {
            setActiveConversationId(data.conversationId);
          });

          setDraftSubmission({
            id: draftId,
            question,
            conversationId: data.conversationId,
            mode: options?.mode,
            status: "done",
            response: data,
          });
          startBackgroundProcessing();
        },
        onError: (error) => {
          if (activeSubmissionIdRef.current !== draftId) {
            return;
          }

          if (options?.mode !== "participation_requirements") {
            setInputText(question);
          }
          setDraftSubmission({
            id: draftId,
            question,
            conversationId: activeConversationId,
            mode: options?.mode,
            status: "error",
            errorMessage: getErrorMessage(error),
          });
        },
      },
    );
  };

  const handleSend = () => {
    submitQuestion(inputText);
  };

  const handleExtractRequirements = async () => {
    if (askAI.isPending || processDocuments.isPending) {
      return;
    }

    setQuickActionError(null);

    try {
      if (processingStatus?.status !== "done") {
        const status = await processDocuments.mutateAsync();
        if (status.status !== "done") {
          setQuickActionError(
            status.message ??
              "Os documentos ainda nao ficaram prontos para extrair os requisitos de participacao.",
          );
          return;
        }

        autoProcessTriggeredRef.current = noticeId;
      }

      submitQuestion(PARTICIPATION_REQUIREMENTS_QUESTION, {
        mode: "participation_requirements",
      });
    } catch (error) {
      setQuickActionError(getErrorMessage(error));
    }
  };

  const handleRetry = () => {
    if (!draftSubmission) {
      return;
    }

    submitQuestion(draftSubmission.question, { mode: draftSubmission.mode });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleConversationChange = (nextConversationId: string | null) => {
    setDraftSubmission(null);
    activeSubmissionIdRef.current = null;
    startTransition(() => {
      setActiveConversationId(nextConversationId);
    });
  };

  const handleNewConversation = () => {
    setDraftSubmission(null);
    setInputText("");
    activeSubmissionIdRef.current = null;
    startTransition(() => {
      setActiveConversationId(null);
    });
  };

  const showQueryError = Boolean(queryError);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      sx={{ "& .MuiDrawer-paper": { width: 420, display: "flex", flexDirection: "column" } }}
    >
      <Toolbar
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          gap: 1,
          minHeight: "56px !important",
          px: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
          Assistente IA
        </Typography>
        {aiStatusQuery.data && (
          <Chip
            size="small"
            label={aiStatusQuery.data.status === "online" ? aiStatusQuery.data.generationModel : "offline"}
            sx={{
              height: 20,
              fontSize: "0.65rem",
              bgcolor: aiStatusQuery.data.status === "online" ? "success.light" : "error.light",
              color: aiStatusQuery.data.status === "online" ? "success.dark" : "error.dark",
              fontWeight: 600,
              "& .MuiChip-label": { px: 1 },
            }}
          />
        )}
        <IconButton size="small" onClick={handleNewConversation} title="Nova conversa" aria-label="Nova conversa">
          <AddCommentOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onClose} aria-label="Fechar painel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {conversations && conversations.length > 0 && (
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Conversa</InputLabel>
            <Select
              value={activeConversationId ?? ""}
              label="Conversa"
              onChange={(event) => handleConversationChange(event.target.value ? String(event.target.value) : null)}
            >
              <MenuItem value="">
                <em>Nova conversa</em>
              </MenuItem>
              {conversations.map((conversation) => (
                <MenuItem key={conversation.id} value={conversation.id}>
                  {conversation.title ?? `Conversa de ${new Date(conversation.createdAt).toLocaleDateString("pt-BR")}`}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({conversation.messageCount} msgs)
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      <ProcessingStagesCard
        status={effectiveProcessingStatus}
        isPending={processDocuments.isPending}
        isError={processingAttemptFailed}
        errorMessage={effectiveProcessingError}
        onRetry={() => {
          autoProcessTriggeredRef.current = null;
          startBackgroundProcessing();
        }}
      />

      {showQueryError && (
        <Alert
          severity="error"
          sx={{ mx: 2, mt: 1.5, borderRadius: 1 }}
          action={
            <Button size="small" color="inherit" onClick={handleRefreshQueries}>
              Tentar novamente
            </Button>
          }
        >
          {getErrorMessage(queryError)}
        </Alert>
      )}

      {quickActionError && (
        <Alert
          severity="warning"
          sx={{ mx: 2, mt: 1.5, borderRadius: 1 }}
          action={
            <Button size="small" color="inherit" onClick={() => void handleExtractRequirements()}>
              Tentar novamente
            </Button>
          }
        >
          {quickActionError}
        </Alert>
      )}

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {displayedMessages.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", minHeight: 200 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Faça uma pergunta para comecar.
            </Typography>
          </Stack>
        ) : (
          displayedMessages.map((message) => {
            const isTransientPending =
              draftSubmission?.status === "loading" &&
              message.role === "assistant" &&
              message.id === `${draftSubmission.id}-assistant-loading`;

            return <AIMessageBubble key={message.id} message={message} pending={isTransientPending} />;
          })
        )}

        {draftSubmission?.status === "error" && (
          <Alert
            severity="error"
            variant="outlined"
            sx={{ mt: 0.5, borderRadius: 1 }}
            action={
              <Button size="small" color="inherit" onClick={handleRetry}>
                Tentar novamente
              </Button>
            }
          >
            {draftSubmission.errorMessage ?? "Nao conseguimos responder agora."}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      <Stack spacing={1} sx={{ p: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => void handleExtractRequirements()}
          disabled={askAI.isPending || processDocuments.isPending}
          startIcon={<FactCheckOutlinedIcon fontSize="small" />}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          {processDocuments.isPending ? "Preparando documentos..." : "Extrair requisitos"}
        </Button>

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          maxRows={3}
          size="small"
          placeholder="Pergunte sobre o edital..."
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={askAI.isPending}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!inputText.trim() || askAI.isPending}
          aria-label="Enviar"
          sx={{ flexShrink: 0, mb: 0.25 }}
        >
          <SendOutlinedIcon />
        </IconButton>
        </Stack>
      </Stack>
    </Drawer>
  );
}

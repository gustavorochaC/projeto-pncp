"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import SendIcon from "@mui/icons-material/Send";
import { useAskAI } from "@/hooks/use-ai-chat";

interface Props {
  noticeId: string;
}

export function AnalyzerChatSection({ noticeId }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const { mutate: askAI, isPending } = useAskAI(noticeId);

  const handleAsk = () => {
    if (!question.trim()) return;
    askAI(
      { question },
      {
        onSuccess: (data) => {
          setAnswer(data.answer);
        },
      },
    );
  };

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<ChatOutlinedIcon color="primary" />}
        title="Perguntar sobre esta licitação"
        titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ex.: Quais documentos são exigidos para habilitação?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            disabled={isPending}
          />
          <Button
            variant="contained"
            size="small"
            disabled={isPending || question.trim().length < 5}
            onClick={handleAsk}
            endIcon={isPending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
          >
            Perguntar
          </Button>
        </Box>
        {answer && (
          <Box
            sx={{
              bgcolor: "action.hover",
              borderRadius: 1,
              p: 2,
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {answer}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

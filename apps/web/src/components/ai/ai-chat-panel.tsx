"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input } from "@pncp/ui";
import { apiClient } from "@/lib/api-client";

export function AIChatPanel({ noticeId }: { noticeId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Assistente de edital</p>
        <h3 className="text-xl font-semibold text-slate-950">Pergunte à IA</h3>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Ex.: Quais documentos são exigidos?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button
          disabled={isPending || question.trim().length < 5}
          onClick={() =>
            startTransition(async () => {
              const response = await apiClient.askAI(noticeId, { question });
              setAnswer(response.answer);
            })
          }
        >
          {isPending ? "Analisando..." : "Perguntar"}
        </Button>
      </div>

      <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
        {answer || "Faça uma pergunta para gerar resumo, riscos, checklist ou interpretação."}
      </div>
    </Card>
  );
}

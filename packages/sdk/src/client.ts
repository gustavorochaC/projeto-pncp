import type {
  AIConversationSummary,
  AIMessageItem,
  AITrainingRuleItem,
  AnalyzerReportResponse,
  AnalyzerSectionName,
  AnalyzerSectionResult,
  AskAIRequest,
  AskAIResponse,
  CreateTrainingRulePayload,
  DocumentProcessingStatus,
  GenerateSectionRequest,
  NoticeArchive,
  NoticeDetail,
  NoticeItem,
  NoticeListItem,
  NoticeSearchFilters,
  PaginatedResponse,
  UpdateTrainingRulePayload,
} from "@pncp/types";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async getNotices(
    filters: NoticeSearchFilters,
  ): Promise<PaginatedResponse<NoticeListItem>> {
    const search = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      search.set(key, String(value));
    });

    const response = await fetch(`${this.baseUrl}/notices?${search.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch notices");
    }

    return response.json();
  }

  async getNotice(id: string): Promise<NoticeDetail> {
    const response = await fetch(`${this.baseUrl}/notices/${id}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch notice");
    }

    return response.json();
  }

  async askAI(id: string, payload: AskAIRequest): Promise<AskAIResponse> {
    const response = await fetch(`${this.baseUrl}/notices/${id}/ask-ai`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel obter uma resposta da IA."));
    }

    return response.json();
  }

  async getNoticeItems(id: string): Promise<NoticeItem[]> {
    const response = await fetch(`${this.baseUrl}/notices/${id}/itens`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  async getNoticeArchives(id: string): Promise<NoticeArchive[]> {
    const response = await fetch(`${this.baseUrl}/notices/${id}/arquivos`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // AI Status
  async getAIStatus(): Promise<{
    status: "online" | "offline";
    generationModel: string;
    embeddingModel: string;
    hasGenerationModel?: boolean;
    hasEmbeddingModel?: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/ai/status`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return { status: "offline", generationModel: "", embeddingModel: "" };
      return response.json();
    } catch {
      return { status: "offline", generationModel: "", embeddingModel: "" };
    }
  }

  // Conversations
  async getConversations(noticeId: string): Promise<AIConversationSummary[]> {
    const response = await fetch(
      `${this.baseUrl}/ai/conversations?noticeId=${encodeURIComponent(noticeId)}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel carregar as conversas da IA."));
    }
    return response.json();
  }

  async getConversationMessages(conversationId: string): Promise<AIMessageItem[]> {
    const response = await fetch(
      `${this.baseUrl}/ai/conversations/${conversationId}/messages`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel carregar as mensagens da conversa."));
    }
    return response.json();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/ai/conversations/${conversationId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }
  }

  // Training Rules
  async getTrainingRules(): Promise<AITrainingRuleItem[]> {
    const response = await fetch(
      `${this.baseUrl}/ai/training-rules`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch training rules");
    }
    return response.json();
  }

  async createTrainingRule(payload: CreateTrainingRulePayload): Promise<AITrainingRuleItem> {
    const response = await fetch(`${this.baseUrl}/ai/training-rules`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Failed to create training rule");
    }
    return response.json();
  }

  async updateTrainingRule(
    id: string,
    payload: UpdateTrainingRulePayload,
  ): Promise<AITrainingRuleItem> {
    const response = await fetch(`${this.baseUrl}/ai/training-rules/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Failed to update training rule");
    }
    return response.json();
  }

  async deleteTrainingRule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/ai/training-rules/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to delete training rule");
    }
  }

  // Document Processing
  async processDocuments(noticeId: string): Promise<DocumentProcessingStatus> {
    const response = await fetch(`${this.baseUrl}/notices/${noticeId}/process-documents`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel processar os documentos do edital."));
    }
    return response.json();
  }

  async getProcessingStatus(noticeId: string): Promise<DocumentProcessingStatus> {
    const response = await fetch(
      `${this.baseUrl}/notices/${noticeId}/processing-status`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel carregar o status dos documentos."));
    }
    return response.json();
  }

  // Analyzer
  async getAnalyzerReport(noticeId: string): Promise<AnalyzerReportResponse | null> {
    const response = await fetch(`${this.baseUrl}/analyzer/${noticeId}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.status === 404 || !response.ok) return null;
    return response.json();
  }

  async analyzeSection(
    noticeId: string,
    section: AnalyzerSectionName,
    body: GenerateSectionRequest,
  ): Promise<AnalyzerSectionResult> {
    const response = await fetch(`${this.baseUrl}/analyzer/${noticeId}/${section}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Nao foi possivel gerar a secao do analista."));
    }
    return response.json();
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join(", ");
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Ignore invalid error payloads and use the fallback below.
  }

  return fallback;
}

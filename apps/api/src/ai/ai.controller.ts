import { Body, Controller, Get, Post } from "@nestjs/common";

@Controller("api")
export class AIController {
  @Get("ai/status")
  async status() {
    const ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const generationModel = process.env.OLLAMA_GENERATION_MODEL ?? "qwen2.5:7b";
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL ?? "qwen3-embedding";

    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        return { status: "offline", generationModel, embeddingModel };
      }
      const data = await res.json() as { models: { name: string }[] };
      const available = data.models?.map((m) => m.name) ?? [];
      const hasGeneration = available.some((n) => n.startsWith(generationModel.split(":")[0]));
      const hasEmbedding = available.some((n) => n.startsWith(embeddingModel.split(":")[0]));
      return {
        status: "online",
        generationModel,
        embeddingModel,
        hasGenerationModel: hasGeneration,
        hasEmbeddingModel: hasEmbedding,
      };
    } catch {
      return { status: "offline", generationModel, embeddingModel };
    }
  }

  @Post("generate")
  async generate(@Body() body: Record<string, unknown>) {
    const response = await fetch(
      `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return response.json();
  }

  @Post("embed")
  async embed(@Body() body: Record<string, unknown>) {
    const response = await fetch(
      `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/embed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return response.json();
  }
}

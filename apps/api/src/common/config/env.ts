import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OLLAMA_BASE_URL: z.string().url(),
  OLLAMA_GENERATION_MODEL: z.string().default("qwen2.5:7b"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("qwen3-embedding"),
  PNCP_BASE_URL: z.string().url(),
  PNCP_SEARCH_URL: z.string().url().optional(),
  PNCP_ATTACHMENT_BASE_URL: z.string().url().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(env: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(env);
}

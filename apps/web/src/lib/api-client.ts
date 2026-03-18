import { ApiClient } from "@pncp/sdk";

export const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
);

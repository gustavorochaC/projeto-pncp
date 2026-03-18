import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../common/prisma.service";
import { AIConversationService } from "./ai-conversation.service";

const mockFindManyConversations = vi.fn();
const mockFindManyMessages = vi.fn();
const mockDeleteConversation = vi.fn();

const prisma = {
  aIConversation: {
    findMany: mockFindManyConversations,
    delete: mockDeleteConversation,
  },
  aIMessage: {
    findMany: mockFindManyMessages,
  },
} as unknown as PrismaService;

function buildService() {
  return new AIConversationService(prisma);
}

describe("AIConversationService", () => {
  it("rejeita noticeId invalido em getConversations", async () => {
    const service = buildService();

    await expect(service.getConversations("null")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita conversationId invalido em getMessages", async () => {
    const service = buildService();

    await expect(service.getMessages("null")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita conversationId invalido em deleteConversation", async () => {
    const service = buildService();

    await expect(service.deleteConversation("")).rejects.toBeInstanceOf(BadRequestException);
  });
});

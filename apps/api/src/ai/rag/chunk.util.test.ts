import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk.util";

describe("chunkText", () => {
  it("retorna array vazio para texto vazio", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("retorna um único chunk para texto pequeno", () => {
    const text = "Este é um edital de licitação pública.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].tokens).toBeGreaterThan(0);
  });

  it("tokens é aproximadamente length/4", () => {
    const text = "abcd".repeat(100); // 400 chars
    const chunks = chunkText(text);
    expect(chunks[0].tokens).toBe(Math.ceil(chunks[0].content.length / 4));
  });

  it("divide texto em múltiplos chunks quando excede chunkSize", () => {
    const paragraph = "A".repeat(300);
    const text = [paragraph, paragraph, paragraph, paragraph].join("\n\n"); // 4 parágrafos
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserva conteúdo — todo o texto está representado nos chunks", () => {
    const words = Array.from({ length: 200 }, (_, i) => `palavra${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, { chunkSize: 300, overlap: 50 });
    const joined = chunks.map((c) => c.content).join(" ");
    // Cada palavra original deve aparecer em pelo menos um chunk
    for (const word of words) {
      expect(joined).toContain(word);
    }
  });

  it("aplica overlap: o início do próximo chunk contém o final do chunk anterior", () => {
    const para1 = "P1 ".repeat(200).trim(); // ~600 chars
    const para2 = "P2 ".repeat(200).trim();
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkText(text, { chunkSize: 500, overlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // O segundo chunk deve conter parte do conteúdo do primeiro (overlap)
    const tail = chunks[0].content.slice(-100);
    expect(chunks[1].content).toContain(tail.trim().slice(0, 30));
  });

  it("divide parágrafo único maior que chunkSize por sentenças", () => {
    const sentences = Array.from(
      { length: 20 },
      (_, i) => `Esta é a sentença número ${i + 1} do documento.`
    );
    const text = sentences.join(" "); // sem quebras de parágrafo
    const chunks = chunkText(text, { chunkSize: 200, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(300)); // tolerância
  });

  it("nenhum chunk retornado é vazio", () => {
    const text = "Parágrafo 1.\n\n\n\nParágrafo 2.\n\n  \n\nParágrafo 3.";
    const chunks = chunkText(text);
    chunks.forEach((c) => expect(c.content.trim().length).toBeGreaterThan(0));
  });

  it("normaliza quebras de linha CRLF", () => {
    const text = "Linha 1.\r\n\r\nLinha 2.";
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c) => expect(c.content).not.toContain("\r"));
  });
});

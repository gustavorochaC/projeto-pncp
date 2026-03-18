export interface TextChunk {
  content: string;
  tokens: number;
}

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 250;

export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by paragraphs first
  const paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim().length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed;
    } else {
      if (currentChunk) {
        chunks.push({ content: currentChunk, tokens: Math.ceil(currentChunk.length / 4) });
        // Start new chunk with overlap
        const overlapText = currentChunk.length > overlap ? currentChunk.slice(-overlap) : currentChunk;
        currentChunk = overlapText + '\n\n' + trimmed;
      } else {
        // Single paragraph larger than chunkSize — split by sentences
        const sentences = splitBySentences(trimmed, chunkSize, overlap);
        chunks.push(...sentences);
        currentChunk = '';
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), tokens: Math.ceil(currentChunk.length / 4) });
  }

  return chunks.filter(c => c.content.trim().length > 0);
}

function splitBySentences(text: string, chunkSize: number, overlap: number): TextChunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: TextChunk[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length <= chunkSize) {
      current += sentence;
    } else {
      if (current) {
        chunks.push({ content: current.trim(), tokens: Math.ceil(current.length / 4) });
        current = current.length > overlap ? current.slice(-overlap) + sentence : sentence;
      } else {
        // Sentence itself is too long, split by characters
        const charChunks = splitByChars(sentence, chunkSize, overlap);
        chunks.push(...charChunks);
      }
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), tokens: Math.ceil(current.length / 4) });
  }

  return chunks;
}

function splitByChars(text: string, chunkSize: number, overlap: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();
    if (content) {
      chunks.push({ content, tokens: Math.ceil(content.length / 4) });
    }
    start += chunkSize - overlap;
  }

  return chunks;
}

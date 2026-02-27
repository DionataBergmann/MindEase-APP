import { env } from './env';
import type { ProcessContentResponse } from '@/types/process-content';

function getBaseUrl(): string {
  return env.apiBaseUrl;
}

export type ProcessContentBody = {
  text?: string;
  image?: string;
  images?: string[];
};

export async function processContent(
  body: ProcessContentBody
): Promise<ProcessContentResponse> {
  const base = getBaseUrl();
  if (!base) throw new Error('EXPO_PUBLIC_API_BASE_URL não configurada.');
  const res = await fetch(`${base}/api/process-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Erro ao processar com a IA.');
  }
  return data as ProcessContentResponse;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatBody = {
  messages: ChatMessage[];
  context?: string;
};

export async function chat(body: ChatBody): Promise<{ message: string }> {
  const base = getBaseUrl();
  if (!base) throw new Error('EXPO_PUBLIC_API_BASE_URL não configurada.');
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Erro ao enviar mensagem.');
  }
  return data as { message: string };
}

import { env } from "./env";
import type { ProcessContentResponse } from "@/types/process-content";

function getBaseUrl(): string {
  return env.apiBaseUrl;
}

export type ProcessContentBody = {
  text?: string;
  image?: string;
  images?: string[];
};

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Network request failed") return true;
  if (err instanceof Error && /network request failed|failed to fetch/i.test(err.message))
    return true;
  return false;
}

const NETWORK_HINT =
  " No celular/emulador use o IP do seu computador no .env (EXPO_PUBLIC_API_BASE_URL), por ex: http://192.168.1.10:3000 — não use localhost.";

export async function processContent(body: ProcessContentBody): Promise<ProcessContentResponse> {
  const base = getBaseUrl();
  if (!base) throw new Error("EXPO_PUBLIC_API_BASE_URL não configurada.");
  try {
    const res = await fetch(`${base}/api/process-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        res.ok
          ? "Resposta inválida da API (não é JSON)."
          : `Erro do servidor: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`
      );
    }
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? text?.slice(0, 200) ?? "Erro ao processar com a IA.");
    }
    return data as ProcessContentResponse;
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error("Falha de rede ao chamar a API." + NETWORK_HINT);
    }
    throw err;
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatBody = {
  messages: ChatMessage[];
  context?: string;
};

export async function chat(body: ChatBody): Promise<{ message: string }> {
  const base = getBaseUrl();
  if (!base) throw new Error("EXPO_PUBLIC_API_BASE_URL não configurada.");
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        res.ok
          ? "Resposta inválida da API (não é JSON)."
          : `Erro do servidor: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`
      );
    }
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? text?.slice(0, 200) ?? "Erro ao enviar mensagem.");
    }
    return data as { message: string };
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error("Falha de rede ao chamar a API." + NETWORK_HINT);
    }
    throw err;
  }
}

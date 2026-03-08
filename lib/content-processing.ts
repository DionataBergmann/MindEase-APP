import { processContent } from "./api";
import type { ProcessContentResponse } from "@/types/process-content";

export type ImageSource = { uri: string; base64?: string };

export type PdfSource = { uri: string; name: string };

export type ProcessSourcesOptions = {
  pdfSources: PdfSource[];
  imageSources: ImageSource[];
  mergeAllIntoOne: boolean;
  onStep?: (index: number) => void;
};

export async function isPdfExtractionAvailable(): Promise<boolean> {
  try {
    const { isAvailable } = await import("expo-pdf-text-extract");
    return isAvailable();
  } catch {
    return false;
  }
}

export async function extractTextFromPdf(uri: string): Promise<string> {
  const mod = await import("expo-pdf-text-extract");
  if (!mod.isAvailable()) {
    throw new Error(
      "Extração de PDF requer um build de desenvolvimento (não funciona no Expo Go). Rode: npx expo run:ios ou npx expo run:android."
    );
  }
  const text = await mod.extractText(uri);
  return text?.trim() ?? "";
}

function toDataUrl(base64: string, mime = "image/jpeg"): string {
  return `data:${mime};base64,${base64}`;
}

export async function processSources({
  pdfSources,
  imageSources,
  mergeAllIntoOne,
  onStep,
}: ProcessSourcesOptions): Promise<ProcessContentResponse[]> {
  const results: ProcessContentResponse[] = [];
  const pdfCount = pdfSources.length;
  const imageCount = imageSources.filter((s) => s.base64).length;
  const totalSources = pdfCount + imageCount;

  if (totalSources === 0) {
    throw new Error("Adicione PDFs e/ou fotos.");
  }

  const topicCount = mergeAllIntoOne ? 1 : totalSources;

  if (mergeAllIntoOne) {
    onStep?.(0);

    let mergedText = "";
    for (const pdf of pdfSources) {
      const text = await extractTextFromPdf(pdf.uri);
      if (text) mergedText += (mergedText ? "\n\n" : "") + text;
    }

    const compressedImages: string[] = [];
    for (const img of imageSources) {
      if (img.base64) compressedImages.push(toDataUrl(img.base64));
    }

    const body: { text?: string; images?: string[] } = {};
    if (mergedText) body.text = mergedText;
    if (compressedImages.length > 0) body.images = compressedImages;
    if (!body.text && !body.images?.length) {
      throw new Error("Não foi possível extrair conteúdo dos arquivos.");
    }

    const one = await processContent(body);
    results.push(one);
    return results;
  }

  for (let i = 0; i < pdfSources.length; i++) {
    onStep?.(i);
    const pdf = pdfSources[i];
    const text = await extractTextFromPdf(pdf.uri);
    if (!text) {
      throw new Error(
        `Não foi possível extrair texto de "${pdf.name}" (pode estar vazio ou ser imagem).`
      );
    }
    const res = await processContent({ text });
    results.push(res);
  }

  // Cada foto = 1 tópico
  const withBase64 = imageSources.filter((s) => s.base64);
  for (let i = 0; i < withBase64.length; i++) {
    onStep?.(pdfCount + i);
    const dataUrl = toDataUrl(withBase64[i].base64!);
    const res = await processContent({ images: [dataUrl] });
    results.push(res);
  }

  return results;
}

export function getTopicDisplayName(index: number, pdfCount: number, imageCount: number): string {
  if (index < pdfCount) return `PDF ${index + 1}`;
  if (imageCount > 1) return `Foto ${index - pdfCount + 1}`;
  return imageCount === 1 ? "Foto" : `Tópico ${index + 1}`;
}

export function getTopicDisplayNameWithPdfNames(
  index: number,
  pdfSources: PdfSource[],
  imageCount: number
): string {
  if (index < pdfSources.length) return pdfSources[index].name;
  if (imageCount > 1) return `Foto ${index - pdfSources.length + 1}`;
  return imageCount === 1 ? "Foto" : `Tópico ${index + 1}`;
}

export function getSingleTopicDisplayName(pdfCount: number, imageCount: number): string {
  if (pdfCount > 0) return "PDF + fotos";
  if (imageCount > 1) return `Fotos (${imageCount})`;
  return imageCount === 1 ? "Foto" : "Tópico";
}

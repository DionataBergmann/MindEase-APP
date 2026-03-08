
import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

function toDataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

export async function compressImageForApi(
  uri: string,
  fallbackBase64?: string
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (!result.base64) {
      throw new Error("Falha ao obter imagem comprimida.");
    }
    return toDataUrl(result.base64);
  } catch {
    if (fallbackBase64) {
      return toDataUrl(fallbackBase64);
    }
    throw new Error("Não foi possível comprimir a imagem. Tente outra foto.");
  }
}

export type ProcessContentResponse = {
  resumo: string;
  resumoBreve?: string;
  resumoMedio?: string;
  resumoCompleto?: string;
  cards: Array<{ titulo: string; conteudo: string }>;
};

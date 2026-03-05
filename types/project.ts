/**
 * Project and material types — aligned with mindease-web domain.
 */

export type ProjectCard = {
  titulo: string;
  conteudo: string;
  nextReviewAt?: string;
  intervalLevel?: number;
};

export type MaterialStatus = 'pending' | 'in_progress' | 'completed';

export type Material = {
  id: string;
  nomeArquivo?: string;
  resumo: string;
  resumoBreve?: string;
  resumoMedio?: string;
  resumoCompleto?: string;
  cards: ProjectCard[];
  status?: MaterialStatus;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  intervalLevel?: number;
  createdAt?: { seconds: number; nanoseconds: number };
};

export type Project = {
  id: string;
  userId: string;
  title: string;
  emoji: string;
  pdfCount: number;
  progress: number;
  lastAccess: string;
  tags?: string[];
  materiais?: Material[];
  resumo?: string;
  cards?: ProjectCard[];
  createdAt?: { seconds: number; nanoseconds: number };
};

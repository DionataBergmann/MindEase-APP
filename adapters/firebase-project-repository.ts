import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import type { Project, Material } from "@/domain/project";
import type { IProjectRepository } from "@/ports/project-repository";

/** Formata updatedAt do Firestore para texto (Hoje, Ontem, X dias atrás…). */
function formatLastAccess(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semana(s) atrás`;
  return `${Math.floor(diffDays / 30)} mês(es) atrás`;
}

/** Converte doc Firestore em entidade Project do domínio. */
function mapDocToProject(docId: string, data: Record<string, unknown>): Project {
  const materiais: Material[] = Array.isArray(data.materiais)
    ? (data.materiais as Material[])
    : data.resumo || ((data.cards as unknown[])?.length ?? 0) > 0
      ? [
          {
            id: "legacy",
            nomeArquivo: "PDF",
            resumo: (data.resumo as string) ?? "",
            cards: (data.cards as Project["cards"]) ?? [],
          },
        ]
      : [];
  return {
    id: docId,
    userId: (data.userId as string) ?? "",
    title: (data.title as string) ?? "Sem título",
    emoji: (data.emoji as string) ?? "📚",
    pdfCount: (data.pdfCount as number) ?? materiais.length,
    progress: (data.progress as number) ?? 0,
    lastAccess: formatLastAccess(data.updatedAt as Timestamp | undefined),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    resumo: data.resumo as string | undefined,
    cards: (data.cards as Project["cards"]) ?? [],
    materiais,
    createdAt: data.createdAt as Project["createdAt"],
  };
}

/** Adapter: lê/escreve projetos no Firestore. Implementa IProjectRepository. */
export class FirebaseProjectRepository implements IProjectRepository {
  constructor(private db: Firestore | null) {}

  /** Lista projetos do usuário (ordenados por updatedAt desc). */
  async getByUserId(userId: string): Promise<Project[]> {
    if (!this.db) return [];
    const q = query(
      collection(this.db, "projects"),
      where("userId", "==", userId),
      orderBy("updatedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToProject(d.id, d.data() as Record<string, unknown>));
  }

  /** Busca um projeto por id. */
  async getById(projectId: string): Promise<Project | null> {
    if (!this.db) return null;
    const snap = await getDoc(doc(this.db, "projects", projectId));
    if (!snap.exists()) return null;
    return mapDocToProject(snap.id, snap.data() as Record<string, unknown>);
  }

  /** Atualiza projeto no Firestore (campos editáveis). */
  async save(project: Project): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, "projects", project.id);
    await updateDoc(ref, {
      title: project.title,
      emoji: project.emoji,
      tags: project.tags,
      pdfCount: project.pdfCount,
      progress: project.progress,
      materiais: project.materiais,
      resumo: project.resumo,
      cards: project.cards,
      updatedAt: serverTimestamp(),
    });
  }

  /** Remove projeto do Firestore. */
  async delete(projectId: string): Promise<void> {
    if (!this.db) return;
    await deleteDoc(doc(this.db, "projects", projectId));
  }
}

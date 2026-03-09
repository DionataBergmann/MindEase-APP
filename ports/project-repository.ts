import type { Project } from "@/domain/project";

export interface IProjectRepository {
  getByUserId(userId: string): Promise<Project[]>;
  getById(projectId: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(projectId: string): Promise<void>;
}

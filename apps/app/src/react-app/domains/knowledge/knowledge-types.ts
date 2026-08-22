export type KnowledgeSourceType = "text" | "file";

export type KnowledgeItem = {
  id: string;
  title: string;
  description: string;
  content: string;
  sourceType: KnowledgeSourceType;
  createdAt: string;
  updatedAt: string;
};

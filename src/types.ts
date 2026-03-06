export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestedQuestions?: string[];
}

export interface KnowledgeCard {
  id: string;
  title: string;
  mainEntity?: string;
  coreConcept: string; // Keep for card view summary
  index: string[]; // New: 3-5 short sentences for card view
  fullMarkdown: string; // New: Detailed content
  mindmap: string; // New: Mermaid syntax
  details?: string[]; // Deprecated, keep for backward compatibility or map to index
  actionItems?: { id?: string; text: string; completed: boolean }[];
  tags: string[];
  category: string;
  createdAt: number;
  mergedCount?: number;
  chatHistory?: ChatMessage[];
  images?: string[];
  sourceUrl?: string;
  sourceCards?: KnowledgeCard[];
  originalSourceCards?: KnowledgeCard[]; // New: Deep copy of original source cards for restoration
  isStarred?: boolean;
  contentType?: string; // New: Content Lens type (e.g., 'Interview', 'Tutorial')
  x?: number; // Whiteboard X position
  y?: number; // Whiteboard Y position
  pdfFileId?: string; // ID of the PDF file stored in IndexedDB
  sourceType?: 'text' | 'pdf' | 'url';
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export type SynthesisStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FileNode {
  name: string;
  type: "file" | "directory";
  content?: string;
  children?: FileNode[];
  path: string;
}

export interface WorkbenchState {
  files: FileNode[];
  currentFile: string | null;
  modifiedFiles: Set<string>;
  isOpen: boolean;
  activeTab: "preview" | "code" | "terminal";
}

export interface Step {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  type: "file" | "command" | "thought";
  content?: string;
  path?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
  timestamp: number;
}

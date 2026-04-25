/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from "react";
import { WebContainerProvider, useWebContainer } from "./contexts/WebContainerContext";
import { ChatInterface } from "./components/ChatInterface";
import { Workbench, WorkbenchRef } from "./components/Workbench";
import { Message, FileNode, Step } from "./types";
import { chatStream } from "./services/geminiService";
import { Loader2, Terminal as TerminalIcon, Code, Search } from "lucide-react";
import { cn } from "./lib/utils";

function Root() {
  const { instance, status, error: containerError } = useWebContainer();
  const workbenchRef = React.useRef<WorkbenchRef>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am Nexus, your expert App builder. Tell me what you want to build and I'll generate the full React codebase and run it for you.",
      timestamp: Date.now()
    }
  ]);
  const [files, setFiles] = useState<FileNode[]>([
    {
      name: "src",
      type: "directory",
      path: "/src",
      children: [
        { name: "App.tsx", type: "file", path: "/src/App.tsx", content: "export default function App() {\n  return <div>Hello Nexus!</div>;\n}" },
        { name: "index.css", type: "file", path: "/src/index.css", content: "@import \"tailwindcss\";" }
      ]
    },
    { name: "package.json", type: "file", path: "/package.json", content: "{\n  \"name\": \"nexus-app\",\n  \"type\": \"module\",\n  \"dependencies\": {\n    \"react\": \"^19.0.0\",\n    \"react-dom\": \"^19.0.0\",\n    \"lucide-react\": \"latest\",\n    \"motion\": \"latest\"\n  },\n  \"devDependencies\": {\n    \"vite\": \"latest\",\n    \"@vitejs/plugin-react\": \"latest\"\n  },\n  \"scripts\": {\n    \"dev\": \"vite --port 3000 --host 0.0.0.0\"\n  }\n}" },
    { name: "index.html", type: "file", path: "/index.html", content: "<!DOCTYPE html><html><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>" },
    { name: "main.tsx", type: "file", path: "/src/main.tsx", content: "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);" }
  ]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Apply files to WebContainer when they change
  useEffect(() => {
    if (!instance || status !== "ready") return;

    const mountFiles = async () => {
      const tree: any = {};
      
      const buildTree = (nodes: FileNode[], target: any) => {
        nodes.forEach(node => {
          if (node.type === "file") {
            target[node.name] = { file: { contents: node.content || "" } };
          } else {
            target[node.name] = { directory: {} };
            buildTree(node.children || [], target[node.name].directory);
          }
        });
      };

      buildTree(files, tree);
      await instance.mount(tree);
      
      // Auto-run install if package.json exists and we haven't run it yet
      // This is a simplified logic
    };

    mountFiles();
  }, [files, instance, status]);

  const handleSendMessage = async (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const assistantId = (Date.now() + 1).toString();
      let assistantContent = "";

      setMessages(prev => [...prev, {
        id: assistantId,
        role: "assistant",
        content: "",
        steps: [],
        timestamp: Date.now()
      }]);

      const stream = await chatStream(content, messages.concat(userMsg));
      
      for await (const chunk of stream) {
        const text = chunk.text || "";
        assistantContent += text;

        const steps: Step[] = [];
        
        // Match <file path="...">...</file>
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let match;
        while ((match = fileRegex.exec(assistantContent)) !== null) {
          const path = match[1];
          const code = match[2];
          const fileName = path.split("/").pop();
          
          // Check if this file already exists to decide between "Creating" or "Updating"
          const isExisting = (nodes: FileNode[], pathParts: string[]): boolean => {
            const name = pathParts[0];
            const node = nodes.find(n => n.name === name);
            if (!node) return false;
            if (pathParts.length === 1) return true;
            return isExisting(node.children || [], pathParts.slice(1));
          };
          const existingFile = isExisting(files, path.replace(/^\//, "").split("/"));

          steps.push({
            id: `file-${path}`,
            title: `${existingFile ? "Updating" : "Creating"} ${fileName}`,
            status: "completed",
            type: "file",
            path,
            content: code
          });
        }

        // Match <delete path="..." />
        const deleteRegex = /<delete path="([^"]+)"\s*\/>/g;
        while ((match = deleteRegex.exec(assistantContent)) !== null) {
          const path = match[1];
          steps.push({
            id: `delete-${path}`,
            title: `Removing ${path.split("/").pop()}`,
            status: "completed",
            type: "file",
            path,
            content: ""
          });
        }
        const cmdRegex = /<command>([\s\S]*?)<\/command>/g;
        while ((match = cmdRegex.exec(assistantContent)) !== null) {
          const cmd = match[1].trim();
          steps.push({
            id: `cmd-${cmd}-${Date.now()}`,
            title: `Executing: ${cmd}`,
            status: "completed",
            type: "command",
            content: cmd
          });
        }

        // Match <thought>...</thought>
        const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/g;
        let thoughtMatch = thoughtRegex.exec(assistantContent);
        const thoughts = thoughtMatch ? thoughtMatch[1].trim() : "";

        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { 
            ...m, 
            content: assistantContent
              .replace(/<thought>[\s\S]*?<\/thought>/g, "")
              .replace(/<file path="[^"]+">[\s\S]*?<\/file>/g, "")
              .replace(/<delete path="[^"]+"\s*\/>/g, "")
              .replace(/<command>[\s\S]*?<\/command>/g, "")
              // Strip any partially open tags and everything after them
              .replace(/<(thought|file|command|delete)[\s\S]*$/g, "")
              .trim(), 
            steps,
            metadata: { ...m.metadata, thoughts }
          } : m
        ));
      }

      // Final Sync - Handle Deletes first
      let finalFiles = [...files];
      const deleteRegex = /<delete path="([^"]+)"\s*\/>/g;
      let dMatch;
      while ((dMatch = deleteRegex.exec(assistantContent)) !== null) {
        const path = dMatch[1];
        const deleteNode = (nodes: FileNode[], pathParts: string[]): FileNode[] => {
          const name = pathParts[0];
          const isLast = pathParts.length === 1;
          
          return nodes.reduce((acc, n) => {
            if (n.name === name) {
              if (isLast) return acc;
              if (n.children) {
                return [...acc, { ...n, children: deleteNode(n.children, pathParts.slice(1)) }];
              }
            }
            return [...acc, n];
          }, [] as FileNode[]);
        };
        const pathParts = path.replace(/^\//, "").split("/");
        finalFiles = deleteNode(finalFiles, pathParts);
      }

      // Final Sync - Handle Files
      const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
      let fMatch;
      while ((fMatch = fileRegex.exec(assistantContent)) !== null) {
        const path = fMatch[1];
        const code = fMatch[2].trim();
        
        const updateNode = (nodes: FileNode[], pathParts: string[], content: string, currentPath: string): FileNode[] => {
          const name = pathParts[0];
          const isLast = pathParts.length === 1;
          const fullPath = `${currentPath}/${name}`;
          
          let nodeIdx = nodes.findIndex(n => n.name === name);
          if (nodeIdx === -1) {
            const newNode: FileNode = isLast 
              ? { name, type: "file", path: fullPath, content } 
              : { name, type: "directory", path: fullPath, children: [] };
            nodes.push(newNode);
            nodeIdx = nodes.length - 1;
          }

          if (isLast) {
            nodes[nodeIdx].content = content;
          } else {
            nodes[nodeIdx].children = updateNode(nodes[nodeIdx].children || [], pathParts.slice(1), content, fullPath);
          }
          return nodes;
        };

        const pathParts = path.replace(/^\//, "").split("/");
        finalFiles = updateNode(finalFiles, pathParts, code, "");
      }
      setFiles(finalFiles);

      // Execute commands after a small delay to ensure files are written to WebContainer
      if (workbenchRef.current) {
        const cmdRegex = /<command>([\s\S]*?)<\/command>/g;
        let cMatch;
        while ((cMatch = cmdRegex.exec(assistantContent)) !== null) {
          const cmdStr = cMatch[1].trim();
          setTimeout(() => {
            workbenchRef.current?.runCommand(cmdStr);
          }, 500);
        }
      }

    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (status === "booting" || status === "error") {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center gap-6 p-10">
        <div className="relative">
          {status === "booting" ? (
            <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-bold text-2xl">!</div>
          )}
        </div>
        <div className="space-y-4 text-center font-mono max-w-xl">
          <h1 className="text-white text-lg font-medium tracking-tight uppercase">Nexus v1.0.0</h1>
          {status === "booting" ? (
            <p className="text-[#6B6B6B] text-xs">Isolating environment and booting runtime...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-red-400 text-xs py-2 px-4 bg-red-400/10 border border-red-400/20 rounded">
                CRITICAL_RUNTIME_ERROR: {containerError}
              </p>
              <div className="text-[#6B6B6B] text-[10px] space-y-2 leading-relaxed">
                <p>WebContainers require a Cross-Origin Isolated environment.</p>
                <p>If you are seeing this, please ensure the application is opened in its own tab and not within a restricted iframe.</p>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors uppercase tracking-widest text-[10px]"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090b] text-[#a1a1aa] font-sans overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-10 border-b border-[#1f1f23] bg-[#0c0c0e] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-zinc-100 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <Code className="w-3 h-3 text-zinc-900" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-widest uppercase">Nexus<span className="text-zinc-600 font-normal">.AI</span></span>
          </div>
          
          <nav className="flex items-center gap-4 text-[10px] font-medium text-zinc-500 uppercase tracking-tighter">
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">File</span>
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">Selection</span>
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">View</span>
            <span className="hover:text-zinc-300 cursor-pointer transition-colors">Go</span>
          </nav>
        </div>

        <div className="flex-1 max-w-[400px] mx-4 relative group">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 group-focus-within:text-zinc-400 transition-colors" />
           <input 
             type="text" 
             placeholder="Search project..."
             className="w-full h-7 bg-[#18181b] border border-[#27272a] rounded-md pl-9 pr-4 text-[11px] focus:outline-none focus:border-zinc-700 transition-all placeholder:text-zinc-700"
           />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#18181b] px-2.5 py-1 rounded border border-[#27272a] group cursor-help transition-colors hover:bg-zinc-800">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full", 
              status === "ready" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-amber-500 animate-pulse"
            )} />
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Container: {status}</span>
          </div>
          <button className="h-7 bg-zinc-100 border border-zinc-200 text-zinc-900 text-[10px] font-bold px-4 rounded-md hover:bg-white transition-all uppercase tracking-widest active:scale-95 shadow-sm">
            Deploy App
          </button>
        </div>
      </header>

      {/* Workspace Area */}
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-[380px] flex flex-col border-r border-[#1f1f23] bg-[#0c0c0e] shrink-0">
          <ChatInterface 
            messages={messages} 
            isProcessing={isProcessing} 
            onSendMessage={handleSendMessage}
            onPlanGenerated={() => {}}
          />
        </aside>
        <section className="flex-1 overflow-hidden bg-[#09090b]">
          <Workbench 
            ref={workbenchRef}
            files={files} 
            currentFile={currentFile} 
            onFileSelect={setCurrentFile}
            onFileChange={(path, content) => {
              const newFiles = [...files];
              const update = (nodes: FileNode[]) => {
                for (const node of nodes) {
                  if (node.path === path) {
                    node.content = content;
                    return true;
                  }
                  if (node.children && update(node.children)) return true;
                }
                return false;
              };
              update(newFiles);
              setFiles(newFiles);
            }}
          />
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <WebContainerProvider>
      <Root />
    </WebContainerProvider>
  );
}

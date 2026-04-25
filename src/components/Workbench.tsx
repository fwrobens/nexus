import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  Eye, 
  Code, 
  Terminal as TerminalIcon,
  RotateCcw,
  ExternalLink,
  Save,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { FileNode, WorkbenchState } from "@/src/types";
import { useWebContainer } from "@/src/contexts/WebContainerContext";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface WorkbenchProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  currentFile: string | null;
  onFileChange: (path: string, content: string) => void;
}

export function Workbench({ files, onFileSelect, currentFile, onFileChange }: WorkbenchProps) {
  const { instance, status } = useWebContainer();
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "terminal">("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [fileContent, setFileContent] = useState("");

  const findFile = useCallback((nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findFile(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (currentFile) {
      const file = findFile(files, currentFile);
      if (file) setFileContent(file.content || "");
    }
  }, [currentFile, files, findFile]);

  // Terminal Setup
  useEffect(() => {
    if (!terminalRef.current || !instance || termInstance.current) return;

    const term = new Terminal({
      theme: {
        background: "#0c0c0e",
        foreground: "#a1a1aa",
        cursor: "#3b82f6",
        selectionBackground: "rgba(59, 130, 246, 0.3)",
      },
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 12,
      convertEol: true,
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    const startShell = async () => {
      const process = await instance.spawn("jsh", {
        terminal: { cols: term.cols, rows: term.rows }
      });

      process.output.pipeTo(new WritableStream({
        write(data) { term.write(data); }
      }));

      const input = process.input.getWriter();
      term.onData(data => input.write(data));

      window.addEventListener("resize", () => {
        fit.fit();
        process.resize({ cols: term.cols, rows: term.rows });
      });
    };

    startShell();

    instance.on("server-ready", (port, url) => {
      setPreviewUrl(url);
    });

    return () => {
      term.dispose();
      termInstance.current = null;
    };
  }, [instance]);

  const handleSave = () => {
    if (currentFile) {
      onFileChange(currentFile, fileContent);
    }
  };

  return (
    <div className="flex h-full bg-[#09090b] overflow-hidden">
      {/* File Explorer Sidebar */}
      <motion.div 
        animate={{ width: isSidebarOpen ? 220 : 0 }}
        className="border-r border-[#27272a] flex flex-col bg-[#0c0c0e]"
      >
        <div className="p-3 flex items-center justify-between border-b border-[#27272a]">
          <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">Explorer</span>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-[#18181b] rounded text-[#52525b] hover:text-white transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {files.map((node) => (
            <FileTreeItem 
              key={node.path} 
              node={node} 
              onSelect={onFileSelect}
              selectedPath={currentFile}
            />
          ))}
        </div>
      </motion.div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between h-10 bg-[#0c0c0e] border-b border-[#27272a] px-1 shrink-0">
          <div className="flex items-center h-full gap-0.5 overflow-x-auto scrollbar-hide">
            <TabButton 
              active={activeTab === "preview"} 
              icon={Eye} 
              label="Preview" 
              onClick={() => setActiveTab("preview")} 
            />
            <TabButton 
              active={activeTab === "code"} 
              icon={Code} 
              label="Editor" 
              onClick={() => setActiveTab("code")} 
            />
            <TabButton 
              active={activeTab === "terminal"} 
              icon={TerminalIcon} 
              label="Terminal" 
              onClick={() => setActiveTab("terminal")} 
            />
          </div>
          
          <div className="flex items-center gap-2 pr-2">
            {currentFile && activeTab === "code" && (
              <button 
                onClick={handleSave}
                className="flex items-center h-7 gap-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            )}
            {previewUrl && activeTab === "preview" && (
              <button 
                onClick={() => setPreviewUrl(url => url ? `${url}?t=${Date.now()}` : null)}
                className="p-1.5 hover:bg-[#18181b] rounded text-[#71717a]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-[#09090b]">
          <AnimatePresence mode="wait">
            {activeTab === "preview" && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col"
              >
                {!previewUrl ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#52525b] gap-4">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-[11px] uppercase font-bold tracking-widest">Awaiting Bridge Connection...</p>
                  </div>
                ) : (
                  <iframe 
                    src={previewUrl} 
                    className="flex-1 border-none bg-white"
                  />
                )}
              </motion.div>
            )}

            {activeTab === "code" && (
              <motion.div 
                key="code"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-[#09090b]"
              >
                {currentFile ? (
                  <div className="flex h-full">
                    <div className="w-10 bg-[#0c0c0e] border-r border-[#27272a] flex flex-col items-center pt-4 text-[11px] text-[#52525b] font-mono select-none">
                      {fileContent.split("\n").map((_, i) => (
                        <div key={i} className="h-5 leading-5">{i + 1}</div>
                      ))}
                    </div>
                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      spellCheck={false}
                      className="flex-1 bg-transparent text-[#a1a1aa] p-4 font-mono text-[13px] leading-relaxed resize-none focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[#52525b] text-[11px] uppercase font-bold tracking-widest">Select file to synthesize</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "terminal" && (
              <motion.div 
                key="terminal"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0c0c0e] flex flex-col"
              >
                <div className="h-8 border-b border-[#27272a] px-3 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#52525b]">Terminal Output</span>
                  <span className="text-[10px] font-mono text-[#52525b]">xterm.js @ node 20.x</span>
                </div>
                <div ref={terminalRef} className="flex-1 p-3" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FileTreeItem({ node, onSelect, selectedPath, depth = 0 }: { node: FileNode, onSelect: (path: string) => void, selectedPath: string | null, depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const isSelected = selectedPath === node.path;
  
  const handleClick = () => {
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          "flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors group h-7",
          isSelected ? "bg-blue-500/10 border-r-2 border-blue-500 text-blue-400" : "hover:bg-[#18181b] text-[#71717a] hover:text-white"
        )}
      >
        {node.type === "directory" ? (
          isOpen ? <ChevronDown className="w-3 h-3 transition-transform" /> : <ChevronRight className="w-3 h-3 transition-transform" />
        ) : (
          <File className="w-3 h-3" />
        )}
        <span className="text-[12px] font-medium truncate">{node.name}</span>
      </div>
      {node.type === "directory" && isOpen && node.children && (
        <div className="mt-0.5">
          {node.children.map(child => (
            <FileTreeItem 
              key={child.path} 
              node={child} 
              onSelect={onSelect} 
              selectedPath={selectedPath}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 h-full text-[11px] font-medium transition-colors border-b-2",
        active ? "text-white border-blue-500 bg-[#18181b]" : "text-[#71717a] border-transparent hover:bg-[#18181b]"
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

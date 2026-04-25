import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
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

export interface WorkbenchRef {
  runCommand: (command: string) => void;
}

export const Workbench = forwardRef<WorkbenchRef, WorkbenchProps>(({ files, onFileSelect, currentFile, onFileChange }, ref) => {
  const { instance, status } = useWebContainer();
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "terminal">("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const shellInputRef = useRef<any>(null);
  const [fileContent, setFileContent] = useState("");

  useImperativeHandle(ref, () => ({
    runCommand: (command: string) => {
      if (shellInputRef.current) {
        const writer = shellInputRef.current;
        writer.write(command + "\n");
        setIsTerminalOpen(true);
      }
    }
  }));

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

    let shellProcess: any = null;

    const startShell = async () => {
      try {
        shellProcess = await instance.spawn("jsh", {
          terminal: { cols: term.cols, rows: term.rows }
        });

        shellProcess.output.pipeTo(new WritableStream({
          write(data) { term.write(data); }
        }));

        const input = shellProcess.input.getWriter();
        shellInputRef.current = input;

        const onDataListener = term.onData(data => {
          input.write(data);
        });

        const handleResize = () => {
          fit.fit();
          shellProcess.resize({ cols: term.cols, rows: term.rows });
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
          onDataListener.dispose();
          shellProcess?.kill();
        };
      } catch (err) {
        console.error("Failed to start shell:", err);
      }
    };

    const cleanupPromise = startShell();

    instance.on("server-ready", (port, url) => {
      setPreviewUrl(url);
    });

    return () => {
      cleanupPromise.then(cleanup => cleanup?.());
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
        animate={{ width: isSidebarOpen ? 240 : 0 }}
        className="border-r border-[#1f1f23] flex flex-col bg-[#0c0c0e] shrink-0"
      >
        <div className="p-4 flex items-center justify-between border-b border-[#1f1f23]">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-zinc-500" />
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Explorer</span>
          </div>
          <button className="p-1.5 hover:bg-[#18181b] rounded-md text-zinc-500 hover:text-blue-400 transition-all">
            <Plus className="w-4 h-4" />
          </button>
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

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        {/* Editor/Preview Header */}
        <div className="flex items-center justify-between h-11 bg-[#0c0c0e] border-b border-[#1f1f23] px-2 shrink-0">
          <div className="flex items-center h-full gap-1 overflow-x-auto scrollbar-hide">
            <TabButton 
              active={activeTab === "code"} 
              icon={Code} 
              label="Editor" 
              onClick={() => setActiveTab("code")} 
            />
            <TabButton 
              active={activeTab === "preview"} 
              icon={Eye} 
              label="Preview" 
              onClick={() => setActiveTab("preview")} 
            />
          </div>
          
          <div className="flex items-center gap-2">
            {currentFile && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#18181b] rounded-md border border-[#27272a]">
                <File className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-400 truncate max-w-[200px] font-mono leading-none">{currentFile}</span>
              </div>
            )}
            {currentFile && activeTab === "code" && (
              <button 
                onClick={handleSave}
                className="flex items-center h-7 gap-2 px-3 rounded-md bg-white text-zinc-900 hover:bg-zinc-200 text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            )}
            {previewUrl && activeTab === "preview" && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPreviewUrl(url => url ? `${url}?t=${Date.now()}` : null)}
                  className="p-1.5 hover:bg-[#18181b] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => window.open(previewUrl, "_blank")}
                  className="p-1.5 hover:bg-[#18181b] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Pane and Bottom Panel Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Main Content Pane */}
          <div className="flex-1 relative bg-[#09090b] overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === "preview" && (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
                  className="absolute inset-0 flex flex-col"
                >
                  {!previewUrl ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#52525b] gap-6 bg-[#09090b]">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 animate-spin text-zinc-800" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Eye className="w-4 h-4 text-zinc-600" />
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[11px] uppercase font-bold tracking-[0.2em] text-zinc-600">Initializing Bridge</p>
                        <p className="text-[9px] text-zinc-700 font-mono">Waiting for WebContainer runtime...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 bg-white rounded-lg m-2 overflow-hidden shadow-2xl relative border border-zinc-800/10">
                      <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-none"
                      />
                    </div>
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
                    <div className="flex h-full overflow-hidden">
                      <div className="w-12 bg-[#0c0c0e] border-r border-[#1f1f23] flex flex-col items-center pt-4 text-[11px] text-[#3f3f46] font-mono select-none flex-none overflow-hidden">
                        {fileContent.split("\n").map((_, i) => (
                          <div key={i} className="h-6 leading-6 w-full text-center hover:bg-zinc-800/20 transition-colors">{i + 1}</div>
                        ))}
                      </div>
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        spellCheck={false}
                        className="flex-1 bg-transparent text-[#d4d4d8] p-4 font-mono text-[14px] leading-[1.6] resize-none focus:outline-none overflow-y-auto scrollbar-hide selection:bg-zinc-500/30"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="p-4 rounded-full bg-zinc-900/50 border border-dotted border-zinc-800">
                        <Code className="w-8 h-8 text-zinc-700" />
                      </div>
                      <p className="text-zinc-600 text-[11px] uppercase font-bold tracking-[0.2em]">Select a file to begin coding</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Persistent Terminal Toggle Button */}
          <button 
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={cn(
              "absolute bottom-4 right-4 z-30 p-2 rounded-lg transition-all shadow-xl flex items-center gap-2 active:scale-95 border",
              isTerminalOpen 
                ? "bg-zinc-100 text-zinc-900 border-zinc-200" 
                : "bg-[#18181b] text-zinc-400 border-[#27272a] hover:text-zinc-100 hover:border-zinc-700 shadow-2xl"
            )}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest px-1">Terminal</span>
          </button>

          {/* Bottom Pane (Terminal) */}
          <motion.div 
            initial={false}
            animate={{ height: isTerminalOpen ? 300 : 0 }}
            className="border-t border-[#1f1f23] bg-[#0c0c0e] flex flex-col shrink-0 overflow-hidden z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="h-9 border-b border-[#1f1f23] px-4 flex items-center justify-between shrink-0 bg-[#0c0c0e]/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Terminal Shell</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-mono text-emerald-500/80 uppercase font-bold tracking-tighter">Live</span>
                 </div>
                 <div className="h-3 w-px bg-zinc-800 mx-1" />
                 <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tighter">node v20.x</span>
                 <button onClick={() => setIsTerminalOpen(false)} className="ml-2 hover:text-white transition-colors">
                    <ChevronDown className="w-3.5 h-3.5" />
                 </button>
              </div>
            </div>
            <div ref={terminalRef} className="flex-1 p-3 overflow-hidden terminal-container" />
          </motion.div>
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#0c0c0e] border-t border-[#1f1f23] px-3 flex items-center justify-between text-[10px] text-zinc-600 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors cursor-pointer group">
              <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform" />
              <span>Project Nexus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span>Main</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono">UTF-8</span>
            <span className="font-mono">TypeScript React</span>
          </div>
        </div>
      </div>
    </div>
  );
});

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
          isSelected ? "bg-zinc-800 text-white font-bold" : "hover:bg-[#18181b] text-[#71717a] hover:text-white"
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
        "flex items-center gap-2 px-4 h-full text-[11px] font-bold uppercase tracking-widest transition-all border-b-2",
        active ? "text-white border-white bg-[#18181b] shadow-[inset_0_-10px_20px_-10px_rgba(255,255,255,0.05)]" : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-[#18181b]"
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", active ? "text-white" : "text-zinc-600")} />
      {label}
    </button>
  );
}

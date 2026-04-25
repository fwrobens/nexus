import React, { useState, useRef, useEffect } from "react";
import { Send, Terminal as TerminalIcon, Code, Eye, Loader2, CheckCircle2, ChevronRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Message, Step } from "@/src/types";
import ReactMarkdown from "react-markdown";

interface ChatProps {
  onPlanGenerated: (steps: Step[]) => void;
  messages: Message[];
  isProcessing: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatInterface({ onPlanGenerated, messages, isProcessing, onSendMessage }: ChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <div className="flex items-center px-4 py-2 border-b border-[#27272a] bg-[#0c0c0e]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#52525b]">Nexus Chat</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.role === "user" ? "items-start" : "items-start")}>
            <div className={cn(
              "w-full rounded-lg px-3 py-2.5 text-[13px] leading-relaxed border",
              msg.role === "user" ? "bg-[#18181b] border-[#27272a] text-white" : "bg-[#18181b]/40 border-[#27272a] text-[#a1a1aa]"
            )}>
              <span className={cn(
                "font-bold mr-2 text-[11px] uppercase tracking-tighter",
                msg.role === "user" ? "text-blue-400" : "text-purple-400"
              )}>
                {msg.role === "user" ? "User:" : "Nexus:"}
              </span>
              <div className="prose prose-invert prose-xs max-w-none inline">
                <ReactMarkdown>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
            {msg.steps && msg.steps.length > 0 && (
              <div className="mt-3 w-full space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-[#52525b] tracking-widest mb-2">Process Stack</div>
                {msg.steps.map((step) => (
                  <StepItem key={step.id} step={step} />
                ))}
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-[#52525b] text-[10px] px-1 font-mono">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>SEQUENCING_LOGIC...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#27272a] bg-[#0c0c0e]">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask for modifications..."
            className="w-full bg-[#18181b] text-white border border-blue-500/30 rounded-lg p-3 text-[12px] placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all resize-none h-24"
          />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StepItem({ step }: { step: Step }) {
  const isRunning = step.status === "running";
  const isCompleted = step.status === "completed";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-[11px]"
    >
      {isRunning ? (
        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ) : isCompleted ? (
        <span className="text-green-500 font-bold w-3">✓</span>
      ) : (
        <span className="w-3"></span>
      )}
      <span className={cn(
        isRunning ? "text-blue-400" : isCompleted ? "text-zinc-300" : "text-zinc-500"
      )}>
        {step.title}
      </span>
    </motion.div>
  );
}

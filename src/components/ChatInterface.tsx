import React, { useState, useRef, useEffect } from "react";
import { Send, Terminal as TerminalIcon, Code, Eye, Loader2, CheckCircle2, ChevronRight, Play, Sparkles, MessageSquare, Bot } from "lucide-react";
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f23] bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-zinc-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Nexus Chat</span>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
            <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
            <span className="text-[9px] text-zinc-400 font-mono uppercase font-bold tracking-tighter">Thinking</span>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex flex-col gap-3", msg.role === "user" ? "items-end" : "items-start")}
            >
              {msg.role === "user" ? (
                <div className="bg-[#18181b] border border-[#27272a] text-zinc-200 px-4 py-2.5 rounded-2xl rounded-tr-none text-[13px] max-w-[90%] shadow-sm leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full">
                  {/* Thoughts Section */}
                  {msg.metadata?.thoughts && (
                    <CollapsibleThought thoughts={msg.metadata.thoughts} />
                  )}

                  {/* Message Content */}
                  {msg.content && (
                    <div className="pl-2 space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1 bg-purple-600/10 border border-purple-600/20 rounded text-purple-400">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assistant</span>
                      </div>
                      <div className="prose prose-invert prose-xs max-w-none text-zinc-300 text-[13px] leading-relaxed ml-7">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Steps/Progress */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="ml-7 space-y-2 mt-2">
                       <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 rounded-md border border-zinc-800/50 w-fit">
                        <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-pulse" />
                        <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Process Stack</span>
                      </div>
                      <div className="space-y-1.5 pl-2 border-l border-zinc-800">
                        {msg.steps.map((step) => (
                          <StepItem key={step.id} step={step} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-[#0c0c0e] border-t border-[#1f1f23]">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-0 bg-white/5 blur-xl group-focus-within:bg-white/10 transition-all rounded-2xl -z-10" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask anything..."
            className="w-full bg-[#18181b]/80 backdrop-blur-sm text-zinc-100 border border-[#27272a] focus:border-zinc-500 rounded-2xl p-4 pr-14 text-[13px] placeholder:text-zinc-600 focus:outline-none transition-all resize-none h-[110px] shadow-sm active:scale-[0.99] font-sans"
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              className="p-2.5 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white disabled:opacity-50 transition-all shadow-lg active:scale-95 group/btn"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <Send className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />}
            </button>
          </div>
        </form>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-600 font-medium tracking-tight">Shift + Enter for new line</span>
          <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
            <Bot className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] text-zinc-500 font-mono tracking-tighter">Nexus Engine v1.5</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsibleThought({ thoughts }: { thoughts: string }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl relative"
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-[#71717a]">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Thoughts just now</span>
        </div>
        <ChevronRight className={cn("w-3.5 h-3.5 text-zinc-600 transition-transform", isOpen && "rotate-90")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            <div className="prose prose-invert prose-xs max-w-none text-zinc-400 text-[12px] leading-relaxed border-l-2 border-zinc-700 pl-3 pt-1">
              <ReactMarkdown>
                {thoughts}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepItem({ step }: { step: Step }) {
  const isRunning = step.status === "running";
  const isCompleted = step.status === "completed";
  const isPending = step.status === "pending";
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-0.5"
    >
      <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
        {isRunning ? (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
        )}
      </div>
      <span className={cn(
        "text-[11px] font-medium tracking-tight h-4 flex items-center",
        isRunning ? "text-blue-400 font-bold" : isCompleted ? "text-zinc-300" : "text-zinc-500"
      )}>
        {step.title}
      </span>
    </motion.div>
  );
}

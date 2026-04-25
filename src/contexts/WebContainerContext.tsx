import React, { createContext, useContext, useEffect, useState } from "react";
import { WebContainer } from "@webcontainer/api";

interface WebContainerContextType {
  instance: WebContainer | null;
  status: "idle" | "booting" | "ready" | "error";
  error: string | null;
}

const WebContainerContext = createContext<WebContainerContextType | undefined>(undefined);

let webcontainerInstancePromise: Promise<WebContainer> | null = null;

export function WebContainerProvider({ children }: { children: React.ReactNode }) {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      if (instance) return;
      
      // Check for cross-origin isolation
      if (typeof window !== "undefined" && !window.crossOriginIsolated) {
        console.error("SharedArrayBuffer transfer requires self.crossOriginIsolated. Check COOP/COEP headers.");
        setError("Cross-origin isolation is not enabled. WebContainers require COOP/COEP headers to be set on the server.");
        setStatus("error");
        return;
      }

      try {
        setStatus("booting");
        
        if (!webcontainerInstancePromise) {
          webcontainerInstancePromise = WebContainer.boot();
        }
        
        const container = await webcontainerInstancePromise;
        setInstance(container);
        setStatus("ready");
      } catch (err) {
        console.error("WebContainer boot failed:", err);
        setError(err instanceof Error ? err.message : "Failed to boot WebContainer");
        setStatus("error");
      }
    }

    boot();
  }, [instance]);

  return (
    <WebContainerContext.Provider value={{ instance, status, error }}>
      {children}
    </WebContainerContext.Provider>
  );
}

export function useWebContainer() {
  const context = useContext(WebContainerContext);
  if (!context) {
    throw new Error("useWebContainer must be used within a WebContainerProvider");
  }
  return context;
}

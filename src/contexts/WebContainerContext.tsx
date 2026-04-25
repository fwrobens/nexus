import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";

interface WebContainerContextType {
  instance: WebContainer | null;
  status: "idle" | "booting" | "ready" | "error";
  error: string | null;
}

const WebContainerContext = createContext<WebContainerContextType | undefined>(undefined);

export function WebContainerProvider({ children }: { children: React.ReactNode }) {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let container: WebContainer;

    async function boot() {
      if (instance) return;
      
      try {
        setStatus("booting");
        container = await WebContainer.boot();
        setInstance(container);
        setStatus("ready");
      } catch (err) {
        console.error("WebContainer boot failed:", err);
        setError(err instanceof Error ? err.message : "Failed to boot WebContainer");
        setStatus("error");
      }
    }

    boot();

    return () => {
      // teardown is expensive, usually not needed in SPA during component lifecycle
      // but good for cleanliness if we were doing hard reloads
      // container?.teardown(); 
    };
  }, []);

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

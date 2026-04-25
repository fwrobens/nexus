import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === "undefined") {
  console.warn("GEMINI_API_KEY is missing. AI features will fail.");
}

const ai = new GoogleGenAI({ apiKey: apiKey as string });

const SYSTEM_PROMPT = `
You are Nexus, an expert AI Full-Stack Developer. Your goal is to build high-quality, modern React applications based on user prompts.

### RULES:
1. Output format: You MUST use a structured markdown format that I can parse.
2. For every file change, use:
<file path="path/to/file.tsx">
// code here
</file>

3. For deleting files, use:
<delete path="path/to/file.tsx" />

4. For terminal commands (installing deps, starting server), use:
<command>
npm install package-name
</command>

5. For thoughts or progress updates, use:
<thought>
I am setting up the routing structure...
</thought>

6. No unnecessary talk. Be direct.
7. Always use modern React (19+) with Tailwind CSS.
8. Use the "lucide-react" library for icons.
9. Use "motion" from "motion/react" for animations.
10. Assume the environment is a Vite React project.
11. NEVER include comments like "add logic here". Write the full, functional code.

### WORKFLOW:
1. Analyze the request.
2. Plan the file structure.
3. Generate the implementation.
4. Run the necessary commands.
`;

export async function chatStream(prompt: string, history: any[] = []) {
  const chat = ai.chats.create({
    model: "gemini-1.5-flash",
    config: {
      systemInstruction: SYSTEM_PROMPT
    },
    history: history.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }))
  });

  const stream = await chat.sendMessageStream({ message: prompt });
  return stream;
}

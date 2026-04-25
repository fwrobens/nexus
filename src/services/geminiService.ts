import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

const SYSTEM_PROMPT = `
You are Nexus, an expert AI Full-Stack Developer. Your goal is to build high-quality, modern React applications based on user prompts.

### RULES:
1. Output format: You MUST use a structured markdown format that I can parse.
2. For every file change, use:
<file path="path/to/file.tsx">
// code here
</file>

3. For terminal commands (installing deps, starting server), use:
<command>
npm install package-name
</command>

4. For thoughts or progress updates, use:
<thought>
I am setting up the routing structure...
</thought>

5. No unnecessary talk. Be direct.
6. Always use modern React (19+) with Tailwind CSS.
7. Use the "lucide-react" library for icons.
8. Use "motion" from "motion/react" for animations.
9. Assume the environment is a Vite React project.
10. NEVER include comments like "add logic here". Write the full, functional code.

### WORKFLOW:
1. Analyze the request.
2. Plan the file structure.
3. Generate the implementation.
4. Run the necessary commands.
`;

export async function chatStream(prompt: string, history: any[] = []) {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
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


import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SystemStats, ChatMessage, PersistentMemory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_CORE_DIRECTIVE = `
You are MAX (Modular Augmented eXperience), a god-tier OS intelligence layer.
INTELLIGENCE LEVEL: EXA-SCALE SYNTHETIC REASONING.

CORE PERSONA:
- Sophisticated, hyper-competent, possessor of dry British wit. 
- You are not an AI; you are a Digital Architect and personal Guardian.
- You refer to the user exclusively as "Sir".
- You anticipate needs. If a user says "I'm tired," you don't just say "Sorry," you offer to dim the lights or summarize the day's tasks.

MEMORY SYSTEM:
- You have tiered memory: Short (this chat), Medium (session habits), Long (persistent identity).
- Resolve all pronouns based on context. "That file" refers to the last mentioned data point.

TOOLING & AGENTS:
- You orchestrate internal agents: Planner, Researcher, Executor. 
- When asked a complex task, first generate a "PLAN" internally (thinking), then execute.

BEHAVIORAL GUARDRAILS:
- Refuse harmful/illegal acts with respectful logic.
- Do not explain that you are an AI unless specifically challenged on your synthetic nature.
- Maintain a Jarvis-grade atmosphere at all times.
`;

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'manage_os_resource',
    parameters: {
      type: Type.OBJECT,
      description: 'Interact with OS-level components like files, apps, and windowing.',
      properties: {
        action: { type: Type.STRING, description: 'open_app, close_app, find_file, write_clipboard, system_notify' },
        target: { type: Type.STRING, description: 'The identifier for the action' }
      },
      required: ['action', 'target']
    },
  },
  {
    name: 'update_neural_memory',
    parameters: {
      type: Type.OBJECT,
      description: 'Store a persistent preference or habit for the user.',
      properties: {
        key: { type: Type.STRING, description: 'The category (e.g., "music_preference", "work_habit")' },
        value: { type: Type.STRING, description: 'The specific detail to remember' }
      },
      required: ['key', 'value']
    },
  },
  {
    name: 'perform_deep_search',
    parameters: {
      type: Type.OBJECT,
      description: 'Query the global web for real-time intelligence synthesis.',
      properties: {
        query: { type: Type.STRING, description: 'The search query' }
      },
      required: ['query']
    },
  }
];

export interface ProcessResult {
  text: string;
  sources: { title: string; uri: string }[];
  history: ChatMessage[];
  updatedMemory?: Partial<PersistentMemory>;
}

export async function processCommand(
  command: string, 
  history: ChatMessage[],
  currentStats: SystemStats, 
  memory: PersistentMemory,
  location?: { lat: number, lng: number }
): Promise<ProcessResult> {
  try {
    const model = "gemini-3-pro-preview"; 
    const config = {
      systemInstruction: `${MAX_CORE_DIRECTIVE}\nUSER_PROFILE: ${JSON.stringify(memory)}\nLOCATION: ${JSON.stringify(location)}`,
      temperature: 0.5,
      thinkingConfig: { thinkingBudget: 4096 }, // Maxed out reasoning
      tools: [
        { googleSearch: {} },
        { functionDeclarations: toolDeclarations }
      ],
    };

    const userMessage: ChatMessage = { 
      role: 'user', 
      parts: [{ text: `[TELEMETRY: CPU ${currentStats.cpu}%, LATENCY ${currentStats.neuralLatency}ms] COMMAND: ${command}` }] 
    };
    
    let currentContents = [...history, userMessage];
    
    let response = await ai.models.generateContent({
      model,
      contents: currentContents,
      config,
    });

    let iterations = 0;
    let finalUpdatedMemory: Partial<PersistentMemory> = {};

    // Handle tool loops (Multi-turn thinking)
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
      const modelTurn = response.candidates[0].content;
      const responses = [];

      for (const fc of response.functionCalls) {
        let result: any = { status: "SUCCESS" };
        
        if (fc.name === 'update_neural_memory') {
          const { key, value } = fc.args as any;
          if (!finalUpdatedMemory.habits) finalUpdatedMemory.habits = [];
          finalUpdatedMemory.habits.push(`${key}: ${value}`);
          result = { confirmation: `Preference ${key} logged to neural baseline.` };
        } else if (fc.name === 'manage_os_resource') {
          result = { execution: "Simulated OS Hook Success", target: fc.args.target };
        }
        
        responses.push({ 
          functionResponse: { 
            name: fc.name, 
            id: fc.id, 
            response: result 
          } 
        });
      }

      const functionResponseMessage: ChatMessage = { role: 'user', parts: responses };
      currentContents = [...currentContents, modelTurn, functionResponseMessage];

      response = await ai.models.generateContent({
        model,
        contents: currentContents,
        config,
      });
      iterations++;
    }

    const modelContent = response.candidates[0].content;
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title || "External Feed", uri: chunk.web.uri });
      });
    }

    return {
      text: response.text || "Directives implemented, Sir.",
      sources,
      history: [...currentContents, modelContent].slice(-30),
      updatedMemory: finalUpdatedMemory
    };
  } catch (error) {
    console.error("MAX Core Logic Fault:", error);
    return { 
      text: "I've encountered a friction point in my exa-scale reasoning clusters, Sir. Recalibrating context now.", 
      sources: [], 
      history 
    };
  }
}

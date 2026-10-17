import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";

export type DocumentTool = {
  description: string;
  inputSchema: z.ZodType;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
};

type SdkProvider = { kind: "sdk"; label: string; models: { name: string; model: LanguageModel }[] };
type BackboardProvider = { kind: "backboard"; label: "Backboard" };
type ModelProvider = SdkProvider | BackboardProvider;

const GEMINI_ALTERNATES = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];

const PLACEHOLDER_KEY = /placeholder|your-|changeme|example/i;

function readEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const direct = env[name];
  const match = direct === undefined ? Object.keys(env).find((key) => key.trim() === name) : undefined;
  const value = direct ?? (match ? env[match] : undefined);
  if (value == null) return value;
  return value.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/^=+\s*/, "").trim();
}

function configuredKey(value: string | undefined): string | null {
  const key = value?.trim();
  if (!key || PLACEHOLDER_KEY.test(key)) return null;
  return key;
}

export function providerLabels(env: Record<string, string | undefined> = process.env): string[] {
  const labels: string[] = [];
  if (configuredKey(readEnv(env, "OPENROUTER_API_KEY"))) labels.push("OpenRouter");
  if (configuredKey(readEnv(env, "BACKBOARD_API_KEY"))) labels.push("Backboard");
  if (configuredKey(readEnv(env, "GOOGLE_GENERATIVE_AI_API_KEY"))) labels.push("Gemini");
  return labels;
}

export function liveModelEnabled(): boolean {
  return providerLabels().length > 0;
}

export function generationErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "No model key is configured") return "Add an OpenRouter, Backboard, or Gemini API key.";
  if (message.startsWith("The models are busy")) return message;
  if (/quota|rate.?limit/i.test(message)) return "The model is out of free requests for now. Try again later.";
  return fallback;
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name} ${error.message}` : String(error);
}

function isQuota(error: unknown): boolean {
  return /quota|rate.?limit/i.test(errorText(error));
}

function isOverloaded(error: unknown): boolean {
  if (isQuota(error)) return false;
  return /high demand|overloaded|UNAVAILABLE|\b503\b/i.test(errorText(error));
}

function isMissingModel(error: unknown): boolean {
  return /not found|no longer available|not available to new users|is not supported|invalid model|does not exist/i.test(errorText(error));
}

function isTransient(error: unknown): boolean {
  if (isQuota(error)) return false;
  return /high demand|overloaded|unavailable|RESOURCE_EXHAUSTED|429|503|timeout|ECONNRESET|fetch failed/i.test(errorText(error));
}

export function geminiModelNames(env: Record<string, string | undefined> = process.env): string[] {
  const preferred = readEnv(env, "GEMINI_MODEL")?.trim() || "gemini-3.8-flash";
  return [...new Set([preferred, ...GEMINI_ALTERNATES])];
}

function providers(): ModelProvider[] {
  const list: ModelProvider[] = [];
  const openrouterKey = configuredKey(readEnv(process.env, "OPENROUTER_API_KEY"));
  if (openrouterKey) {
    const client = createOpenRouter({ apiKey: openrouterKey });
    const name = readEnv(process.env, "OPENROUTER_MODEL")?.trim() || "openai/gpt-4o-mini";
    list.push({
      kind: "sdk",
      label: "OpenRouter",
      models: [{ name, model: client.chat(name) }],
    });
  }
  if (configuredKey(readEnv(process.env, "BACKBOARD_API_KEY"))) list.push({ kind: "backboard", label: "Backboard" });
  if (configuredKey(readEnv(process.env, "GOOGLE_GENERATIVE_AI_API_KEY"))) {
    list.push({
      kind: "sdk",
      label: "Gemini",
      models: geminiModelNames().map((name) => ({ name, model: google(name) })),
    });
  }
  return list;
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

type BackboardCall = {
  id?: string;
  function?: { name?: string; arguments?: string; parsed_arguments?: Record<string, unknown> };
};

type BackboardReply = {
  status?: string;
  thread_id?: string;
  threadId?: string;
  content?: string | null;
  tool_calls?: BackboardCall[];
  toolCalls?: BackboardCall[];
};

async function backboard(path: string, body: unknown): Promise<BackboardReply> {
  const response = await fetch(`https://app.backboard.io/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-Key": readEnv(process.env, "BACKBOARD_API_KEY")?.trim() ?? "",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Backboard ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as BackboardReply;
}

function callArguments(call: BackboardCall): Record<string, unknown> {
  const parsed = call.function?.parsed_arguments;
  if (parsed && typeof parsed === "object") return parsed;
  try {
    const value = JSON.parse(call.function?.arguments || "{}") as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function runBackboard(options: {
  system: string;
  prompt: string;
  tools: Record<string, DocumentTool>;
  steps: number;
}): Promise<void> {
  const tools = Object.entries(options.tools).map(([name, definition]) => ({
    type: "function",
    function: {
      name,
      description: definition.description,
      parameters: jsonSchema(definition.inputSchema),
    },
  }));
  let reply = await backboard("/threads/messages", {
    content: options.prompt,
    system_prompt: options.system,
    tools,
    stream: false,
    memory: "off",
    llm_provider: readEnv(process.env, "BACKBOARD_PROVIDER")?.trim() || "openai",
    model_name: readEnv(process.env, "BACKBOARD_MODEL")?.trim() || "gpt-4o-mini",
  });

  for (let step = 0; step < options.steps; step += 1) {
    const status = (reply.status ?? "").toUpperCase();
    const calls = reply.tool_calls ?? reply.toolCalls ?? [];
    if (status === "FAILED" || status === "CANCELLED") {
      throw new Error(reply.content || "Backboard could not finish the document edit");
    }
    if (status !== "REQUIRES_ACTION" || calls.length === 0) return;
    const threadId = reply.thread_id ?? reply.threadId;
    if (!threadId) throw new Error("Backboard did not return a thread id");
    const outputs = [];
    for (const call of calls) {
      const name = call.function?.name ?? "";
      const definition = options.tools[name];
      const result = definition
        ? await definition.execute(callArguments(call))
        : { ok: false, error: `Unknown tool ${name}` };
      outputs.push({ tool_call_id: call.id ?? "", output: JSON.stringify(result) });
    }
    reply = await backboard("/threads/tool-outputs", {
      thread_id: threadId,
      tool_outputs: outputs,
      stream: false,
    });
  }
}

export async function runDocumentProviders(options: {
  system: string;
  prompt: string;
  tools: Record<string, DocumentTool>;
  steps: number;
  reset: () => void;
  succeeded: () => boolean;
}): Promise<void> {
  const available = providers();
  if (available.length === 0) throw new Error("No model key is configured");
  let last: unknown;
  for (const provider of available) {
    options.reset();
    try {
      if (provider.kind === "sdk") {
        let modelError: unknown;
        for (let index = 0; index < provider.models.length; index += 1) {
          const candidate = provider.models[index];
          options.reset();
          try {
            await generateText({
              model: candidate.model,
              maxRetries: 0,
              tools: Object.fromEntries(
                Object.entries(options.tools).map(([name, definition]) => [
                  name,
                  tool({
                    description: definition.description,
                    inputSchema: definition.inputSchema,
                    execute: async (input) => definition.execute(input as Record<string, unknown>),
                  }),
                ]),
              ),
              toolChoice: "required",
              stopWhen: stepCountIs(options.steps),
              abortSignal: AbortSignal.timeout(45_000),
              system: options.system,
              prompt: options.prompt,
            });
            if (options.succeeded()) return;
            modelError = new Error(`${provider.label} did not change the document`);
            break;
          } catch (error) {
            modelError = error;
            console.error(`${provider.label} ${candidate.name} failed`, error instanceof Error ? error.message : error);
            const retryModel = index < provider.models.length - 1 && (isOverloaded(error) || isMissingModel(error));
            if (!retryModel) break;
          }
        }
        last = modelError;
        continue;
      } else {
        await runBackboard(options);
      }
      if (options.succeeded()) return;
      last = new Error(`${provider.label} did not change the document`);
    } catch (error) {
      last = error;
      console.error(`${provider.label} failed`, error instanceof Error ? error.message : error);
    }
  }
  if (isTransient(last)) throw new Error("The models are busy right now. Try again in a moment.");
  throw last instanceof Error ? last : new Error("Lesson generation failed");
}

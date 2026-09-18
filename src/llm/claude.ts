import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Forces Claude to answer via a single tool call, so the result is guaranteed
 * structured JSON (no code-fence stripping / best-effort JSON.parse needed).
 */
export async function invokeClaudeJSON<T>(params: {
  system: string;
  user: string;
  maxTokens?: number;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  model?: string;
}): Promise<T> {
  const response = await getClient().messages.create({
    model: params.model ?? "claude-sonnet-5",
    max_tokens: params.maxTokens ?? 2000,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
    tools: [{ name: params.toolName, description: params.toolDescription, input_schema: params.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: params.toolName },
  });
  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude応答にtool_useブロックが含まれていません。");
  return toolUse.input as T;
}

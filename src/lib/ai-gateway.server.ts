import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getAiGatewayKey(): string {
  const key = process.env.AI_GATEWAY_KEY;
  if (!key) throw new Error("Missing AI_GATEWAY_KEY");
  return key;
}

export function createAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

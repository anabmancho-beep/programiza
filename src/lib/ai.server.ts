import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function mapStatus(e: unknown): AiError {
  const status = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status ?? 500;
  if (status === 402) return new AiError("No quedan créditos de IA en el espacio de trabajo. Añade créditos para seguir usando la IA.", 402);
  if (status === 429) return new AiError("El servicio de IA está saturado. Espera un minuto y vuelve a intentarlo.", 429);
  if (status === 403) return new AiError("El uso de IA no está permitido ahora mismo en este espacio de trabajo.", 403);
  if (status === 401) return new AiError("La IA no está configurada correctamente.", 401);
  return new AiError("El servicio de IA no ha respondido correctamente. Inténtalo de nuevo más tarde.", status);
}

/** Structured call. Input must already be a server-built, whitelisted payload. */
export async function aiObject<T>(schema: z.ZodType<T>, instructions: string, input: string): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("La IA no está configurada.", 401);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions,
      messages: [{ role: "user", content: input }],
      output: Output.object({ schema }),
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    return (await result.output) as T;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new AiError("La IA devolvió una respuesta no válida. Vuelve a intentarlo.", 500);
    console.error("AI error", e);
    throw mapStatus(e);
  }
}

import { prisma } from "./prisma";

const model = "gemini-3.1-flash-lite";
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;
const outputLimit = 768;
const inputLimit = 12000;
// Rates in billionths of a US dollar per token. Reserve extra output for thinking.
const inputRate = 250;
const outputRate = 1500;
const reservation = inputLimit * inputRate + (outputLimit + 8192) * outputRate;

export class AssistantBudgetReached extends Error {}

export function assistantConfig() {
  const key = process.env.ADMIN_ASSISTANT_GEMINI_KEY?.trim();
  const budget = Number(process.env.ADMIN_ASSISTANT_MONTHLY_USD || "14");
  if (process.env.ADMIN_ASSISTANT_ENABLED !== "true" || !key || !Number.isFinite(budget) || budget <= 0 || budget > 14) return null;
  return { key, ceiling: Math.floor(budget * 1e9), pilotOnly: process.env.ADMIN_ASSISTANT_ALLOW_STAFF !== "true" };
}

const monthFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/London" });

export async function askAssistantModel(
  config: NonNullable<ReturnType<typeof assistantConfig>>,
  prompt: string,
  responseJsonSchema?: Record<string, unknown>,
) {
  // Only text is sent. The UTF-8 limit leaves room below the input reservation for framing.
  if (Buffer.byteLength(prompt, "utf8") > inputLimit - 512) throw new Error("Assistant prompt exceeds limit");
  const month = monthFormat.format(new Date());
  const held = await prisma.$queryRaw<{ month: string }[]>`
    INSERT INTO "AdminAssistantSpend" ("month", "nanoUsd")
    SELECT ${month}, ${reservation}::bigint WHERE ${reservation}::bigint <= ${config.ceiling}::bigint
    ON CONFLICT ("month") DO UPDATE
      SET "nanoUsd" = "AdminAssistantSpend"."nanoUsd" + EXCLUDED."nanoUsd"
      WHERE "AdminAssistantSpend"."nanoUsd" + EXCLUDED."nanoUsd" <= ${config.ceiling}::bigint
    RETURNING "month"
  `;
  if (!held.length) throw new AssistantBudgetReached();
  // An ambiguous timeout retains its reservation because the provider may have billed it.
  const response = await fetch(`${endpoint}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: outputLimit,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
        ...(responseJsonSchema ? { responseMimeType: "application/json", responseJsonSchema } : {}),
      },
    }),
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Assistant provider rejected the request");
  const data = await response.json();
  const usage = data.usageMetadata;
  if (Number.isSafeInteger(usage?.promptTokenCount) && Number.isSafeInteger(usage?.totalTokenCount) &&
      usage.promptTokenCount > 0 && usage.totalTokenCount >= usage.promptTokenCount) {
    const billed = usage.promptTokenCount * inputRate + (usage.totalTokenCount - usage.promptTokenCount) * outputRate;
    await prisma.$executeRaw`
      UPDATE "AdminAssistantSpend" SET "nanoUsd" = "nanoUsd" + ${billed - reservation}::bigint WHERE "month" = ${month}
    `;
  }
  const answer = data.candidates?.[0]?.content?.parts
    ?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === "string")
    .map((part: { text: string }) => part.text).join("").trim();
  if (typeof answer !== "string" || !answer) throw new Error("Assistant provider returned no answer");
  return answer;
}

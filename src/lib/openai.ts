import OpenAI from "openai";

function writeDebugLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp?: number;
}) {
  try {
    require("fs").appendFileSync(
      "/opt/cursor/logs/debug.log",
      JSON.stringify({ ...payload, timestamp: payload.timestamp ?? Date.now() }) + "\n"
    );
  } catch {
    // best-effort debug logging
  }
}

function readTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

const clientCache = new Map<string, OpenAI>();

export function getOpenAIClient(opts: { requireFilesApi?: boolean } = {}): OpenAI {
  const requireFilesApi = opts.requireFilesApi ?? false;
  const fullAccessKey = readTrimmedEnv("OPENAI_FULL_ACCESS_API_KEY");
  const defaultKey = readTrimmedEnv("OPENAI_API_KEY");
  const apiKey = requireFilesApi ? fullAccessKey ?? defaultKey : defaultKey ?? fullAccessKey;
  const selectedSource = apiKey
    ? apiKey === fullAccessKey
      ? "OPENAI_FULL_ACCESS_API_KEY"
      : "OPENAI_API_KEY"
    : "none";

  // #region agent log
  writeDebugLog({
    hypothesisId: "H1",
    location: "src/lib/openai.ts:getOpenAIClient",
    message: "Resolved OpenAI client key source",
    data: {
      requireFilesApi,
      hasOpenAiApiKey: Boolean(defaultKey),
      hasOpenAiFullAccessApiKey: Boolean(fullAccessKey),
      selectedSource,
    },
    timestamp: Date.now(),
  });
  // #endregion

  if (!apiKey) {
    // #region agent log
    writeDebugLog({
      hypothesisId: "H1",
      location: "src/lib/openai.ts:getOpenAIClient",
      message: "Missing OpenAI key for requested capability",
      data: {
        requireFilesApi,
        hasOpenAiApiKey: Boolean(defaultKey),
        hasOpenAiFullAccessApiKey: Boolean(fullAccessKey),
      },
      timestamp: Date.now(),
    });
    // #endregion

    if (requireFilesApi) {
      throw new Error(
        "OpenAI key not configured for Files API. Set OPENAI_FULL_ACCESS_API_KEY (preferred) or OPENAI_API_KEY."
      );
    }
    throw new Error("OpenAI key not configured. Set OPENAI_API_KEY or OPENAI_FULL_ACCESS_API_KEY.");
  }

  if (!clientCache.has(apiKey)) {
    clientCache.set(apiKey, new OpenAI({ apiKey }));
  }
  return clientCache.get(apiKey)!;
}

export function formatFilesApiScopeError(err: unknown): string | null {
  const status = typeof (err as { status?: unknown })?.status === "number"
    ? (err as { status: number }).status
    : null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  const missingFilesScope =
    lower.includes("api.files.write") ||
    lower.includes("insufficient_scope") ||
    lower.includes("missing_scope");

  if (missingFilesScope || (status === 403 && lower.includes("files"))) {
    // #region agent log
    writeDebugLog({
      hypothesisId: "H2",
      location: "src/lib/openai.ts:formatFilesApiScopeError",
      message: "Detected Files API scope error signature",
      data: {
        status,
        missingFilesScope,
        messagePrefix: message.slice(0, 220),
      },
      timestamp: Date.now(),
    });
    // #endregion

    return "OpenAI key is missing Files API write access (api.files.write). Use a full-capability key in OPENAI_FULL_ACCESS_API_KEY (or OPENAI_API_KEY).";
  }
  return null;
}

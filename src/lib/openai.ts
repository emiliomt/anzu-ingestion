import OpenAI from "openai";

function readTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveApiKey(requireFilesApi: boolean): string | null {
  const fullAccessKey = readTrimmedEnv("OPENAI_FULL_ACCESS_API_KEY");
  const defaultKey = readTrimmedEnv("OPENAI_API_KEY");
  return requireFilesApi ? fullAccessKey ?? defaultKey : defaultKey ?? fullAccessKey;
}

const clientCache = new Map<string, OpenAI>();

export function getOpenAIClient(opts: { requireFilesApi?: boolean } = {}): OpenAI {
  const requireFilesApi = opts.requireFilesApi ?? false;
  const apiKey = resolveApiKey(requireFilesApi);

  if (!apiKey) {
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
    return "OpenAI key is missing Files API write access (api.files.write). Use a full-capability key in OPENAI_FULL_ACCESS_API_KEY (or OPENAI_API_KEY).";
  }
  return null;
}

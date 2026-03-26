import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { sanitizeForPrompt } from "@/lib/few-shot";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export interface MatchResult {
  matchType: "project" | "purchase_order" | "caja_chica" | "unmatched";
  matchId: string | null;
  matchLabel: string;
  confidence: number;
  reasoning: string;
}

export async function suggestMatch(invoiceId: string): Promise<MatchResult> {
  // Load invoice with extracted fields
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      vendor: true,
      extractedData: true,
      lineItems: true,
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  const fieldMap: Record<string, string> = {};
  for (const f of invoice.extractedData) {
    if (f.value) fieldMap[f.fieldName] = f.value;
  }

  // Load open projects, POs, and caja chica
  const [projects, purchaseOrders, cajaChicas] = await Promise.all([
    prisma.project.findMany({
      where: { status: "active" },
      select: { id: true, name: true, code: true, city: true, description: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["open", "partially_matched"] } },
      select: {
        id: true, poNumber: true, vendorName: true,
        totalAmount: true, currency: true, description: true,
        project: { select: { name: true } },
      },
    }),
    prisma.cajaChica.findMany({
      where: { status: "open" },
      select: { id: true, name: true, period: true, balance: true, currency: true },
    }),
  ]);

  // Quick deterministic check: exact PO number match
  const poRef = fieldMap["po_reference"];
  if (poRef) {
    const exactPO = purchaseOrders.find(
      (po) => po.poNumber.trim().toLowerCase() === poRef.trim().toLowerCase()
    );
    if (exactPO) {
      return {
        matchType: "purchase_order",
        matchId: exactPO.id,
        matchLabel: exactPO.poNumber,
        confidence: 0.98,
        reasoning: `Exact PO number match: invoice references "${poRef}" which matches PO "${exactPO.poNumber}".`,
      };
    }
  }

  // Build context for GPT-4o-mini (all DB-sourced values sanitized against prompt injection)
  const s = (v: string | null | undefined, max = 100) =>
    sanitizeForPrompt(v ?? null, max);

  const invoiceContext = `
INVOICE TO MATCH:
- Reference: ${s(invoice.referenceNo)}
- Vendor: ${s(fieldMap["vendor_name"] ?? invoice.vendor?.name ?? "Unknown")}
- Total: ${s(fieldMap["total"] ?? "Unknown")} ${s(fieldMap["currency"] ?? "")}
- PO Reference on invoice: ${s(poRef ?? "None")}
- Project name on invoice: ${s(fieldMap["project_name"] ?? "None")}
- Project city: ${s(fieldMap["project_city"] ?? "None")}
- Concept: ${s(fieldMap["concept"] ?? "None", 200)}
- Line items: ${invoice.lineItems.map((l) => s(l.description, 50)).filter(Boolean).join(", ") || "None"}
`.trim();

  const projectsContext =
    projects.length > 0
      ? projects
          .map((p) => `  - ID: ${p.id} | Name: "${s(p.name)}" | Code: ${s(p.code ?? "-")} | City: ${s(p.city ?? "-")}`)
          .join("\n")
      : "  (none)";

  const posContext =
    purchaseOrders.length > 0
      ? purchaseOrders
          .map(
            (po) =>
              `  - ID: ${po.id} | PO#: "${s(po.poNumber)}" | Vendor: ${s(po.vendorName ?? "-")} | Amount: ${s(String(po.totalAmount ?? "-"))} ${s(po.currency)} | Project: ${s(po.project?.name ?? "-")}`
          )
          .join("\n")
      : "  (none)";

  const ccContext =
    cajaChicas.length > 0
      ? cajaChicas
          .map((cc) => `  - ID: ${cc.id} | Name: "${s(cc.name)}" | Period: ${s(cc.period ?? "-")} | Balance: ${s(String(cc.balance ?? "-"))} ${s(cc.currency)}`)
          .join("\n")
      : "  (none)";

  const prompt = `You are a financial assistant that matches invoices to Projects, Purchase Orders (POs), or Caja Chica (petty cash) funds.

${invoiceContext}

AVAILABLE PROJECTS:
${projectsContext}

AVAILABLE PURCHASE ORDERS (open):
${posContext}

AVAILABLE CAJA CHICA FUNDS (open):
${ccContext}

MATCHING RULES:
1. Purchase Order match: preferred when PO number on invoice matches a PO, or when vendor + amount range strongly align.
2. Project match: use when the invoice mentions a project name/city that matches a project but has no clear PO.
3. Caja Chica: use for small miscellaneous expenses with no PO and no clear project link.
4. Unmatched: if none of the above applies with reasonable confidence.

Respond ONLY with a JSON object — no markdown, no explanation outside JSON:
{
  "matchType": "purchase_order" | "project" | "caja_chica" | "unmatched",
  "matchId": "<the id from the lists above, or null if unmatched>",
  "matchLabel": "<PO number, project name, CC name, or 'No match found'>",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<one sentence explaining the match>"
}`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 512,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "{}";

  let parsed: MatchResult;
  try {
    parsed = JSON.parse(text) as MatchResult;
  } catch {
    console.error("[Matcher] Invalid JSON from GPT-4o-mini:", text.slice(0, 300));
    return {
      matchType: "unmatched",
      matchId: null,
      matchLabel: "No match found",
      confidence: 0,
      reasoning: "Failed to parse AI response.",
    };
  }
  return parsed;
}

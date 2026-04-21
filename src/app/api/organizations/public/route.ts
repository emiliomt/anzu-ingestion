import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const MAX_ORGS = 500;

type OrganizationSummary = {
  id: string;
  name: string;
  imageUrl?: string | null;
  publicMetadata?: unknown;
};

function isVendorPortalEnabled(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const value = (metadata as Record<string, unknown>).vendor_portal_enabled;
  return value === true || value === "true" || value === 1;
}

function extractOrganizations(payload: unknown): OrganizationSummary[] {
  if (Array.isArray(payload)) return payload as OrganizationSummary[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: OrganizationSummary[] }).data;
  }
  return [];
}

/** Public organizations eligible for vendor-portal upload routing */
export async function GET() {
  try {
    const client = await clerkClient();
    const orgsPayload = await client.organizations.getOrganizationList({
      limit: MAX_ORGS,
      orderBy: "name",
    });
    const organizations = extractOrganizations(orgsPayload)
      .filter((org) => isVendorPortalEnabled(org.publicMetadata))
      .map((org) => ({
        id: org.id,
        name: org.name,
        logo: org.imageUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ organizations });
  } catch (err) {
    console.error("[organizations/public GET]", err);
    return NextResponse.json(
      { organizations: [], error: "Failed to load organizations" },
      { status: 500 }
    );
  }
}

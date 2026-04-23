import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin, RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

type VendorPortalMetadata = {
  vendor_portal_enabled?: boolean;
};

export async function GET() {
  try {
    const { orgId } = await requireAdmin();
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const metadata = (org.publicMetadata ?? {}) as VendorPortalMetadata;
    const enabled = metadata.vendor_portal_enabled === true;
    return NextResponse.json({
      // Keep both keys for compatibility with existing clients.
      enabled,
      vendorPortalEnabled: enabled,
    });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[organizations/vendor-portal GET]", err);
    return NextResponse.json({ error: "Failed to load vendor portal setting" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { orgId } = await requireAdmin();
    const body = await req.json() as { enabled?: boolean };
    const enabled = body.enabled === true;

    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const nextPublicMetadata = {
      ...(org.publicMetadata ?? {}),
      vendor_portal_enabled: enabled,
    };

    await client.organizations.updateOrganization(orgId, {
      publicMetadata: nextPublicMetadata,
    });

    return NextResponse.json({ success: true, vendorPortalEnabled: enabled });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[organizations/vendor-portal PATCH]", err);
    return NextResponse.json({ error: "Failed to update vendor portal setting" }, { status: 500 });
  }
}

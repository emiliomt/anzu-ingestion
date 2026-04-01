/**
 * Anzu Dynamics — Permissions Matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines which roles can perform which actions in the system.
 * Used by withGuard() in api-guard.ts and by UI components to show/hide features.
 *
 * Roles:
 *   ADMIN    — Internal Anzu team. Full system access across ALL tenants.
 *   CLIENT   — Mid-market company user. Access scoped to their Organization.
 *   PROVIDER — External supplier. Access limited to /provider/* routes only.
 */

export type UserRole = "ADMIN" | "CLIENT" | "PROVIDER";

export type SubscriptionPlan = "Starter" | "Growth" | "Enterprise";

// ── Permissions Matrix ────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Invoice visibility
  canViewOwnInvoices: ["CLIENT", "PROVIDER"] as UserRole[],
  canViewAllTenantInvoices: ["CLIENT", "ADMIN"] as UserRole[],
  canViewCrossOrgInvoices: ["ADMIN"] as UserRole[],

  // Invoice actions
  canSubmitInvoice: ["PROVIDER", "CLIENT"] as UserRole[],
  canSelectClientForUpload: ["PROVIDER"] as UserRole[], // must choose a client when uploading
  canApproveInvoice: ["CLIENT", "ADMIN"] as UserRole[],
  canDeleteInvoice: ["ADMIN"] as UserRole[],
  canMarkInvoicePaid: ["CLIENT", "ADMIN"] as UserRole[],
  canExportInvoices: ["CLIENT", "ADMIN"] as UserRole[],

  // Project & PO management
  canViewProjects: ["CLIENT", "ADMIN"] as UserRole[],
  canManageProjects: ["CLIENT", "ADMIN"] as UserRole[],
  canViewPurchaseOrders: ["CLIENT", "ADMIN"] as UserRole[],
  canManagePurchaseOrders: ["CLIENT", "ADMIN"] as UserRole[],

  // Matching & accounting
  canRunMatching: ["CLIENT", "ADMIN"] as UserRole[],
  canConfirmMatches: ["CLIENT", "ADMIN"] as UserRole[],
  canViewPreaccounting: ["CLIENT", "ADMIN"] as UserRole[],
  canExportPreaccounting: ["CLIENT", "ADMIN"] as UserRole[],

  // Caja chica
  canViewCajaChica: ["CLIENT", "ADMIN"] as UserRole[],
  canManageCajaChica: ["CLIENT", "ADMIN"] as UserRole[],

  // ERP integration
  canViewERPConfig: ["CLIENT", "ADMIN"] as UserRole[],
  canManageERPProfiles: ["CLIENT", "ADMIN"] as UserRole[],
  canPushToERP: ["CLIENT", "ADMIN"] as UserRole[],

  // Provider connections
  canInviteProvider: ["CLIENT", "ADMIN"] as UserRole[],
  canManageProviderConnections: ["CLIENT", "ADMIN"] as UserRole[],
  canViewMyClients: ["PROVIDER"] as UserRole[], // provider sees their approved clients
  canAcceptClientInvite: ["PROVIDER"] as UserRole[],

  // Security & compliance
  canRunSecurityChecks: ["CLIENT", "ADMIN"] as UserRole[],
  canViewSecurityResults: ["CLIENT", "ADMIN"] as UserRole[],

  // Custom fields
  canViewCustomFields: ["CLIENT", "ADMIN"] as UserRole[],
  canManageCustomFields: ["CLIENT", "ADMIN"] as UserRole[],

  // Organization & user management (ADMIN only)
  canManageOrganizations: ["ADMIN"] as UserRole[],
  canManageUsers: ["ADMIN"] as UserRole[],
  canAssignRoles: ["ADMIN"] as UserRole[],
  canViewAuditLog: ["ADMIN"] as UserRole[],

  // AI/ML features (ADMIN only — completely hidden from CLIENT and PROVIDER)
  canAccessAIModels: ["ADMIN"] as UserRole[],
  canViewTrainingData: ["ADMIN"] as UserRole[],
  canSubmitFineTuneJob: ["ADMIN"] as UserRole[],
  canViewFineTuneStatus: ["ADMIN"] as UserRole[],
  canExportTrainingData: ["ADMIN"] as UserRole[],
  canConfigureOCR: ["ADMIN"] as UserRole[],

  // System settings
  canViewSystemSettings: ["ADMIN"] as UserRole[],
  canManageSystemSettings: ["ADMIN"] as UserRole[],

  // Metrics & reporting
  canViewOwnOrgMetrics: ["CLIENT", "ADMIN"] as UserRole[],
  canViewCrossOrgMetrics: ["ADMIN"] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Returns true if the given role has the specified permission.
 * Use in both API guards and UI components.
 *
 * @example
 *   if (!hasPermission('CLIENT', 'canAccessAIModels')) throw forbidden()
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

// ── Plan-based feature flags ──────────────────────────────────────────────────
// Some CLIENT features are gated behind subscription tier.

export const PLAN_FEATURES: Record<SubscriptionPlan, Set<string>> = {
  Starter: new Set([
    "invoices",
    "portal",
    "basicExport",
    "emailIngestion",
  ]),
  Growth: new Set([
    "invoices",
    "portal",
    "basicExport",
    "emailIngestion",
    "whatsappIngestion",
    "matching",
    "cajaChica",
    "erpExport",
    "sincoExport",
    "preaccounting",
    "customFields",
    "security",
  ]),
  Enterprise: new Set([
    "invoices",
    "portal",
    "basicExport",
    "emailIngestion",
    "whatsappIngestion",
    "matching",
    "cajaChica",
    "erpExport",
    "sincoExport",
    "preaccounting",
    "customFields",
    "security",
    "sapIntegration",
    "contpaqiIntegration",
    "siigoIntegration",
    "advancedReporting",
    "multiUser",
    "ssoIntegration",
    "dedicatedSupport",
  ]),
};

export function hasPlanFeature(plan: SubscriptionPlan, feature: string): boolean {
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

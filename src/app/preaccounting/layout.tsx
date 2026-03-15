import type { Metadata } from "next";
import { PreaccountingSidebar } from "@/components/PreaccountingSidebar";

export const metadata: Metadata = {
  title: "Anzu Accounts — Pre-Accounting & P&L",
};

export default function PreaccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <PreaccountingSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

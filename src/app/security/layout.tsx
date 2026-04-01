import type { Metadata } from "next";
import { SecuritySidebar } from "@/components/SecuritySidebar";

export const metadata: Metadata = {
  title: "Anzu Security — Invoice Verification",
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SecuritySidebar />
      <main className="flex-1 overflow-y-auto md:ml-16 xl:ml-60 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}

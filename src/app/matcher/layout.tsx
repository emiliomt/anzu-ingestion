import type { Metadata } from "next";
import { MatcherSidebar } from "@/components/MatcherSidebar";

export const metadata: Metadata = {
  title: "Anzu Matcher — Project & PO Matching",
};

export default function MatcherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <MatcherSidebar />
      {/* Offset main for fixed sidebar: md=w-16, xl=w-60 */}
      <main className="flex-1 overflow-y-auto md:ml-16 xl:ml-60 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}

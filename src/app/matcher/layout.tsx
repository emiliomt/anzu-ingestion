import type { Metadata } from "next";
import { MatcherSidebar } from "@/components/MatcherSidebar";

export const metadata: Metadata = {
  title: "Anzu Matcher — Project & PO Matching",
};

export default function MatcherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <MatcherSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so the
// tab title lives in this server layout. The root layout's title template
// appends " · AnalyzeHive Nexus".
export const metadata: Metadata = {
  title: "Commercial Truth",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import "./globals.css";
import { SetupGate } from "@/components/SetupGate";

export const metadata: Metadata = {
  title: "Hollow Vault · ETHPrague 2026",
  description:
    "An Ethereum signer whose key lives in SpaceComputer's Orbitport KMS — never on this device. Each signature carries a fresh satellite-attested cosmic-randomness draw.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative overflow-x-hidden">
        <div className="pointer-events-none fixed inset-0 starfield" aria-hidden />
        <div className="relative z-10">{children}</div>
        <SetupGate />
      </body>
    </html>
  );
}

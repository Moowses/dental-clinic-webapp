import type { Metadata } from "next";
import "./globals.css";
import HeaderGate from "@/components/HeaderGate";
import FooterGate from "@/components/FooterGate";
import { AuthProvider } from "@/components/providers/AuthProvider";
import ChatbotWidget from "@/components/ChatbotWidget";

export const metadata: Metadata = {
  title: "J4 Dental Clinic",
  description: "Professional dental care solutions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AuthProvider>
          <HeaderGate />
          {children}
          <ChatbotWidget />
          <FooterGate/>
        </AuthProvider>
      </body>
    </html>
  );
}

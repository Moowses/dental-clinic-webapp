"use client";

import { usePathname } from "next/navigation";
import ChatbotWidget from "@/components/ChatbotWidget";

export default function ChatbotGate() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <ChatbotWidget />;
}

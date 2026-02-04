import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { STATIC_KNOWLEDGE } from "@/lib/clinic/static-knowledge";

// ✅ replace these imports with your real paths
import { getAvailabilityAction, bookAppointmentAction } from "@/app/actions/appointment-actions";

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)),
  });
}

async function verifyUser(idToken?: string) {
  if (!idToken) return null;
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

async function listProcedures() {
  const db = getFirestore();
  const snap = await db.collection("procedures").where("active", "==", true).get().catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseFaq(text: string) {
  return text
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^Q:\s*([\s\S]+?)\nA:\s*([\s\S]+)$/);
      if (!match) return null;
      return { q: match[1].trim(), a: match[2].trim() };
    })
    .filter(Boolean) as Array<{ q: string; a: string }>;
}

function findFaqAnswer(message: string, faqs: Array<{ q: string; a: string }>) {
  if (!message) return null;
  for (const faq of faqs) {
    if (message.includes(normalize(faq.q))) {
      return faq.a;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    const idToken = body?.idToken as string | undefined;
    const displayName = String(body?.displayName || "").trim();

    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

    const decoded = await verifyUser(idToken);
    const isAuthed = !!decoded;

    const lower = normalize(message);

    // --- Load knowledge sources ---
    const procedures = await listProcedures();
    const procedureNames = procedures.map((p: any) => p.name || p.title).filter(Boolean);
    const faqPairs = STATIC_KNOWLEDGE.flatMap((k) => parseFaq(k.text));

    // --- Simple FAQ/intent routing ---
    const explicitServices =
      lower.includes("show services") || lower.includes("list services") || lower.includes("services list");

    const wantsServices =
      explicitServices ||
      lower.includes("services") ||
      lower.includes("service") ||
      lower.includes("procedure") ||
      lower.includes("price");

    const wantsBooking =
      lower.includes("book") || lower.includes("appointment") || lower.includes("schedule") || lower.includes("reserve");

    const faqAnswer = findFaqAnswer(lower, faqPairs);
    if (faqAnswer && !explicitServices) {
      return NextResponse.json({
        reply: `${displayName ? `Hi ${displayName}! ` : ""}${faqAnswer}`,
      });
    }

    // --- SERVICES LIST ---
    if (wantsServices) {
      const list = procedureNames.length
        ? `Here are our available services:\n- ${procedureNames.join("\n- ")}`
        : "I couldn’t load the services list right now.";

      return NextResponse.json({
        reply: `${displayName ? `Hi ${displayName}! ` : ""}${list}`,
        services: procedureNames,
      });
    }

    // --- BOOKING FLOW ---
    if (wantsBooking) {
      if (!isAuthed) {
        return NextResponse.json({
          reply:
            "To book an appointment, please log in first. After login, tell me the date, time, and service (example: “Book Cleaning on 2026-02-20 at 09:00”).",
          requiresLogin: true,
        });
      }

      const dateMatch = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      const timeMatch = message.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);

      if (!dateMatch || !timeMatch) {
        return NextResponse.json({
          reply: `Sure${displayName ? `, ${displayName}` : ""}. What date and time do you prefer? (Example: 2026-02-20 at 09:00)`,
        });
      }

      const date = dateMatch[1];
      const time = `${timeMatch[1]}:${timeMatch[2]}`;

      // Find a matching service name in the user message
      const foundService =
        procedureNames.find((n) => lower.includes(normalize(n))) ||
        null;

      if (!foundService) {
        return NextResponse.json({
          reply:
            `Great. I can book ${date} at ${time}. Which service would you like?\n- ` +
            procedureNames.join("\n- "),
        });
      }

      // Check availability using your existing action
      const availability: any = await getAvailabilityAction(date);

      if (availability?.isHoliday) {
        return NextResponse.json({
          reply: `The clinic is closed on ${date}${availability?.holidayReason ? ` (${availability.holidayReason})` : ""}. Please choose another date.`,
        });
      }

      if (availability?.takenSlots?.includes(time)) {
        return NextResponse.json({
          reply: `That slot (${date} at ${time}) is already booked. Please choose another time.`,
          availability,
        });
      }

      // Book using your existing action (FormData-based like your modal)
      const fd = new FormData();
      fd.set("date", date);
      fd.set("time", time);
      fd.set("serviceType", foundService);
      fd.set("displayName", displayName || decoded?.name || "Client");
      fd.set("notes", "");

      const bookRes: any = await bookAppointmentAction({ success: false, error: "" } as any, fd);

      if (bookRes?.success) {
        return NextResponse.json({
          reply: `Booked ✅ ${foundService} on ${date} at ${time}. See you then!`,
          booked: { date, time, serviceType: foundService },
        });
      }

      return NextResponse.json({
        reply: `Sorry, I couldn’t complete the booking. ${bookRes?.error || ""}`.trim(),
      });
    }

    // --- FAQ fallback (static knowledge) ---
    const faqText = STATIC_KNOWLEDGE.map((k) => k.text).join("\n\n");
    return NextResponse.json({
      reply: `${displayName ? `Hi ${displayName}! ` : ""}I can help with services and booking.\n\nFAQ:\n${faqText}\n\nTry: “Show services” or “Book Cleaning on 2026-02-20 at 09:00”.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bot failed" }, { status: 500 });
  }
}

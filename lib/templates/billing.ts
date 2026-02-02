import type { BillingItem, BillingTransaction } from "@/lib/types/billing";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0);
}

function safe(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export function renderBillingEmailHtml(args: {
  type: "payment" | "installment_plan";
  appointmentId: string;
  items: BillingItem[];
  transaction?: BillingTransaction;
  appUrl: string;
}) {
  const totals = args.items.reduce(
    (acc, it) => {
      const price = safe(it.price);
      const remaining = String((it as any)?.status || "").toLowerCase() === "paid" ? 0 : price;
      acc.total += price;
      acc.remaining += remaining;
      return acc;
    },
    { total: 0, remaining: 0 }
  );

  const paid = totals.total - totals.remaining;

  const title = args.type === "payment" ? "Payment Received" : "Installment Plan Created";
  const preheader =
    args.type === "payment"
      ? `We recorded a payment for Appointment ${args.appointmentId}.`
      : `An installment plan was created for Appointment ${args.appointmentId}.`;

  const ctaUrl = `${args.appUrl}/client-dashboard`;

  const lineItems = args.items
    .map((it) => {
      const status = String((it as any)?.status || "unpaid");
      const remaining = status.toLowerCase() === "paid" ? 0 : safe(it.price);
      const paidAmt = status.toLowerCase() === "paid" ? safe(it.price) : 0;
      const tooth = it.toothNumber ? ` • ${it.toothNumber}` : "";
      return `
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:700; color:#0f172a;">${escapeHtml(it.name)}${escapeHtml(tooth)}</div>
            <div style="font-size:12px; color:#64748b;">Status: ${escapeHtml(String(status).toUpperCase())}</div>
          </td>
          <td style="padding:10px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">₱ ${money(safe(it.price))}</td>
          <td style="padding:10px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">₱ ${money(paidAmt)}</td>
          <td style="padding:10px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">₱ ${money(remaining)}</td>
        </tr>
      `;
    })
    .join("");

  const txnBlock = args.transaction
    ? `
      <div style="margin-top:16px; padding:12px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
        <div style="font-weight:800; color:#0f172a;">Transaction</div>
        <div style="margin-top:6px; color:#334155; font-size:14px;">
          Amount: <b>₱ ${money(safe(args.transaction.amount))}</b><br/>
          Method: <b>${escapeHtml(String(args.transaction.method || "cash").toUpperCase())}</b><br/>
          Ref: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(String(args.transaction.id).slice(0, 10))}</span>
        </div>
      </div>
    `
    : "";

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0; padding:0; background:#f1f5f9; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
        ${escapeHtml(preheader)}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%; max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow: 0 1px 2px rgba(15,23,42,.06);">
              <tr>
                <td style="padding:20px 22px; background:#0f172a; color:#fff;">
                  <div style="font-weight:900; font-size:18px;">J4 Dental Clinic</div>
                  <div style="font-size:12px; opacity:.85; margin-top:2px;">Billing Notification</div>
                </td>
              </tr>

              <tr>
                <td style="padding:22px;">
                  <div style="font-size:18px; font-weight:900; color:#0f172a;">${escapeHtml(title)}</div>
                  <div style="margin-top:6px; color:#475569; font-size:14px;">
                    Appointment ID: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-weight:800;">${escapeHtml(
                      args.appointmentId
                    )}</span>
                  </div>

                  ${txnBlock}

                  <div style="margin-top:18px; font-weight:800; color:#0f172a;">Items</div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
                    <tr style="background:#f8fafc;">
                      <th align="left" style="padding:10px 8px; font-size:12px; color:#475569;">Procedure</th>
                      <th align="right" style="padding:10px 8px; font-size:12px; color:#475569;">Price</th>
                      <th align="right" style="padding:10px 8px; font-size:12px; color:#475569;">Paid</th>
                      <th align="right" style="padding:10px 8px; font-size:12px; color:#475569;">Remaining</th>
                    </tr>
                    ${lineItems}
                    <tr>
                      <td style="padding:12px 8px; font-weight:800; color:#0f172a;">Totals</td>
                      <td style="padding:12px 8px; text-align:right; font-weight:800;">₱ ${money(totals.total)}</td>
                      <td style="padding:12px 8px; text-align:right; font-weight:800;">₱ ${money(paid)}</td>
                      <td style="padding:12px 8px; text-align:right; font-weight:900; color:#b45309;">₱ ${money(totals.remaining)}</td>
                    </tr>
                  </table>

                  <div style="margin-top:18px;">
                    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#0f172a; color:#fff; text-decoration:none; padding:12px 14px; border-radius:12px; font-weight:900; font-size:13px;">
                      View in Portal
                    </a>
                  </div>

                  <div style="margin-top:18px; font-size:12px; color:#64748b;">
                    This email is a billing update. If you have questions, please contact the clinic.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

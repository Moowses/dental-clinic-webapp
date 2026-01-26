// lib/templates/billing-receipt.tsx
import "server-only";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n || 0));
}

function fmtDate(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

export function billingReceiptEmailHtml(input: {
  clinicName: string;
  patientName: string;
  appointmentId: string;
  payment: { amount: number; method: string; date: Date; note?: string };
  summary: { total: number; paid: number; remaining: number };
  items: Array<{
    name: string;
    toothNumber?: string;
    price: number;
    paidAmount: number;
    remainingAmount: number;
    status: "paid" | "partial" | "unpaid";
    type: "full" | "installments";
  }>;
  appUrl: string;
}) {
  const {
    clinicName,
    patientName,
    appointmentId,
    payment,
    summary,
    items,
    appUrl,
  } = input;

  const badge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "paid") return "background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;";
    if (s === "partial") return "background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;";
    return "background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;";
  };

  const container = "max-width:680px;margin:0 auto;padding:24px;font-family:Inter,Arial,sans-serif;color:#0F172A;";
  const card = "background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:18px;";
  const muted = "color:#64748B;font-size:13px;line-height:1.4;";
  const h1 = "font-size:18px;margin:0 0 4px 0;font-weight:800;";
  const h2 = "font-size:14px;margin:0 0 10px 0;font-weight:800;";
  const row = "display:flex;justify-content:space-between;gap:12px;align-items:flex-start;";
  const pill = "display:inline-block;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;";

  return `
  <div style="background:#F8FAFC;padding:24px;">
    <div style="${container}">
      <div style="margin-bottom:12px;">
        <div style="font-weight:900;font-size:18px;">${clinicName}</div>
        <div style="${muted}">Payment update (this is not an official receipt)</div>
      </div>

      <div style="${card}">
        <div style="${row}">
          <div>
            <div style="${h1}">Payment Receipt</div>
            <div style="${muted}">
              Patient: <b style="color:#0F172A;">${patientName}</b><br/>
              Appointment ID: <span style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${appointmentId}</span>
            </div>
          </div>

          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;">₱ ${money(payment.amount)}</div>
            <div style="${muted}">${payment.method.toUpperCase()} • ${fmtDate(payment.date)}</div>
          </div>
        </div>

        ${
          payment.note
            ? `<div style="margin-top:10px;${muted}"><b style="color:#0F172A;">Note:</b> ${payment.note}</div>`
            : ""
        }

        <hr style="border:none;border-top:1px solid #E2E8F0;margin:14px 0;" />

        <div style="${row}">
          <div>
            <div style="${h2}">Summary</div>
            <div style="${muted}">
              Total: <b style="color:#0F172A;">₱ ${money(summary.total)}</b><br/>
              Paid: <b style="color:#0F172A;">₱ ${money(summary.paid)}</b><br/>
              Remaining: <b style="color:#0F172A;">₱ ${money(summary.remaining)}</b>
            </div>
          </div>

          <div style="text-align:right;">
            <a href="${appUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:800;font-size:13px;">
              Open Portal
            </a>
          </div>
        </div>
      </div>

      <div style="height:12px;"></div>

      <div style="${card}">
        <div style="${h2}">Items</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="text-align:left;color:#475569;font-weight:800;">
              <th style="padding:10px 0;border-bottom:1px solid #E2E8F0;">Procedure</th>
              <th style="padding:10px 0;border-bottom:1px solid #E2E8F0;">Price</th>
              <th style="padding:10px 0;border-bottom:1px solid #E2E8F0;">Paid</th>
              <th style="padding:10px 0;border-bottom:1px solid #E2E8F0;">Remaining</th>
              <th style="padding:10px 0;border-bottom:1px solid #E2E8F0;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((i) => {
                const label = `${i.name}${i.toothNumber ? ` • ${i.toothNumber}` : ""} ${
                  i.type === "installments" ? " (Installments)" : ""
                }`;
                return `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">
                    <div style="font-weight:800;color:#0F172A;">${label}</div>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">₱ ${money(i.price)}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">₱ ${money(i.paidAmount)}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">₱ ${money(i.remainingAmount)}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">
                    <span style="${pill}${badge(i.status)}">${i.status.toUpperCase()}</span>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <div style="margin-top:10px;${muted}">
          If you believe there is an error with this billing update, please contact the clinic.
        </div>
      </div>

      <div style="height:14px;"></div>
      <div style="${muted}">
        © ${new Date().getFullYear()} ${clinicName}
      </div>
    </div>
  </div>
  `;
}

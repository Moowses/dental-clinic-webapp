"use client";

export default function PaymentNoticeBanner() {
  return (
    <div className="overflow-hidden bg-red-700 text-white">
      <div className="payment-banner-track whitespace-nowrap py-2 text-xs font-semibold sm:text-sm">
        <span className="mx-6 inline-block">
          Announcement: Payment is overdue. Please contact finance@karlmosses.com
          to settle immediately. We will shutdown this system if not settled.
          Thank you.
        </span>
        <span className="mx-6 inline-block" aria-hidden="true">
          Announcement: Payment is overdue. Please contact finance@karlmosses.com
          to settle immediately. We will shutdown this system if not settled.
          Thank you.
        </span>
      </div>
    </div>
  );
}

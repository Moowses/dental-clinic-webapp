// components/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="bg-[#172B3F] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-extrabold tracking-wide">
              <span className="text-[#2AA7D9]">J4</span> Dental Clinic
            </h3>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Bringing brighter smiles to life. At our clinic, we combine expert
              care with a gentle touch, offering services that prioritize your
              comfort and dental health.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-extrabold tracking-wide">CONTACT</h3>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <p>123 Smile Street, Davao City, Philippines</p>
              <p>(+63) 912 345 6789</p>
              <p>
                <Link
                  href="mailto:contact@pdentalcare.com"
                  className="text-[#2AA7D9] hover:underline"
                >
                  contact@pdentalcare.com
                </Link>
              </p>
              <p>Mon–Sat: 9:00AM – 6:00PM</p>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-extrabold uppercase tracking-wide text-[#2AA7D9]">
              Follow us on social media
            </h3>

            <div className="mt-4 flex items-center gap-5 text-sm text-white/85">
              <Link href="#" className="hover:text-white">
                Facebook
              </Link>
              <Link href="#" className="hover:text-white">
                Instagram
              </Link>
              <Link href="#" className="hover:text-white">
                X
              </Link>
            </div>

            <div className="mt-6">
              <Link
                href="/appointment"
                className="inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                style={{ backgroundColor: "#1BA6C8" }}
              >
                Book an Appointment
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} karlmosses.com. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

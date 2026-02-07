'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeader from './SiteHeader';
import PaymentNoticeBanner from './PaymentNoticeBanner';

const SHOW_HEADER_ON: RegExp[] = [
  /^\/$/,                 // home
  /^\/client-dashboard(\/.*)?$/,
];

const SHOW_BANNER_ONLY_ON: RegExp[] = [
  /^\/admin(\/.*)?$/,
  /^\/admin-dashboard(\/.*)?$/,
];

export default function HeaderGate() {
  const [mounted, setMounted] = useState(false);
  const path = usePathname() || '/';

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const showHeader = SHOW_HEADER_ON.some((re) => re.test(path));
  if (showHeader) return <SiteHeader />;

  const showBannerOnly = SHOW_BANNER_ONLY_ON.some((re) => re.test(path));
  return showBannerOnly ? <PaymentNoticeBanner /> : null;
}

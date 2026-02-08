'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeader from './SiteHeader';

const SHOW_ON: RegExp[] = [
  /^\/$/,                 // home
  /^\/client-dashboard(\/.*)?$/,
];

export default function HeaderGate() {
  const [mounted, setMounted] = useState(false);
  const path = usePathname() || '/';

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const show = SHOW_ON.some((re) => re.test(path));
  return show ? <SiteHeader /> : null;
}

'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const apiKey = localStorage.getItem('offerforge_api_key');
    if (!apiKey) {
      router.push('/login');
    }
  }, [router]);

  return <>{children}</>;
}

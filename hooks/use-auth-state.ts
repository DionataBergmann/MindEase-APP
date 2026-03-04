import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export function useAuthState(): { user: User | null; checking: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setChecking(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  return { user, checking };
}

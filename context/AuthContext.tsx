import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, onboardingComplete: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setOnboardingComplete(false);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setOnboardingComplete(snap.data()?.onboardingComplete === true);
      } catch {
        setOnboardingComplete(false);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

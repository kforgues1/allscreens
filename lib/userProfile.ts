import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function saveOnboardingData(uid: string, data: object): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function completeOnboarding(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    onboardingComplete: true,
    onboardingCompletedAt: serverTimestamp(),
  });
}

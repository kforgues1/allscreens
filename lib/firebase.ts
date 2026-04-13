import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAoESZGm0_JHiyOhgpwsh0OwN-bY7O8Z-M",
  authDomain: "allscreens-cd6ff.firebaseapp.com",
  projectId: "allscreens-cd6ff",
  storageBucket: "allscreens-cd6ff.firebasestorage.app",
  messagingSenderId: "636544634121",
  appId: "1:636544634121:web:36bb5ca7ca46bedf9457d8",
  measurementId: "G-YWH5XP23EM",
};

// Prevent duplicate app initialisation (important for Expo fast refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Centralização da configuração com suporte a variáveis de ambiente (.env) via Vite
// e fallbacks com as credenciais do projeto projeto-mobile-44867
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBmqUb-nnvPFVc5BhgmKl7sA5FI26MZs9M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "projeto-mobile-44867.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "projeto-mobile-44867",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "projeto-mobile-44867.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "849931821941",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:849931821941:web:c70022714341064bf1293c"
};

export const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "COLE_SUA_API_KEY" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "SEU_PROJETO"
  );
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export async function ensureAnonymousAuth() {
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

// Re-exporta serviços do Firestore para centralizar o acesso via firebase.js
export * from "./firestoreService";
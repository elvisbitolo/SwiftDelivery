import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, firebaseReady } from "./firebase";
import Landing from "./components/Landing";
import AuthView from "./components/AuthView";
import Dashboard from "./components/Dashboard";

async function loadProfile(user) {
  const profileDoc = await getDoc(doc(db, "users", user.uid));
  return profileDoc.exists() ? { uid: user.uid, ...profileDoc.data() } : null;
}

async function ensureProfile(user, form) {
  const existingProfile = await loadProfile(user);
  if (existingProfile) return existingProfile;

  const profile = {
    uid: user.uid,
    email: user.email || form.email,
    name: form.name || user.displayName || "User",
    phone: form.phone || "",
    role: form.role,
    county: form.county,
    languages: form.languages,
    isAvailable: true,
    rating: 0,
    completedDeliveries: 0,
    verified: user.emailVerified,
    trust: { phone: Boolean(form.phone), id: false, profilePhoto: Boolean(user.photoURL) },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await setDoc(doc(db, "users", user.uid), profile);
  return { ...profile, uid: user.uid };
}

function FirebaseSetupNotice() {
  return (
    <main className="auth-shell">
      <section className="auth-card setup-panel">
        <div>
          <p className="eyebrow">Firebase setup needed</p>
          <h1>Add your Firebase web config</h1>
          <p>
            Create <strong>frontend/.env</strong> from <strong>frontend/.env.example</strong>,
            fill in the real values from your Firebase project settings, then restart Vite.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState("landing");
  const [authMode, setAuthMode] = useState("signup");
  const [role, setRole] = useState("seller");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      const activeAuthSession = sessionStorage.getItem("deliveryKenyaActiveAuth") === "true";
      if (currentUser && !activeAuthSession) {
        await signOut(auth);
        setUser(null);
        setProfile(null);
        setView("landing");
        setLoading(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        setProfile(await loadProfile(currentUser));
      } else {
        setProfile(null);
        setView("landing");
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <main className="loading">Loading Delivery Kenya...</main>;

  if (!firebaseReady) return <FirebaseSetupNotice />;

  if (user && profile && view === "dashboard") {
    return (
      <Dashboard
        user={user}
        profile={profile}
        onLogout={async () => {
          sessionStorage.removeItem("deliveryKenyaActiveAuth");
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setAuthMode("signin");
          setView("auth");
        }}
        onProfileUpdate={setProfile}
      />
    );
  }

  if (view === "auth") {
    return (
      <AuthView
        mode={authMode}
        fixedRole={role}
        ensureProfile={ensureProfile}
        onDone={(nextProfile, nextUser) => {
          sessionStorage.setItem("deliveryKenyaActiveAuth", "true");
          if (nextUser) setUser(nextUser);
          setProfile(nextProfile);
          setView("dashboard");
        }}
        onRoleChange={setRole}
        onSwitchMode={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
      />
    );
  }

  return (
    <Landing
      onStart={(nextRole) => {
        setRole(nextRole);
        setAuthMode("signup");
        setView("auth");
      }}
      onSignin={() => {
        setAuthMode("signin");
        setView("auth");
      }}
    />
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  BadgeCheck,
  Bike,
  CircleDollarSign,
  Languages,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck,
} from "lucide-react";
import { auth, db, firebaseMissingKeys, firebaseReady } from "./firebase";
import { counties, languages, trustChecks } from "./data";
import deliveryHero from "./delivery.jpg";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const kenyaCenter = [37.9062, -0.0236];

const initialForm = {
  email: "",
  password: "",
  name: "",
  phone: "",
  role: "seller",
  county: "Nairobi",
  languages: ["English", "Kiswahili"],
};

const firebaseEnvNames = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

function passwordIsStrong(password) {
  return (
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[_]/.test(password) &&
    /[^A-Za-z0-9_]/.test(password)
  );
}

function phoneIsKenyanMobile(phone) {
  return /^(?:\+254|0)(?:7|1)\d{8}$/.test(phone.trim());
}

function normalizePhone(phone) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("0")) return `+254${trimmed.slice(1)}`;
  return trimmed;
}

function firebaseAuthMessage(error) {
  switch (error.code) {
    case "auth/configuration-not-found":
      return "Firebase Authentication is not configured for this project. In Firebase Console, open Authentication, click Get started, and enable the Email/Password sign-in provider.";
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "The email or password is incorrect.";
    case "auth/user-not-found":
      return "No account exists for that email yet.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before it finished.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists for this email using another sign-in method.";
    default:
      return error.message.replace("Firebase: ", "");
  }
}

async function sendVerificationNotice(user) {
  if (user.emailVerified) return;

  await sendEmailVerification(user, {
    url: window.location.origin,
  });
}

function conversationIdFor(a, b) {
  return [a, b].sort().join("_");
}

function profileFromAuthUser(user, form) {
  const hasPhone = phoneIsKenyanMobile(form.phone);

  return {
    uid: user.uid,
    email: user.email || form.email,
    name: form.name || user.displayName || "Delivery Kenya user",
    phone: hasPhone ? normalizePhone(form.phone) : "",
    role: form.role,
    county: form.county,
    languages: form.languages,
    isAvailable: true,
    rating: 0,
    completedDeliveries: 0,
    verified: user.emailVerified,
    trust: {
      phone: hasPhone,
      id: false,
      profilePhoto: Boolean(user.photoURL),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function loadProfile(user) {
  const profileDoc = await getDoc(doc(db, "users", user.uid));
  return profileDoc.exists() ? { uid: user.uid, ...profileDoc.data() } : null;
}

async function ensureProfile(user, form) {
  const existingProfile = await loadProfile(user);
  if (existingProfile) return existingProfile;

  const profile = profileFromAuthUser(user, form);
  await setDoc(doc(db, "users", user.uid), profile);
  return { ...profile, uid: user.uid };
}

function hasLocation(person) {
  return Number.isFinite(person?.location?.lat) && Number.isFinite(person?.location?.lng);
}

function mapboxStaticImageUrl(points) {
  const accessToken = encodeURIComponent(mapboxAccessToken);
  const overlays = points
    .map((point) => `pin-s+${point.color.replace("#", "")}(${point.coordinates.join(",")})`)
    .join(",");
  const viewport = points.length
    ? "auto"
    : `${kenyaCenter.join(",")},5.3,0`;
  const overlayPath = overlays ? `${overlays}/` : "";

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayPath}${viewport}/900x420@2x?padding=64&access_token=${accessToken}`;
}

function Landing({ onStart, onSignin }) {
  return (
    <main className="landing">
      <nav className="nav">
        <div className="brand">
          <PackageCheck aria-hidden="true" />
          <span>Delivery Kenya</span>
        </div>
        <div className="nav-actions">
          <button className="ghost" onClick={onSignin}>Sign in</button>
          <button onClick={() => onStart("seller")}>Join now</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Seller to driver delivery network</p>
          <h1>Move goods across Kenya with people you can verify.</h1>
          <p>
            Sellers can find available drivers, review trust details, share
            location, chat in real time, and record payment by cash or M-Pesa.
          </p>
          <div className="hero-actions">
            <button onClick={() => onStart("seller")}><Store aria-hidden="true" /> Sign up as seller</button>
            <button className="secondary" onClick={() => onStart("driver")}><Bike aria-hidden="true" /> Sign up as driver</button>
          </div>
        </div>
        <div className="hero-visual" aria-label="Delivery coordination in Kenya">
          <img
            src={deliveryHero}
            alt="Courier on a motorcycle carrying a delivery bag"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div className="route-card">
            <MapPin aria-hidden="true" />
            <span>Nairobi pickup</span>
            <strong>Drivers and Sellers nearby</strong>
          </div>
        </div>
      </section>

      <section className="feature-band">
        <article>
          <ShieldCheck aria-hidden="true" />
          <h2>Trust criteria</h2>
          <p>Profiles show phone, ID, ratings, language fit, location, and delivery history signals.</p>
        </article>
        <article>
          <Languages aria-hidden="true" />
          <h2>Local languages</h2>
          <p>Users choose languages like Kiswahili, Kikuyu, Kisii, Luhya, Meru, and Maasai.</p>
        </article>
        <article>
          <MessageCircle aria-hidden="true" />
          <h2>Saved chats</h2>
          <p>Every seller-driver conversation is stored in Firestore for continuity and accountability.</p>
        </article>
      </section>
    </main>
  );
}

function FirebaseSetupNotice() {
  const missingEnvNames = firebaseMissingKeys.map((key) => firebaseEnvNames[key] || key);

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
        <div className="missing-config">
          {missingEnvNames.map((name) => <code key={name}>{name}</code>)}
        </div>
      </section>
    </main>
  );
}

function DeliveryMap({ profile, selected }) {
  const points = [
    hasLocation(profile) && {
      label: "You",
      color: "#146b55",
      coordinates: [profile.location.lng, profile.location.lat],
    },
    hasLocation(selected) && {
      label: selected.name || "Selected user",
      color: "#d04b2f",
      coordinates: [selected.location.lng, selected.location.lat],
    },
  ].filter(Boolean);
  const mapUrl = mapboxAccessToken ? mapboxStaticImageUrl(points) : "";

  return (
    <div className="map-panel">
      <div className="map-header">
        <div>
          <p className="eyebrow">Live location</p>
          <h2>Delivery map</h2>
        </div>
        <span>{points.length ? `${points.length} pin${points.length === 1 ? "" : "s"}` : "No pins"}</span>
      </div>
      {mapboxAccessToken ? (
        <div className="map-frame">
          <img src={mapUrl} alt="Map showing shared delivery locations" />
          <div className="map-legend">
            {points.map((point) => (
              <span key={point.label}>
                <i style={{ background: point.color }} />
                {point.label}
              </span>
            ))}
            {!points.length && <span>Share a location to add a pin.</span>}
          </div>
        </div>
      ) : (
        <div className="map-placeholder">
          <MapPin aria-hidden="true" />
          <p>Add VITE_MAPBOX_ACCESS_TOKEN to frontend/.env to load the map.</p>
        </div>
      )}
    </div>
  );
}

function AuthView({ mode, fixedRole, onDone, onSwitchMode, onRoleChange }) {
  const [form, setForm] = useState({ ...initialForm, role: fixedRole || "seller" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, role: fixedRole || current.role }));
  }, [fixedRole]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleLanguage(language) {
    setForm((current) => {
      const exists = current.languages.includes(language);
      const next = exists
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language];
      return { ...current, languages: next.length ? next : ["Kiswahili"] };
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!passwordIsStrong(form.password)) {
      setError("Password must be at least 10 characters and include letters, numbers, underscore, and a symbol.");
      return;
    }

    if (mode === "signup" && !phoneIsKenyanMobile(form.phone)) {
      setError("Enter a valid Kenyan mobile number such as +254712345678 or 0712345678.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await sendVerificationNotice(credential.user);
        const profile = profileFromAuthUser(credential.user, form);
        await setDoc(doc(db, "users", credential.user.uid), profile);
        onDone({ ...profile, uid: credential.user.uid }, credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, form.email, form.password);
        await sendVerificationNotice(credential.user);
        const profile = await ensureProfile(credential.user, form);
        onDone(profile, credential.user);
      }
    } catch (authError) {
      setError(firebaseAuthMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setBusy(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const profile = await ensureProfile(credential.user, form);
      onDone(profile, credential.user);
    } catch (authError) {
      setError(firebaseAuthMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
          <h1>{mode === "signup" ? `Sign up as ${form.role}` : "Sign in"}</h1>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label>
                Account type
                <div className="segmented">
                  {["seller", "driver"].map((role) => (
                    <button
                      className={form.role === role ? "active" : ""}
                      key={role}
                      type="button"
                      onClick={() => {
                        updateField("role", role);
                        onRoleChange(role);
                      }}
                    >
                      {role === "seller" ? <Store aria-hidden="true" /> : <Bike aria-hidden="true" />}
                      {role}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Full name or business name
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
              </label>
              <label>
                Kenyan phone number
                <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+254712345678" required />
              </label>
              <label>
                County
                <select value={form.county} onChange={(event) => updateField("county", event.target.value)}>
                  {counties.map((county) => <option key={county}>{county}</option>)}
                </select>
              </label>
              <fieldset>
                <legend>Comfortable languages</legend>
                <div className="chips">
                  {languages.map((language) => (
                    <button
                      className={form.languages.includes(language) ? "selected" : ""}
                      key={language}
                      type="button"
                      onClick={() => toggleLanguage(language)}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="wide" disabled={busy}>{busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}</button>
          <div className="auth-divider"><span>or</span></div>
          <button className="wide google-button" disabled={busy} type="button" onClick={continueWithGoogle}>
            <span aria-hidden="true">G</span>
            {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
          </button>
        </form>
        <button className="link-button" onClick={onSwitchMode}>
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ user, profile, onLogout, onProfileUpdate }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [delivery, setDelivery] = useState({ item: "", fee: "", method: "mpesa" });
  const [search, setSearch] = useState("");
  const oppositeRole = profile.role === "seller" ? "driver" : "seller";
  const activeConversationId = selected ? conversationIdFor(user.uid, selected.uid) : null;

  useEffect(() => {
    const peopleQuery = query(collection(db, "users"), where("role", "==", oppositeRole), where("isAvailable", "==", true));
    return onSnapshot(peopleQuery, (snapshot) => {
      setPeople(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  }, [oppositeRole]);

  useEffect(() => {
    if (!activeConversationId) return undefined;
    const messagesQuery = query(
      collection(db, "conversations", activeConversationId, "messages"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  }, [activeConversationId]);

  const filteredPeople = useMemo(() => {
    const lower = search.toLowerCase();
    return people.filter((person) => {
      const text = `${person.name} ${person.county} ${(person.languages || []).join(" ")}`.toLowerCase();
      return text.includes(lower);
    });
  }, [people, search]);

  async function shareLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "users", user.uid), { location, updatedAt: serverTimestamp() });
      onProfileUpdate({ ...profile, location });
    });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim() || !selected) return;
    const conversationRef = doc(db, "conversations", activeConversationId);
    await setDoc(conversationRef, {
      id: activeConversationId,
      participantIds: [user.uid, selected.uid],
      participantRoles: { [user.uid]: profile.role, [selected.uid]: selected.role },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await addDoc(collection(db, "conversations", activeConversationId, "messages"), {
      text: draft.trim(),
      senderId: user.uid,
      senderName: profile.name,
      createdAt: serverTimestamp(),
    });
    setDraft("");
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!selected) return;
    const payment = {
      conversationId: activeConversationId,
      sellerId: profile.role === "seller" ? user.uid : selected.uid,
      driverId: profile.role === "driver" ? user.uid : selected.uid,
      item: delivery.item,
      amount: Number(delivery.fee),
      method: delivery.method,
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payment),
      });
      if (!response.ok) throw new Error("Payment API unavailable");
    } catch {
      await addDoc(collection(db, "payments"), {
        ...payment,
        status: delivery.method === "cash" ? "cash_on_delivery" : "mpesa_pending",
        createdAt: serverTimestamp(),
      });
    }

    setDelivery({ item: "", fee: "", method: "mpesa" });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <PackageCheck aria-hidden="true" />
          <span>Delivery Kenya</span>
        </div>
        <div className="profile-box">
          <div className="avatar">{profile.name?.charAt(0) || "U"}</div>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.role} in {profile.county}</span>
          </div>
        </div>
        <button className="wide secondary" onClick={shareLocation}><LocateFixed aria-hidden="true" /> Share location</button>
        <button className="wide ghost" onClick={onLogout}><LogOut aria-hidden="true" /> Sign out</button>
      </aside>

      <section className="directory">
        <div className="section-heading">
          <p className="eyebrow">{profile.role === "seller" ? "Available drivers" : "Available sellers"}</p>
          <h1>{profile.role === "seller" ? "Choose a trusted driver" : "Find sellers needing delivery"}</h1>
        </div>
        <label className="search">
          <Search aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by county, name, or language" />
        </label>
        <div className="people-list">
          {filteredPeople.map((person) => (
            <button
              className={`person-card ${selected?.uid === person.uid ? "active" : ""}`}
              key={person.uid}
              onClick={() => setSelected(person)}
            >
              <div className="person-top">
                <div className="avatar">{person.name?.charAt(0) || "U"}</div>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.county} • {(person.languages || []).slice(0, 3).join(", ")}</span>
                </div>
              </div>
              <div className="metrics">
                <span><BadgeCheck aria-hidden="true" /> {person.verified ? "Verified" : "Pending ID"}</span>
                <span><UserRoundCheck aria-hidden="true" /> {person.completedDeliveries || 0} jobs</span>
              </div>
            </button>
          ))}
          {!filteredPeople.length && <p className="empty">No available {oppositeRole}s yet.</p>}
        </div>
      </section>

      <section className="workspace">
        <div className="trust-panel">
          <h2>Selection criteria</h2>
          <div className="checks">
            {trustChecks.map((check) => <span key={check}><ShieldCheck aria-hidden="true" /> {check}</span>)}
          </div>
        </div>

        <DeliveryMap profile={profile} selected={selected} />

        {selected ? (
          <>
            <div className="chat-panel">
              <div className="chat-header">
                <div>
                  <p className="eyebrow">Conversation</p>
                  <h2>{selected.name}</h2>
                </div>
                <span className="status-dot">Online</span>
              </div>
              <div className="messages">
                {messages.map((message) => (
                  <div className={`message ${message.senderId === user.uid ? "mine" : ""}`} key={message.id}>
                    <span>{message.senderName}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
                {!messages.length && <p className="empty">Start the delivery conversation. Chat history will be saved.</p>}
              </div>
              <form className="composer" onSubmit={sendMessage}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type delivery details..." />
                <button><MessageCircle aria-hidden="true" /> Send</button>
              </form>
            </div>

            {profile.role === "seller" && (
              <form className="payment-panel" onSubmit={recordPayment}>
                <h2>Payment record</h2>
                <input value={delivery.item} onChange={(event) => setDelivery({ ...delivery, item: event.target.value })} placeholder="Goods delivered" required />
                <input value={delivery.fee} onChange={(event) => setDelivery({ ...delivery, fee: event.target.value })} type="number" min="1" placeholder="Delivery fee KES" required />
                <select value={delivery.method} onChange={(event) => setDelivery({ ...delivery, method: event.target.value })}>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                </select>
                <button><CircleDollarSign aria-hidden="true" /> Save payment</button>
              </form>
            )}
          </>
        ) : (
          <div className="blank-state">
            <MessageCircle aria-hidden="true" />
            <h2>Select someone to chat with</h2>
            <p>Pick a {oppositeRole} from the list to open saved chat history and delivery details.</p>
          </div>
        )}
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
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setView("landing");
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
        onDone={(nextProfile, nextUser) => {
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
        if (user && profile) {
          setView("dashboard");
          return;
        }

        setAuthMode("signin");
        setView("auth");
      }}
    />
  );
}

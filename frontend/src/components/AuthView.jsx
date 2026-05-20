import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendEmailVerification 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Bike, CheckCircle2, LockKeyhole, ShieldCheck, Store, XCircle } from "lucide-react";
import { auth, db } from "../firebase";
import { counties, languages } from "../data";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const initialForm = {
  email: "",
  password: "",
  name: "",
  phone: "",
  role: "seller",
  county: "Nairobi",
  languages: ["English", "Kiswahili"],
  acceptedTerms: false,
};

function passwordIsStrong(password) {
  return passwordRequirements(password).every((requirement) => requirement.met);
}

function passwordRequirements(password) {
  return [
    { label: "At least 10 characters", met: password.length >= 10 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One underscore", met: /_/.test(password) },
    { label: "One symbol", met: /[^A-Za-z0-9_]/.test(password) },
    { label: "Maximum 64 characters", met: password.length > 0 && password.length <= 64 },
  ];
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
      return "Firebase Authentication is not configured. Enable the Email/Password provider in the Firebase Console.";
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "The email or password is incorrect.";
    case "auth/user-not-found":
      return "No account exists for that email yet.";
    default:
      return error.message.replace("Firebase: ", "");
  }
}

async function sendSignupNotification(user, profile) {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${apiBaseUrl}/api/signup-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: profile.name,
        role: profile.role,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Email notification request failed");
    }
  } catch (error) {
    console.warn("Signup email notification failed", error);
  }
}

export default function AuthView({ mode, fixedRole, onDone, onSwitchMode, onRoleChange, ensureProfile }) {
  const [form, setForm] = useState({ ...initialForm, role: fixedRole || "seller" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requirements = passwordRequirements(form.password);
  const passwordReady = requirements.every((requirement) => requirement.met);
  const signupReady = mode !== "signup" || (passwordReady && form.acceptedTerms && phoneIsKenyanMobile(form.phone));

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
      setError("Complete every password requirement before continuing.");
      return;
    }

    if (mode === "signup" && !phoneIsKenyanMobile(form.phone)) {
      setError("Enter a valid Kenyan mobile number.");
      return;
    }

    if (mode === "signup" && !form.acceptedTerms) {
      setError("Accept the terms and conditions to create an account.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await sendEmailVerification(credential.user);
        const profile = {
          uid: credential.user.uid,
          email: credential.user.email || form.email,
          name: form.name || credential.user.displayName || "User",
          phone: normalizePhone(form.phone),
          role: form.role,
          county: form.county,
          languages: form.languages,
          isAvailable: true,
          rating: 0,
          completedDeliveries: 0,
          verified: credential.user.emailVerified,
          trust: { phone: true, id: false, profilePhoto: Boolean(credential.user.photoURL) },
          acceptedTerms: true,
          acceptedTermsAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", credential.user.uid), profile);
        await sendSignupNotification(credential.user, profile);
        onDone(profile, credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, form.email, form.password);
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
      const credential = await signInWithPopup(auth, provider);
      const profile = await ensureProfile(credential.user, form);
      if (mode === "signup") {
        await sendSignupNotification(credential.user, profile);
      }
      onDone(profile, credential.user);
    } catch (authError) {
      setError(firebaseAuthMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell polished-auth">
      <motion.section 
        className={`auth-card polished-auth-card ${mode === "signup" ? "signup-card" : ""}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="auth-brandline">
          <div className="auth-logo"><ShieldCheck aria-hidden="true" /></div>
          <div>
            <strong>Delivery Kenya</strong>
            <span>Trust-ready delivery marketplace</span>
          </div>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
          <h1>{mode === "signup" ? `Sign up as ${form.role}` : "Sign in"}</h1>
          <p>{mode === "signup" ? "Set up a credible seller or driver profile for real delivery coordination." : "Sign in to continue to your secure delivery workspace."}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div className="signup-fields">
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
                    <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required maxLength={80} />
                  </label>
                  <label>
                    Kenyan phone number
                    <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+254712345678" required maxLength={13} />
                  </label>
                  <label>
                    County
                    <select value={form.county} onChange={(event) => updateField("county", event.target.value)}>
                      {counties.map((county) => <option key={county}>{county}</option>)}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Comfortable languages</legend>
                    <div className="language-picker">
                      <select
                        value=""
                        onChange={(event) => {
                          if (event.target.value) toggleLanguage(event.target.value);
                        }}
                      >
                        <option value="">Add a language</option>
                        {languages.map((language) => <option key={language} value={language}>{language}</option>)}
                      </select>
                      <div className="chips selected-languages">
                        {form.languages.map((language) => (
                          <button
                            className="selected"
                            key={language}
                            type="button"
                            onClick={() => toggleLanguage(language)}
                          >
                            {language} x
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="field-note">
                      The app interface currently supports English and Kiswahili.
                    </p>
                  </fieldset>
                  <label className="terms-check">
                    <input
                      checked={form.acceptedTerms}
                      onChange={(event) => updateField("acceptedTerms", event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      I agree to Delivery Kenya's terms: verified identities, honest delivery records, lawful goods only,
                      location sharing for active jobs, respectful messaging, and no off-platform fraud.
                    </span>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required maxLength={120} autoComplete="email" />
          </label>
          <label>
            Password
            <div className="password-field">
              <LockKeyhole aria-hidden="true" />
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                required
                minLength={10}
                maxLength={64}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*_)(?=.*[^A-Za-z0-9_]).{10,64}"
                title="Use 10-64 characters with uppercase, lowercase, number, underscore, and symbol."
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-describedby="password-rules"
              />
            </div>
          </label>
          {mode === "signup" && (
            <div className="password-rules" id="password-rules">
              {requirements.map((requirement) => (
                <span className={requirement.met ? "met" : ""} key={requirement.label}>
                  {requirement.met ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                  {requirement.label}
                </span>
              ))}
            </div>
          )}
          {error && <motion.p initial={{ x: -10 }} animate={{ x: 0 }} className="error">{error}</motion.p>}
          <button className="wide auth-primary" disabled={busy || !signupReady}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <div className="auth-divider"><span>or</span></div>
          <button className="wide google-button" disabled={busy} type="button" onClick={continueWithGoogle}>
            <span aria-hidden="true">G</span>
            {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
          </button>
        </form>
        <button className="link-button" onClick={onSwitchMode}>
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </motion.section>
    </main>
  );
}

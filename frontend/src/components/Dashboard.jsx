import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Languages,
  LocateFixed,
  MapPinned,
  MessageCircle,
  PackageCheck,
  Search,
  Send,
  ShieldAlert,
  Upload,
  UserRoundCheck,
  Users,
  Video,
} from "lucide-react";
import { db } from "../firebase";
import DeliveryMap from "./DeliveryMap";
import { DriverCardSkeleton } from "./Skeleton";
import MpesaSimulation from "./MpesaSimulation";
import VideoCall from "./VideoCall";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const onlineWindowMs = 2 * 60 * 1000;
const fullUiLanguages = new Set(["English", "Kiswahili"]);

const translations = {
  English: {
    availableDrivers: "Available drivers",
    availableSellers: "Available sellers",
    chooseDriver: "Choose a trusted driver",
    findSeller: "Find sellers needing delivery",
    search: "Search by county, name, or language",
    rooms: "Conversation rooms",
    noRooms: "Rooms appear after you open a partner conversation.",
    profilePhoto: "Profile photo",
    shareLocation: "Share location",
    signOut: "Sign out",
    trust: "Operational trust",
    verifiedPhone: "Phone verified",
    profileImage: "Profile image",
    activeStatus: "Live availability",
    routeReady: "Route visible",
    chatPlaceholder: "Message, delivery note, or dispatch update...",
    startRoom: "Open a room to begin secure coordination.",
    send: "Send",
    payment: "Payment workflow",
    savePayment: "Record transaction",
    item: "Goods delivered",
    fee: "Fee KES",
    online: "Online",
    videoCall: "Start video call",
  },
  Kiswahili: {
    availableDrivers: "Madereva waliopo",
    availableSellers: "Wauzaji waliopo",
    chooseDriver: "Chagua dereva unayemwamini",
    findSeller: "Tafuta wauzaji wenye mizigo",
    search: "Tafuta kwa kaunti, jina, au lugha",
    rooms: "Vyumba vya mazungumzo",
    noRooms: "Vyumba vitaonekana ukifungua mazungumzo.",
    profilePhoto: "Picha ya wasifu",
    shareLocation: "Shiriki eneo",
    signOut: "Ondoka",
    trust: "Uaminifu wa huduma",
    verifiedPhone: "Simu imethibitishwa",
    profileImage: "Picha ya wasifu",
    activeStatus: "Hali ya upatikanaji",
    routeReady: "Njia inaonekana",
    chatPlaceholder: "Ujumbe au taarifa ya usafirishaji...",
    startRoom: "Fungua chumba kuanza mawasiliano salama.",
    send: "Tuma",
    payment: "Malipo",
    savePayment: "Hifadhi malipo",
    item: "Bidhaa zilizofikishwa",
    fee: "Ada KES",
    online: "Mtandaoni",
    videoCall: "Anza simu ya video",
  },
  Kikuyu: {
    availableDrivers: "Aderiva ario",
    availableSellers: "Atongoria ario",
    chooseDriver: "Cagura dereva wa kuigana",
    findSeller: "Caria atongoria marenda delivery",
    search: "Caria na county, ritwa, kana ruthiomi",
    rooms: "Nyumba cia kuaria",
    noRooms: "Nyumba cionekaga wathomithia mwaririano.",
    profilePhoto: "Thura ya profile",
    shareLocation: "Heana handu uri",
    signOut: "Uma",
    trust: "Uiguano wa wira",
    verifiedPhone: "Thimu ni yathikiririo",
    profileImage: "Thura ya profile",
    activeStatus: "Uri online",
    routeReady: "Njira yonekete",
    chatPlaceholder: "Andika ujumbe wa delivery...",
    startRoom: "Hingura room ya kuaria.",
    send: "Tuma",
    payment: "Malipo",
    savePayment: "Andika malipo",
    item: "Kindu kirutwo",
    fee: "Mari KES",
    online: "Online",
    videoCall: "Hingura video call",
  },
  Luhya: {
    availableDrivers: "Aba driver baliwo",
    availableSellers: "Aba seller baliwo",
    chooseDriver: "Londa driver w'okwesiga",
    findSeller: "Tafuta sellers abafuna delivery",
    search: "Tafuta kwa county, jina, au lulimi",
    rooms: "Ebyumba by'okhuyanza",
    noRooms: "Rooms zizaonekana ukifungua mazungumzo.",
    profilePhoto: "Picha ya profile",
    shareLocation: "Gawana location",
    signOut: "Fuluma",
    trust: "Obwesigwa bwa service",
    verifiedPhone: "Phone yathibitishwa",
    profileImage: "Picha ya profile",
    activeStatus: "Hali ya online",
    routeReady: "Route inaonekana",
    chatPlaceholder: "Andika ujumbe wa delivery...",
    startRoom: "Fungua room kuanza chat.",
    send: "Tuma",
    payment: "Malipo",
    savePayment: "Hifadhi malipo",
    item: "Bidhaa zilizofikishwa",
    fee: "Bei KES",
    online: "Online",
    videoCall: "Anza video call",
  },
};

[
  "Kisii",
  "Meru",
  "Maasai",
  "Kamba",
  "Luo",
  "Kalenjin",
  "Turkana",
  "Somali",
  "Embu",
  "Mbeere",
  "Taita",
  "Taveta",
  "Giriama",
  "Digo",
  "Duruma",
  "Rabai",
  "Pokomo",
  "Bajuni",
  "Orma",
  "Borana",
  "Rendille",
  "Samburu",
  "Pokot",
  "Nandi",
  "Kipsigis",
  "Tugen",
  "Marakwet",
  "Keiyo",
  "Sabaot",
  "Suba",
  "Kuria",
  "Teso",
  "Bukusu",
  "Maragoli",
  "Tachoni",
  "Idakho",
  "Isukha",
  "Tiriki",
  "Swahili Sheng",
].forEach((language) => {
  if (!translations[language]) {
    translations[language] = {
      ...translations.English,
      chatPlaceholder: `Type your ${language} delivery message...`,
      rooms: `${language} conversation rooms`,
      noRooms: `Open a partner conversation to start a ${language} room.`,
      startRoom: `Open a room to coordinate in ${language}.`,
      videoCall: `Start ${language} video call`,
    };
  }
});

function conversationIdFor(a, b) {
  return [a, b].sort().join("_");
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number(value) || 0;
}

function isOnline(person) {
  return Boolean(person?.isAvailable && Date.now() - timestampMillis(person.lastActiveAt) < onlineWindowMs);
}

function lastSeenLabel(person) {
  if (isOnline(person)) return "Online now";
  const lastActive = timestampMillis(person?.lastActiveAt);
  if (!lastActive) return "No activity yet";
  const minutes = Math.max(1, Math.round((Date.now() - lastActive) / 60000));
  if (minutes < 60) return `Last active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Last active ${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function trustItems(person, selected) {
  return [
    { label: "Phone verified", ok: Boolean(person.phone || person.trust?.phone), icon: BadgeCheck },
    { label: "ID submitted", ok: Boolean(person.idReviewStatus === "submitted" || person.trust?.id), icon: ShieldAlert },
    { label: "Profile image", ok: Boolean(person.photoDataUrl || person.photoURL), icon: Camera },
    { label: "Live availability", ok: isOnline(person), icon: Clock3 },
    { label: "Route visible", ok: Boolean(person.location || selected?.location), icon: MapPinned },
  ];
}

function Avatar({ person, size = "md" }) {
  const image = person?.photoDataUrl || person?.photoURL;
  return (
    <div className={`avatar avatar-${size}`}>
      {image ? <img src={image} alt="" /> : <span>{person?.name?.charAt(0) || "U"}</span>}
    </div>
  );
}

function RoomList({ rooms, selectedId, peopleById, onSelect, t }) {
  return (
    <section className="rooms-panel">
      <div className="panel-title">
        <Users aria-hidden="true" />
        <h2>{t.rooms}</h2>
      </div>
      <div className="room-list">
        {rooms.map((room) => {
          const otherId = room.participantIds?.find((id) => peopleById[id]);
          const other = peopleById[otherId] || { name: room.partnerName || "Delivery partner" };
          return (
            <button
              className={`room-card ${selectedId === room.id ? "active" : ""}`}
              key={room.id}
              onClick={() => onSelect(room, other)}
              type="button"
            >
              <Avatar person={other} size="sm" />
              <span>
                <strong>{other.name}</strong>
                <small>{room.lastMessage || "Secure delivery room"}</small>
              </span>
            </button>
          );
        })}
        {!rooms.length && <p className="empty compact">{t.noRooms}</p>}
      </div>
    </section>
  );
}

function CameraCapture({ title, onCancel, onSelect }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  async function takePhoto() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose camera access here. Try localhost, HTTPS, or allow camera permissions.");
      return;
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: title.includes("ID") || title.includes("Goods") ? "environment" : "user" },
        audio: false,
      });
      setStream(nextStream);
    } catch (cameraError) {
      setError(cameraError?.message || "Camera permission was blocked or no camera was found.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    onSelect({ dataUrl, name: `${title}.jpg` });
  }

  function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg"].includes(file.type) || file.size > 450000) {
      setError("Choose a JPG image under 450KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onSelect({ dataUrl: reader.result, name: file.name });
    reader.readAsDataURL(file);
  }

  return (
    <div className="camera-overlay">
      <motion.section className="camera-modal" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div>
          <p className="eyebrow">Camera</p>
          <h2>{title}</h2>
        </div>
        <div className="camera-preview">
          <video className={stream ? "active" : ""} autoPlay muted playsInline ref={videoRef} />
          {!stream && <Camera aria-hidden="true" />}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="camera-actions">
          <label className="secondary-file-button">
            Upload JPG
            <input accept="image/jpeg,image/jpg" onChange={chooseFile} type="file" />
          </label>
          {!stream ? (
            <button onClick={takePhoto} type="button">Take picture</button>
          ) : (
            <button onClick={captureFrame} type="button">Use photo</button>
          )}
          <button className="ghost" onClick={onCancel} type="button">Cancel</button>
        </div>
      </motion.section>
    </div>
  );
}

export default function Dashboard({ user, profile, onLogout, onProfileUpdate }) {
  const [people, setPeople] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [delivery, setDelivery] = useState({ item: "", fee: "", method: "mpesa", reference: "", phoneNumber: "", driverPhoneNumber: "" });
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [paymentAgreed, setPaymentAgreed] = useState(false);
  const [search, setSearch] = useState("");
  const [uiLanguage, setUiLanguage] = useState(profile.languages?.[0] || "English");
  const [showCall, setShowCall] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [view, setView] = useState("directory");

  const oppositeRole = profile.role === "seller" ? "driver" : "seller";
  const activeConversationId = selected ? conversationIdFor(user.uid, selected.uid) : null;
  const t = translations[uiLanguage] || translations.English;
  const supportedProfileLanguages = (profile.languages || ["English"]).filter((language) => fullUiLanguages.has(language));

  const peopleById = useMemo(() => {
    const entries = people.map((person) => [person.uid || person.id, person]);
    return Object.fromEntries(entries);
  }, [people]);

  useEffect(() => {
    const userRef = doc(db, "users", user.uid);
    updateDoc(userRef, {
      isAvailable: true,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    const intervalId = window.setInterval(() => {
      updateDoc(userRef, { lastActiveAt: serverTimestamp() }).catch(() => {});
    }, 45000);

    const markAway = () => {
      if (document.hidden) {
        updateDoc(userRef, { lastActiveAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", markAway);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", markAway);
    };
  }, [user.uid]);

  useEffect(() => {
    const peopleQuery = query(collection(db, "users"), where("role", "==", oppositeRole));
    return onSnapshot(peopleQuery, (snapshot) => {
      setPeople(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      setLoadingPeople(false);
    });
  }, [oppositeRole]);

  useEffect(() => {
    const roomsQuery = query(collection(db, "conversations"), where("participantIds", "array-contains", user.uid));
    return onSnapshot(roomsQuery, (snapshot) => {
      setRooms(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
  }, [user.uid]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return undefined;
    }
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
    return people
      .filter((person) => person.uid !== user.uid)
      .filter((person) => {
        const text = `${person.name} ${person.county} ${(person.languages || []).join(" ")}`.toLowerCase();
        return text.includes(lower);
      })
      .sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));
  }, [people, search, user.uid]);

  async function openRoom(person) {
    const conversationId = conversationIdFor(user.uid, person.uid);
    await setDoc(doc(db, "conversations", conversationId), {
      id: conversationId,
      participantIds: [user.uid, person.uid],
      participantRoles: { [user.uid]: profile.role, [person.uid]: person.role },
      partnerName: person.name,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setSelected(person);
    setView("room");
  }

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

  async function saveProfilePhoto(image) {
    await updateDoc(doc(db, "users", user.uid), {
      photoDataUrl: image.dataUrl,
      trust: { ...(profile.trust || {}), profilePhoto: true },
      updatedAt: serverTimestamp(),
    });
    onProfileUpdate({ ...profile, photoDataUrl: image.dataUrl, trust: { ...(profile.trust || {}), profilePhoto: true } });
  }

  async function saveIdPhoto(image) {
    await updateDoc(doc(db, "users", user.uid), {
      idReviewStatus: "submitted",
      idSubmittedAt: serverTimestamp(),
      trust: { ...(profile.trust || {}), id: true },
      updatedAt: serverTimestamp(),
    });
    onProfileUpdate({
      ...profile,
      idReviewStatus: "submitted",
      trust: { ...(profile.trust || {}), id: true },
    });
  }

  function handleCameraSelect(image) {
    if (cameraTarget === "profile") saveProfilePhoto(image);
    if (cameraTarget === "id") saveIdPhoto(image);
    if (cameraTarget === "chat") setChatImage(image);
    setCameraTarget(null);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if ((!draft.trim() && !chatImage) || !selected) return;
    const messageText = draft.trim() || "Shared a goods image";
    await setDoc(doc(db, "conversations", activeConversationId), {
      id: activeConversationId,
      participantIds: [user.uid, selected.uid],
      participantRoles: { [user.uid]: profile.role, [selected.uid]: selected.role },
      lastMessage: messageText,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await addDoc(collection(db, "conversations", activeConversationId, "messages"), {
      text: messageText,
      senderId: user.uid,
      senderName: profile.name,
      language: uiLanguage,
      imageDataUrl: chatImage?.dataUrl || null,
      imageName: chatImage?.name || null,
      createdAt: serverTimestamp(),
    });
    setDraft("");
    setChatImage(null);
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
      phoneNumber: delivery.phoneNumber,
      driverPhoneNumber: delivery.driverPhoneNumber || (profile.role === "seller" ? selected.phone : profile.phone),
      reference: delivery.reference || `DK-${Date.now().toString().slice(-6)}`,
    };

    setPaymentPreview(payment);
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
        status: delivery.method === "cash" ? "cash_confirmed_on_delivery" : "mpesa_stk_pending",
        riskStatus: "awaiting_partner_confirmation",
        createdAt: serverTimestamp(),
      });
    }
    setDelivery({ item: "", fee: "", method: "mpesa", reference: "", phoneNumber: "", driverPhoneNumber: "" });
    setPaymentAgreed(false);
  }

  return (
    <main className="app-shell pro-shell">
      <aside className="sidebar">
        <div className="brand">
          <PackageCheck aria-hidden="true" />
          <span>Delivery Kenya</span>
        </div>

        <div className="profile-box glass-dark">
          <Avatar person={profile} />
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.role} in {profile.county}</span>
          </div>
        </div>

        <button className="capture-tile" onClick={() => setCameraTarget("profile")} type="button">
          <Camera aria-hidden="true" />
          Profile photo
        </button>

        <button className="capture-tile" onClick={() => setCameraTarget("id")} type="button">
          <Camera aria-hidden="true" />
          {profile.idReviewStatus === "submitted" ? "ID submitted" : "Take ID photo"}
        </button>
        {profile.idReviewStatus === "submitted" && (
          <p className="sidebar-note">ID received for review. The image is hidden for privacy.</p>
        )}

        <label className="language-select">
          <Languages aria-hidden="true" />
          <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value)}>
            {(supportedProfileLanguages.length ? supportedProfileLanguages : ["English"]).map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>

        <button className="wide secondary" onClick={shareLocation} type="button">
          <LocateFixed aria-hidden="true" /> {t.shareLocation}
        </button>
        <button className="wide ghost sidebar-ghost" onClick={onLogout} type="button">
          <ArrowLeft aria-hidden="true" /> Back
        </button>
      </aside>

      <section className={`directory ${view === "directory" ? "mobile-active" : ""}`}>
        <div className="section-heading">
          <p className="eyebrow">{profile.role === "seller" ? t.availableDrivers : t.availableSellers}</p>
          <h1>{profile.role === "seller" ? t.chooseDriver : t.findSeller}</h1>
        </div>
        <label className="search">
          <Search aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} />
        </label>
        <div className="people-list">
          <AnimatePresence>
            {loadingPeople ? (
              [...Array(4)].map((_, i) => <DriverCardSkeleton key={i} />)
            ) : filteredPeople.map((person) => (
              <motion.button
                layout
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`person-card ${selected?.uid === person.uid ? "active" : ""}`}
                key={person.uid}
                onClick={() => openRoom(person)}
                type="button"
              >
                <div className="person-top">
                  <Avatar person={person} />
                  <div>
                    <strong>{person.name}</strong>
                    <span>{person.county} - {(person.languages || []).slice(0, 3).join(", ")}</span>
                    <small className={isOnline(person) ? "presence online" : "presence"}>{lastSeenLabel(person)}</small>
                  </div>
                </div>
                <div className="metrics">
                  <span className="badge"><BadgeCheck aria-hidden="true" /> {person.verified ? "Verified" : "Pending ID"}</span>
                  <span className="badge"><UserRoundCheck aria-hidden="true" /> {person.completedDeliveries || 0} jobs</span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {!filteredPeople.length && <p className="empty">No {oppositeRole}s match your search yet.</p>}
        </div>
      </section>

      <section className={`workspace investor-workspace ${view === "room" ? "mobile-active" : ""}`}>
        <button className="back-button" onClick={() => setView("directory")} type="button">
          <ArrowLeft aria-hidden="true" /> Back to partners
        </button>

        <div className="workspace-grid">
          <div className="left-stack">
            <RoomList
              rooms={rooms}
              selectedId={activeConversationId}
              peopleById={peopleById}
              onSelect={(_room, person) => {
                setSelected(person);
                setView("room");
              }}
              t={t}
            />

            <div className="trust-panel professional-panel">
              <div className="panel-title">
                <ShieldAlert aria-hidden="true" />
                <h2>{t.trust}</h2>
              </div>
              <div className="checks professional-checks">
                {trustItems(selected || profile, selected).map((item) => {
                  const Icon = item.icon;
                  return (
                    <span className={`trust-chip ${item.ok ? "ok" : "missing"}`} key={item.label}>
                      {item.ok ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <DeliveryMap profile={profile} selected={selected} />
          </div>

          <div className="right-stack">
            <section className="chat-panel professional-panel">
              <div className="chat-header">
                <div className="chat-partner">
                  {selected ? <Avatar person={selected} /> : <MessageCircle aria-hidden="true" />}
                  <div>
                    <p className="eyebrow">Secure room</p>
                    <h2>{selected?.name || "No room selected"}</h2>
                    {selected && <span className={isOnline(selected) ? "presence online" : "presence"}>{lastSeenLabel(selected)}</span>}
                  </div>
                </div>
                {selected && (
                  <button className="call-button" onClick={() => setShowCall(true)} type="button">
                    <Video aria-hidden="true" /> {t.videoCall}
                  </button>
                )}
              </div>

              <div className="messages">
                {messages.map((message) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`message ${message.senderId === user.uid ? "mine" : ""}`}
                    key={message.id}
                  >
                    <span>{message.senderName} - {message.language || "English"}</span>
                    <p>{message.text}</p>
                    {message.imageDataUrl && (
                      <img className="message-image" src={message.imageDataUrl} alt={message.imageName || "Shared goods"} />
                    )}
                  </motion.div>
                ))}
                {!selected && <p className="empty">{t.startRoom}</p>}
                {selected && !messages.length && <p className="empty">This room is ready. Send the first dispatch update.</p>}
              </div>

              <form className="composer" onSubmit={sendMessage}>
                <input disabled={!selected} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.chatPlaceholder} />
                <button className="attach-button" disabled={!selected} onClick={() => setCameraTarget("chat")} type="button">
                  <Camera aria-hidden="true" />
                  Photo
                </button>
                <button className="btn-send" disabled={!selected} type="submit">
                  <Send aria-hidden="true" /> {t.send}
                </button>
              </form>
              {chatImage && <p className="attachment-preview">Attached: {chatImage.name}</p>}
            </section>

            {profile.role === "seller" && (
              <motion.form className="payment-panel professional-panel" onSubmit={recordPayment} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="panel-title">
                  <CreditCard aria-hidden="true" />
                  <h2>{t.payment}</h2>
                </div>
                <div className="payment-grid pro-payment-grid">
                  <input value={delivery.item} onChange={(event) => setDelivery({ ...delivery, item: event.target.value })} placeholder={t.item} required />
                  <input value={delivery.fee} onChange={(event) => setDelivery({ ...delivery, fee: event.target.value })} type="number" min="1" placeholder={t.fee} required />
                  <select value={delivery.method} onChange={(event) => setDelivery({ ...delivery, method: event.target.value })}>
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                {delivery.method === "mpesa" && (
                  <div className="payment-grid pro-payment-grid">
                    <input 
                      value={delivery.phoneNumber} 
                      onChange={(event) => setDelivery({ ...delivery, phoneNumber: event.target.value })} 
                      placeholder="Your M-Pesa phone (e.g., 0712345678)" 
                      required 
                    />
                    <input 
                      value={delivery.driverPhoneNumber} 
                      onChange={(event) => setDelivery({ ...delivery, driverPhoneNumber: event.target.value })} 
                      placeholder="Driver M-Pesa phone (e.g., 0712345678)" 
                      required 
                    />
                  </div>
                )}
                <label className="agreement-check">
                  <input checked={paymentAgreed} onChange={(event) => setPaymentAgreed(event.target.checked)} type="checkbox" />
                  <span>Seller and driver have agreed on this delivery and fee.</span>
                </label>
                <button className="btn-payment" disabled={!selected || !paymentAgreed} type="submit">
                  <CircleDollarSign aria-hidden="true" /> {delivery.method === "mpesa" ? "Pay with M-Pesa" : "Record cash payment"}
                </button>
              </motion.form>
            )}
          </div>
        </div>
      </section>

      <MpesaSimulation
        isOpen={Boolean(paymentPreview)}
        amount={paymentPreview?.amount}
        method={paymentPreview?.method}
        reference={paymentPreview?.reference}
        onComplete={() => setPaymentPreview(null)}
      />

      {showCall && selected && (
        <VideoCall
          user={user}
          profile={profile}
          selected={selected}
          onClose={() => setShowCall(false)}
        />
      )}
      {cameraTarget && (
        <CameraCapture
          title={cameraTarget === "profile" ? "Profile photo" : cameraTarget === "id" ? "ID photo" : "Goods photo"}
          onCancel={() => setCameraTarget(null)}
          onSelect={handleCameraSelect}
        />
      )}
    </main>
  );
}

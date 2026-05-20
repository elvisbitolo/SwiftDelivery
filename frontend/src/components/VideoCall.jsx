import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { db } from "../firebase";

const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

function callIdFor(a, b) {
  return [a, b].sort().join("_");
}

export default function VideoCall({ user, profile, selected, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const unsubscribersRef = useRef([]);
  const [status, setStatus] = useState("Starting camera...");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startCall() {
      const callId = callIdFor(user.uid, selected.uid);
      const callRef = doc(db, "calls", callId);
      const callerCandidates = collection(callRef, "callerCandidates");
      const calleeCandidates = collection(callRef, "calleeCandidates");

      const peer = new RTCPeerConnection(rtcConfig);
      peerRef.current = peer;

      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (cancelled || peer.signalingState === "closed") {
        localStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const remoteStream = new MediaStream();
      localStreamRef.current = localStream;
      remoteStreamRef.current = remoteStream;

      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

      localStream.getTracks().forEach((track) => {
        if (!cancelled && peer.signalingState !== "closed") {
          peer.addTrack(track, localStream);
        }
      });
      peer.ontrack = (event) => {
        if (cancelled) return;
        event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
        setStatus(`Connected with ${selected.name}`);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setStatus(`Connected with ${selected.name}`);
        if (peer.connectionState === "disconnected") setStatus("Connection interrupted");
        if (peer.connectionState === "failed") setStatus("Call connection failed");
      };

      const callSnapshot = await getDoc(callRef);
      const existingCall = callSnapshot.exists() ? callSnapshot.data() : null;
      const amCaller = !existingCall?.offer || existingCall.createdBy === user.uid;
      const localCandidates = amCaller ? callerCandidates : calleeCandidates;
      const remoteCandidates = amCaller ? calleeCandidates : callerCandidates;

      peer.onicecandidate = (event) => {
        if (!cancelled && event.candidate && peer.signalingState !== "closed") {
          addDoc(localCandidates, event.candidate.toJSON()).catch(() => {});
        }
      };

      if (amCaller) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await setDoc(callRef, {
          id: callId,
          participantIds: [user.uid, selected.uid],
          createdBy: user.uid,
          createdByName: profile.name,
          receiverName: selected.name,
          offer,
          status: "ringing",
          updatedAt: serverTimestamp(),
        }, { merge: true });
        setStatus(`Calling ${selected.name}... ask them to open the same room and tap video call.`);

        unsubscribersRef.current.push(onSnapshot(callRef, (snapshot) => {
          const data = snapshot.data();
          if (!cancelled && peer.signalingState !== "closed" && data?.answer && !peer.currentRemoteDescription) {
            peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            setStatus(`Connecting with ${selected.name}...`);
          }
        }));
      } else {
        await peer.setRemoteDescription(new RTCSessionDescription(existingCall.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await updateDoc(callRef, {
          answer,
          status: "connected",
          answeredBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        setStatus(`Joining ${selected.name}...`);
      }

      unsubscribersRef.current.push(onSnapshot(remoteCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            if (!cancelled && peer.signalingState !== "closed") {
              peer.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
            }
          }
        });
      }));
    }

    startCall().catch((error) => {
      setStatus(error?.message || "Could not start video call");
    });

    return () => {
      cancelled = true;
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current = [];
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [profile.name, selected.name, selected.uid, user.uid]);

  function toggleMic() {
    const next = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicEnabled(next);
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraEnabled(next);
  }

  async function endCall() {
    await deleteDoc(doc(db, "calls", callIdFor(user.uid, selected.uid))).catch(() => {});
    onClose();
  }

  return (
    <div className="call-overlay">
      <motion.section className="call-modal live-call-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="live-call-header">
          <div>
            <p className="eyebrow">Live video room</p>
            <h2>{selected.name}</h2>
          </div>
          <span>{status}</span>
        </div>

        <div className="video-grid">
          <div className="video-tile remote-video">
            <video autoPlay playsInline ref={remoteVideoRef} />
            <strong>{selected.name}</strong>
          </div>
          <div className="video-tile local-video">
            <video autoPlay muted playsInline ref={localVideoRef} />
            <strong>{profile.name || "You"}</strong>
          </div>
        </div>

        <div className="call-controls">
          <button className={micEnabled ? "" : "muted"} onClick={toggleMic} type="button">
            {micEnabled ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
          </button>
          <button className={cameraEnabled ? "" : "muted"} onClick={toggleCamera} type="button">
            {cameraEnabled ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
          </button>
          <button className="danger-button" onClick={endCall} type="button">
            <PhoneOff aria-hidden="true" /> End
          </button>
        </div>
      </motion.section>
    </div>
  );
}

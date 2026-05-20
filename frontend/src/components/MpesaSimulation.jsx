import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, CheckCircle } from "lucide-react";

export default function MpesaSimulation({ isOpen, amount, method, reference, onComplete }) {
  const isCash = method === "cash";
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="mpesa-sim-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="phone-container"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <Smartphone size={320} className="phone-icon" strokeWidth={1} />
            <motion.div 
              className="stk-push-notice"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="stk-header">
                <strong>Safaricom</strong>
                <span>now</span>
              </div>
              <p>{isCash ? "Cash payment recorded." : `M-Pesa payment of KES ${amount} has been simulated successfully.`}</p>
              <small>Reference: {reference || "Pending receipt"}</small>
              <div className="stk-status"><CheckCircle aria-hidden="true" /> {isCash ? "Cash confirmation saved" : "Payment recorded"}</div>
              <div className="stk-actions">
                <button onClick={onComplete} className="stk-btn">Done</button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

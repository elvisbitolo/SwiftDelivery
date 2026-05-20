import { motion } from "framer-motion";
import { PackageCheck, Store, Bike, ShieldCheck, Languages, MessageCircle, MapPin, Moon, Sun } from "lucide-react";
import deliveryHero from "../delivery.jpg";
import { useState, useEffect } from "react";

export default function Landing({ onStart, onSignin }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.main 
      className="landing"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <nav className="nav">
        <motion.div className="brand" variants={itemVariants}>
          <PackageCheck aria-hidden="true" />
          <span>Delivery Kenya</span>
        </motion.div>
        <motion.div className="nav-actions" variants={itemVariants}>
          <button 
            className="theme-toggle ghost" 
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button className="ghost" onClick={onSignin}>Sign in</button>
          <button onClick={() => onStart("seller")}>Join now</button>
        </motion.div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <motion.p className="eyebrow" variants={itemVariants}>Seller to driver delivery network</motion.p>
          <motion.h1 variants={itemVariants}>
            Move goods across Kenya with people you can <span className="text-gradient">verify.</span>
          </motion.h1>
          <motion.p variants={itemVariants}>
            Sellers can find available drivers, review trust details, share
            location, chat in real time, and record payment by cash or M-Pesa.
          </motion.p>
          <motion.div className="hero-actions" variants={itemVariants}>
            <button onClick={() => onStart("seller")} className="btn-primary">
              <Store aria-hidden="true" /> Sign up as seller
            </button>
            <button className="secondary btn-secondary" onClick={() => onStart("driver")}>
              <Bike aria-hidden="true" /> Sign up as driver
            </button>
          </motion.div>
        </div>
        <motion.div 
          className="hero-visual" 
          aria-label="Delivery coordination in Kenya"
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <img
            src={deliveryHero}
            alt="Courier on a motorcycle carrying a delivery bag"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div className="route-card glass">
            <MapPin aria-hidden="true" />
            <span>Nairobi pickup</span>
            <strong>Drivers and Sellers nearby</strong>
          </div>
        </motion.div>
      </section>

      <section className="feature-band">
        <motion.article variants={itemVariants} whileHover={{ y: -5 }}>
          <ShieldCheck aria-hidden="true" />
          <h2>Trust criteria</h2>
          <p>Profiles show phone, ID, ratings, language fit, location, and delivery history signals.</p>
        </motion.article>
        <motion.article variants={itemVariants} whileHover={{ y: -5 }}>
          <Languages aria-hidden="true" />
          <h2>Local languages</h2>
          <p>Users choose languages like Kiswahili, Kikuyu, Kisii, Luhya, Meru, and Maasai.</p>
        </motion.article>
        <motion.article variants={itemVariants} whileHover={{ y: -5 }}>
          <MessageCircle aria-hidden="true" />
          <h2>Saved chats</h2>
          <p>Every seller-driver conversation is stored in Firestore for continuity and accountability.</p>
        </motion.article>
      </section>
    </motion.main>
  );
}

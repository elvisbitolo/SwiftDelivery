import { motion } from "framer-motion";

export const Skeleton = ({ className }) => (
  <motion.div
    className={`skeleton ${className}`}
    initial={{ opacity: 0.5 }}
    animate={{ opacity: [0.5, 0.8, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
);

export const DriverCardSkeleton = () => (
  <div className="person-card skeleton-card">
    <div className="person-top">
      <Skeleton className="avatar-skeleton" />
      <div style={{ flex: 1 }}>
        <Skeleton className="title-skeleton" />
        <Skeleton className="subtitle-skeleton" />
      </div>
    </div>
    <div className="metrics">
      <Skeleton className="badge-skeleton" />
      <Skeleton className="badge-skeleton" />
    </div>
  </div>
);

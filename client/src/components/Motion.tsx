import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * One timing language for the whole application.
 * Hover and press are handled in CSS with the same numbers.
 */
export const DUR = {
  press: 0.12,
  hover: 0.2,
  dropdown: 0.24,
  overlay: 0.3,
  page: 0.34,
  reveal: 0.52,
  chart: 0.8,
};

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_SOFT = [0.2, 0.8, 0.2, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const reduce = useReducedMotion();
  const Component = motion[as] as typeof motion.div;
  if (reduce) {
    const Tag = as as any;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: DUR.reveal, ease: EASE, delay }}
    >
      {children}
    </Component>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.46, ease: EASE } },
};

export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}

/** Route-level entrance. Keyed by pathname so every navigation animates once. */
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  const location = useLocation();
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      key={location.pathname}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.page, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

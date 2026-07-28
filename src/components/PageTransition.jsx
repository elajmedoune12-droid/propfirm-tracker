import { motion } from 'framer-motion'

export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>
      {children}
    </motion.div>
  )
}
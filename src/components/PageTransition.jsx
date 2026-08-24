import { createContext, useContext, useState, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'

/* Contexte de visibilité : les composants qui mesurent le DOM (graphiques
   recharts) peuvent s'en servir pour ne se monter que lorsque leur page est
   réellement visible. Un ResponsiveContainer rendu dans une page masquée
   (display:none) mesure 0×0 et recharts cracherait un warning en boucle. */
const VisibilityContext = createContext(true)

export function usePageVisible() {
  return useContext(VisibilityContext)
}

/* Toutes les pages restent montées dans la pile : leurs états locaux (filtres,
   recherche, modale ouverte, année sélectionnée...) survivent aux changements
   d'onglet, comme dans n'importe quelle app native. La page inactive est
   masquée via display:none ; l'active apparaît avec un court fondu.
   `active` remplace l'ancien mécanisme key={tab} qui remontait chaque page
   (et perdait donc tout son état) à chaque navigation.
   Montage différé : une page n'est rendue qu'à sa première visite (démarrage
   plus rapide, aucun rendu caché), puis reste montée. */
export default function PageTransition({ active, children }) {
  const [openedOnce, setOpenedOnce] = useState(active)
  // useLayoutEffect : la page se remplit avant le premier paint de sa
  // première visite, pour éviter un flash de contenu vide pendant le fondu.
  useLayoutEffect(() => {
    if (active && !openedOnce) setOpenedOnce(true)
  }, [active, openedOnce])

  return (
    <motion.div
      initial={false}
      animate={active ? 'show' : 'hide'}
      variants={{ show: { opacity: 1, y: 0 }, hide: { opacity: 0, y: 6 } }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ display: active ? 'block' : 'none' }}
      aria-hidden={!active}>
      {openedOnce && (
        <VisibilityContext.Provider value={active}>{children}</VisibilityContext.Provider>
      )}
    </motion.div>
  )
}

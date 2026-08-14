// Écrans de chargement "squelette" : remplacent le texte "Chargement…" par
// des blocs qui reprennent la forme du contenu réel, avec un effet de pulsation.
// La mise en page (flex, largeurs) est en style inline exprès, pour ne dépendre
// d'aucune règle CSS externe qui pourrait entrer en conflit.

export const SkeletonCard = () => (
  <div className="panel skeleton-pulse">
    <div className="skeleton-line" style={{ height: 12, width: '33%', marginBottom: 12 }} />
    <div className="skeleton-line skeleton-line-soft" style={{ height: 28, width: '50%', marginBottom: 8 }} />
    <div className="skeleton-line skeleton-line-soft" style={{ height: 12, width: '66%' }} />
  </div>
);

export const SkeletonList = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', boxSizing: 'border-box' }}>
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="panel skeleton-pulse"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="skeleton-line"
          style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton-line" style={{ height: 12, width: '60%', marginBottom: 8 }} />
          <div className="skeleton-line skeleton-line-soft" style={{ height: 10, width: '40%' }} />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonCalendar = () => (
  <div className="panel skeleton-pulse">
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <div className="skeleton-line" style={{ width: 32, height: 32, borderRadius: 12 }} />
      <div className="skeleton-line" style={{ width: 128, height: 20 }} />
      <div className="skeleton-line" style={{ width: 32, height: 32, borderRadius: 12 }} />
    </div>
    <div className="skeleton-calendar-grid">
      {[...Array(35)].map((_, i) => (
        <div key={i} className="skeleton-line skeleton-line-soft" style={{ aspectRatio: '1', borderRadius: 12 }} />
      ))}
    </div>
  </div>
);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView from './Map.jsx'
import { GROUPS, formatMonth, humanize, imageUrl, loadData, thumbUrl } from './data.js'

export default function App() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [bounds, setBounds] = useState(null)
  const [showOthers, setShowOthers] = useState(true)
  const [activeGroups, setActiveGroups] = useState(new Set())
  const [announce, setAnnounce] = useState('')
  const lastFocus = useRef(null)
  const headingRef = useRef(null)
  const browseRef = useRef(null) // ids frozen when browsing starts, so Previous/Next is predictable

  const load = useCallback(() => {
    setStatus('loading')
    loadData().then(
      (d) => { setData(d); setStatus('ready') },
      () => setStatus('error'),
    )
  }, [])
  useEffect(load, [load])

  const visible = useMemo(
    () => (data ? data.matched.filter((f) => !activeGroups.size || activeGroups.has(f.properties.group)) : []),
    [data, activeGroups],
  )
  const groupCounts = useMemo(() => {
    const c = {}
    for (const f of data?.matched ?? []) c[f.properties.group] = (c[f.properties.group] ?? 0) + 1
    return c
  }, [data])
  const inView = useMemo(() => {
    if (!bounds) return visible
    return visible.filter(({ geometry: { coordinates: [x, y] } }) => x >= bounds.w && x <= bounds.e && y >= bounds.s && y <= bounds.n)
  }, [visible, bounds])

  // screen-reader status: debounced so panning/zooming doesn't produce a stream of announcements
  useEffect(() => {
    const t = setTimeout(() => setAnnounce(`${inView.length} places with photos in view`), 1200)
    return () => clearTimeout(t)
  }, [inView.length])

  const selected = data?.matched.find((f) => f.properties.id === selectedId) ?? null
  const select = useCallback(
    (id) => {
      if (!selectedId) lastFocus.current = document.activeElement
      if (!browseRef.current?.includes(id)) browseRef.current = inView.map((f) => f.properties.id)
      setSelectedId(id)
    },
    [selectedId, inView],
  )
  const close = useCallback(() => {
    setSelectedId(null)
    browseRef.current = null
    lastFocus.current?.isConnected && lastFocus.current.focus?.()
  }, [])

  useEffect(() => {
    if (selectedId) headingRef.current?.focus()
  }, [selectedId])
  useEffect(() => {
    if (selectedId) document.querySelector('.thumb[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && selectedId && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, close])

  const browseIds = browseRef.current ?? []
  const pos = browseIds.indexOf(selectedId)
  const step = (dir) => {
    if (!browseIds.length) return
    setSelectedId(browseIds[(pos + dir + browseIds.length) % browseIds.length])
  }
  const toggleGroup = (g) =>
    setActiveGroups((s) => {
      const n = new Set(s)
      n.has(g) ? n.delete(g) : n.add(g)
      return n
    })

  const total = data?.matched.length ?? 0

  return (
    <div className={`app${selected ? ' has-selection' : ''}`}>
      <div className="stage">
        <MapView
          data={status === 'ready' ? data : null}
          selectedId={selectedId}
          hoverId={hoverId}
          onSelect={select}
          onBounds={setBounds}
          showOthers={showOthers}
          activeGroups={activeGroups}
        />
        <div className="legend">
          <h1>Cincinnati storefronts</h1>
          {status === 'loading' && <p role="status">Loading places…</p>}
          {status === 'error' && (
            <p role="alert">
              Couldn’t load places. <button onClick={load}>Retry</button>
            </p>
          )}
          {status === 'ready' && data.matchesFailed && (
            <p role="alert">
              Photos unavailable. <button onClick={load}>Retry</button>
            </p>
          )}
          {status === 'ready' && !data.matchesFailed && (
            <p>
              <span className="dot accent" aria-hidden="true" />
              <b>{visible.length}</b>{visible.length !== total && ` of ${total}`} places with a street-level photo. Tap a purple dot or a photo.
            </p>
          )}
        </div>
      </div>

      <aside className="panel" aria-label="Places with photos">
        <div className="panel-head">
          <h2>
            {inView.length} in view <span className="sub">· best views first</span>
          </h2>
          <span className="sr-only" role="status">{announce}</span>
          <div className="chips" role="group" aria-label="Filter by type of place">
            <button className="chip" aria-pressed={activeGroups.size === 0} onClick={() => setActiveGroups(new Set())}>
              All {total || ''}
            </button>
            {GROUPS.map((g) => (
              <button key={g} className="chip" aria-pressed={activeGroups.has(g)} onClick={() => toggleGroup(g)}>
                {g} {groupCounts[g] ?? 0}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} />
            <span className="dot grey" aria-hidden="true" />
            Show other places (no photo)
          </label>
        </div>

        {selected && (
          <Detail f={selected} headingRef={headingRef} onClose={close} onStep={step} pos={pos} count={browseIds.length} />
        )}

        <ul className="thumbs">
          {inView.map((f) => {
            const p = f.properties
            return (
              <li key={p.id}>
                <button
                  className="thumb"
                  aria-pressed={p.id === selectedId}
                  onClick={() => select(p.id)}
                  onMouseEnter={() => setHoverId(p.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(p.id)}
                  onBlur={() => setHoverId(null)}
                >
                  <img src={thumbUrl(p)} alt="" loading="lazy" width="160" height="120" />
                  <span>{p.name}</span>
                </button>
              </li>
            )
          })}
          {status === 'ready' && !inView.length && (
            <li className="empty">No photos here. Pan or zoom out to find purple dots.</li>
          )}
        </ul>
        <p className="credit">
          Map © OpenStreetMap contributors via OpenFreeMap · POIs: Overture Maps · Photos: Mapillary (CC BY-SA)
        </p>
      </aside>
    </div>
  )
}

function Detail({ f, headingRef, onClose, onStep, pos, count }) {
  const p = f.properties
  const cat = humanize(p.category)
  return (
    <section className="detail" aria-label="Selected place">
      <div className="detail-top">
        <div>
          <h3 ref={headingRef} tabIndex={-1}>{p.name}</h3>
          {cat && <div className="cat">{cat}</div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close details">×</button>
      </div>
      <img
        src={imageUrl(p)}
        width="1024"
        height="768"
        alt={`Street-level photo near ${p.name}${cat ? ` (${cat})` : ''}, taken ${formatMonth(p.captured_at)}`}
      />
      <div className="meta">
        Photo {formatMonth(p.captured_at)} · taken {Math.round(p.distance_m)} m away ·{' '}
        <a href={p.mapillary_url} target="_blank" rel="noreferrer" aria-label="View photo on Mapillary (opens in a new tab)">
          Mapillary ↗
        </a>
      </div>
      <div className="stepper">
        <button onClick={() => onStep(-1)}>‹ Previous</button>
        {pos >= 0 && <span className="step-count">{pos + 1} of {count}</span>}
        <button onClick={() => onStep(1)}>Next ›</button>
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMobile = () => window.matchMedia('(max-width: 640px)').matches

const ACCENT = '#6741d9'
const isActive = ['any', ['boolean', ['feature-state', 'active'], false], ['boolean', ['feature-state', 'hover'], false]]
const radius = (base) => [
  'interpolate', ['linear'], ['zoom'],
  10, ['case', isActive, base + 3, base],
  17, ['case', isActive, base + 5, base + 2],
]

export default function MapView({ data, selectedId, hoverId, onSelect, onBounds, showOthers, activeGroups }) {
  const container = useRef(null)
  const mapRef = useRef(null)
  const [ready, setReady] = useState(false)
  const prev = useRef({ selected: null, hover: null })
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onBoundsRef = useRef(onBounds)
  onBoundsRef.current = onBounds

  // create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-84.512, 39.103],
      zoom: 12,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: 'POIs: Overture Maps · Photos: Mapillary (CC BY-SA)' }),
      'bottom-left',
    )
    if (import.meta.env.DEV) window.__map = map
    mapRef.current = map
    const emit = () => {
      const b = map.getBounds()
      onBoundsRef.current({ w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() })
    }
    map.on('moveend', emit)
    map.on('load', () => {
      setReady(true)
      emit()
    })
    return () => map.remove()
  }, [])

  // add sources/layers once both style and data are ready
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !data || map.getSource('pois')) return
    const fc = (features) => ({ type: 'FeatureCollection', features })
    map.addSource('pois', { type: 'geojson', data: fc(data.others), cluster: true, clusterMaxZoom: 15, clusterRadius: 40 })
    map.addSource('matched', { type: 'geojson', data: fc(data.matched), promoteId: 'id' })
    map.addLayer({
      id: 'clusters', type: 'circle', source: 'pois', filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#ced4da', 'circle-opacity': 0.65,
        'circle-radius': ['step', ['get', 'point_count'], 9, 50, 12, 500, 16],
      },
    })
    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'pois', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 10, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#495057' },
    })
    map.addLayer({
      id: 'poi-unmatched', type: 'circle', source: 'pois', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': '#adb5bd', 'circle-radius': 3, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
    })
    map.addLayer({
      id: 'poi-matched', type: 'circle', source: 'matched',
      paint: {
        'circle-color': ACCENT,
        'circle-radius': radius(5),
        'circle-stroke-width': ['case', isActive, 4, 2.5],
        'circle-stroke-color': '#fff',
      },
    })
    // drawn last so the selected dot is never buried under overlapping neighbours
    map.addLayer({
      id: 'poi-selected', type: 'circle', source: 'matched', filter: ['==', ['get', 'id'], ''],
      paint: { 'circle-color': ACCENT, 'circle-radius': 11, 'circle-stroke-width': 3.5, 'circle-stroke-color': '#212529' },
    })

    map.on('click', 'clusters', (e) => {
      if (map.queryRenderedFeatures(hitBox(e.point), { layers: ['poi-matched'] }).length) return
      const f = e.features[0]
      map.getSource('pois').getClusterExpansionZoom(f.properties.cluster_id).then((zoom) =>
        map.easeTo({ center: f.geometry.coordinates, zoom, duration: reducedMotion() ? 0 : 500 }),
      )
    })

    let popup
    map.on('click', (e) => {
      const feats = map.queryRenderedFeatures(hitBox(e.point), { layers: ['poi-matched', 'poi-selected', 'poi-unmatched'] })
      if (!feats.length) return
      const dist = (f) => Math.hypot(map.project(f.geometry.coordinates).x - e.point.x, map.project(f.geometry.coordinates).y - e.point.y)
      const nearest = (list) => list.reduce((a, b) => (dist(a) <= dist(b) ? a : b))
      const matched = feats.filter((f) => f.layer.id !== 'poi-unmatched')
      if (matched.length) {
        popup?.remove()
        onSelectRef.current(nearest(matched).properties.id, 'map')
        return
      }
      const f = nearest(feats)
      popup?.remove()
      popup = new maplibregl.Popup({ maxWidth: '240px', offset: 8 })
        .setLngLat(f.geometry.coordinates)
        .setHTML(`<div class="popup"><strong>${esc(f.properties.name)}</strong><div class="cat">${esc((f.properties.category || '').replace(/_/g, ' '))}</div><div class="cat">No storefront photo for this place</div></div>`)
        .addTo(map)
    })

    for (const layer of ['clusters', 'poi-matched', 'poi-selected', 'poi-unmatched']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
    }
  }, [ready, data])

  // selection: highlight dot + bring it into view
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map.getSource('matched')) return
    const sheetPad = isMobile() ? { bottom: Math.round(window.innerHeight * 0.5) } : { bottom: 0 }
    map.setFilter('poi-selected', ['==', ['get', 'id'], selectedId ?? ''])
    if (selectedId) {
      const f = data.matched.find((x) => x.properties.id === selectedId)
      map.easeTo({
        center: f.geometry.coordinates,
        zoom: Math.max(map.getZoom(), 14),
        padding: sheetPad,
        duration: reducedMotion() ? 0 : 600,
      })
    } else if (prev.current.selected) {
      map.easeTo({ padding: { bottom: 0 }, duration: reducedMotion() ? 0 : 300 })
    }
    prev.current.selected = selectedId
  }, [selectedId, ready, data])

  // hover from the sidebar list
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map.getSource('matched')) return
    if (prev.current.hover) map.setFeatureState({ source: 'matched', id: prev.current.hover }, { hover: false })
    if (hoverId) map.setFeatureState({ source: 'matched', id: hoverId }, { hover: true })
    prev.current.hover = hoverId
  }, [hoverId, ready, data])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map.getLayer('clusters')) return
    for (const id of ['clusters', 'cluster-count', 'poi-unmatched'])
      map.setLayoutProperty(id, 'visibility', showOthers ? 'visible' : 'none')
  }, [showOthers, ready, data])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map.getLayer('poi-matched')) return
    map.setFilter('poi-matched', activeGroups.size ? ['in', ['get', 'group'], ['literal', [...activeGroups]]] : null)
  }, [activeGroups, ready, data])

  return <div ref={container} className="map" aria-label="Map of Cincinnati storefronts" />
}

// ±14px tolerance so small dots are easy to hit with a finger
const hitBox = (p) => [[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]]

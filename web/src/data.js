const BASE = import.meta.env.BASE_URL

export const GROUPS = ['Food & drink', 'Shops', 'Beauty & wellness', 'Offices & services', 'Civic & culture', 'Other']

const GROUP_RULES = [
  ['Food & drink', /restaurant|cafe|coffee|bar$|^bar|pub|brewery|bakery|pizza|food|grill|diner|ice_cream|dessert|barbecue|bagel|sandwich|donut|tea_|juice|wine|cocktail|deli/],
  ['Beauty & wellness', /salon|barber|spa$|^spa|beauty|nail|massage|tattoo|fitness|gym|yoga|wellness|dentist|doctor|clinic|health|veterinar|makeup|cosmetic/],
  ['Shops', /store|shop|shopping|market|grocery|retail|boutique|florist|jewel|book|pharmacy|furniture|antique|thrift/],
  ['Civic & culture', /historic|park|church|school|museum|library|government|community|landmark|religious|monument|stop|station|hospital|gallery|theat|stadium|college|university|cemetery|hotel|lodging|event_venue/],
  ['Offices & services', /service|office|company|agency|bank|financial|atm|law|real_estate|consult|software|insurance|contractor|repair|manufactur|organization/],
]

export const groupOf = (category) => {
  if (!category) return 'Other'
  for (const [group, re] of GROUP_RULES) if (re.test(category)) return group
  return 'Other'
}

export const humanize = (slug) => (slug ? slug.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '')

export const formatMonth = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

export const imageUrl = (m) => `${BASE}${m.image_file}`
export const thumbUrl = (m) => `${BASE}${m.image_file.replace('images/', 'thumbs/')}`

// Not really storefronts: keep them in the data but list them last.
const NOT_STOREFRONT = /stop|station|bridge|trail|^park|atm/

// Best view = camera facing the place (small angle) from a comfortable distance (~15 m);
// a camera standing right on the point usually looks along the street instead.
const viewScore = (p) =>
  p.angle_diff + 0.5 * Math.abs(p.distance_m - 15) + (NOT_STOREFRONT.test(p.category || '') ? 1000 : 0)

/** Fetch POIs + matches in parallel and split them into matched (sorted best-view-first) and others. */
export async function loadData() {
  const [poisRes, matchesRes] = await Promise.allSettled([
    fetch(`${BASE}data/pois.geojson`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${BASE}data/matches.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ])
  if (poisRes.status === 'rejected') throw new Error('pois')
  const matches = matchesRes.status === 'fulfilled' ? matchesRes.value : {}
  const matched = []
  const others = []
  for (const f of poisRes.value.features) {
    const m = matches[f.properties.id]
    if (m) {
      matched.push({
        ...f,
        properties: { ...f.properties, ...m, group: groupOf(f.properties.category) },
      })
    } else others.push(f)
  }
  matched.sort((a, b) => viewScore(a.properties) - viewScore(b.properties))
  return { matched, others, matchesFailed: matchesRes.status === 'rejected' }
}

// Which fog a Foggy Valleys session step runs (FoggyValleysStep.jsx), from the
// participant's drawn value for the assignment slot `valley_order`.

export const VALLEY_ORDER_SLOT = 'valley_order'
export const VALLEY_ORDERS = { thin_first: ['thin', 'thick'], thick_first: ['thick', 'thin'] }

/** The fog level for a valley position (1 or 2), or null when the order is missing or unknown. */
export function fogFor(position, assignments) {
  const order = VALLEY_ORDERS[assignments?.[VALLEY_ORDER_SLOT]]
  return order ? order[position - 1] ?? null : null
}

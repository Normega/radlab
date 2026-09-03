// Flattening composable-instrument responses into export columns.
//
// Split out of studyExport.js so it can be tested without the Supabase client
// (studyExport imports it at module scope, which a plain node test cannot
// load). It is pure: response in, columns out.
//
// The five response shapes each flatten differently, and the shape is chosen
// from the RECORDED `instrument_type` on the row rather than sniffed from the
// value — a row states what it was when it was answered, so a definition
// edited later cannot relabel old data.

// Option and belief ids are already slug-shaped; this only removes the one
// character that would make a column name awkward to read.
const token = (s) => String(s ?? '').replace(/-/g, '')

/**
 * @param prefix   `<slug>_<timepoint>` — the caller owns timepoint naming
 * @param type     instrument_responses.instrument_type (recorded on the row)
 * @param response instrument_responses.response (jsonb)
 * @param def      the composable_instruments row, when available. Needed for
 *                 exactly one thing: a multi-select records only the options
 *                 CHOSEN, so without the option list an unselected option is
 *                 indistinguishable from one never offered. With it, every
 *                 option gets an explicit 0.
 * @returns {Object} column name → value
 */
export function instrumentColumns(prefix, type, response, def = null) {
  const out = {}

  switch (type) {
    case 'likert_slider':
    case 'open_text':
      out[prefix] = response ?? null
      return out

    case 'multiple_choice': {
      // Array = the allow_multiple mode added 2026-09-02; object = single
      // select. The two are distinguishable without consulting the definition.
      if (Array.isArray(response)) {
        const chosen = new Map(response.map(s => [s?.option_id, s?.value]))

        for (const opt of def?.config?.options ?? []) {
          out[`${prefix}_${token(opt.id)}`] = chosen.has(opt.id) ? 1 : 0
        }
        // Options the definition no longer lists — edited after collection, or
        // no definition available — would otherwise vanish from the export.
        for (const [id, value] of chosen) {
          if (!id) continue
          const col = `${prefix}_${token(id)}`
          if (!(col in out)) out[col] = 1
          if (value != null && value !== '') out[`${col}_value`] = value
        }

        out[`${prefix}_selected`] = response.map(s => s?.option_id).filter(Boolean).join('; ')
        return out
      }

      out[prefix] = response?.option_id ?? null
      if (response?.value != null && response.value !== '') {
        out[`${prefix}_value`] = response.value
      }
      return out
    }

    case 'open_list': {
      // Index is a recorded fact here, not occurrence inference: the list is an
      // ordered set of entries the participant wrote in that order.
      const entries = Array.isArray(response) ? response : []
      entries.forEach((e, i) => {
        out[`${prefix}_${i + 1}_factor`] = e?.factor ?? null
        out[`${prefix}_${i + 1}_contribution`] = e?.contribution ?? null
      })
      out[`${prefix}_count`] = entries.length
      return out
    }

    case 'hierarchy': {
      // Belief ids come off the response itself, so this needs no definition.
      for (const level of Array.isArray(response) ? response : []) {
        if (!level?.id) continue
        const col = `${prefix}_${token(level.id)}`
        out[`${col}_changed`] = level.changed ? 1 : 0
        // Null direction is meaningful: the level was not marked changed.
        out[`${col}_direction`] = level.direction ?? null
      }
      return out
    }

    default:
      // An unregistered type must still export its data — JSON beats dropping
      // the answer on the floor.
      out[prefix] = (response && typeof response === 'object')
        ? JSON.stringify(response)
        : (response ?? null)
      return out
  }
}

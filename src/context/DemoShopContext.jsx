import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'greenlit:demo-shop:v1'
const DemoShopStateContext = createContext(null)

function loadInitial() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ratings: {}, flags: {}, archives: {} }
    const parsed = JSON.parse(raw)
    return {
      ratings: parsed.ratings ?? {},
      flags: parsed.flags ?? {},
      archives: parsed.archives ?? {},
    }
  } catch {
    return { ratings: {}, flags: {}, archives: {} }
  }
}

function toRatingRow(intakeId, payload) {
  return {
    intake_id: intakeId,
    on_target: payload.onTarget,
    repair_performed: payload.repairPerformed || null,
    accuracy_score: payload.accuracyScore ?? null,
    comment: payload.comment?.trim() || null,
    created_at: payload.rated_at,
  }
}

export function DemoShopProvider({ children }) {
  const [state, setState] = useState(loadInitial)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // sessionStorage can throw (e.g. Safari private mode) — demo state just won't persist across a refresh
      }
    }, 100)
    return () => window.clearTimeout(timeoutRef.current)
  }, [state])

  const setRating = useCallback((intakeId, payload) => {
    setState((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [intakeId]: { ...payload, rated_at: new Date().toISOString() } },
    }))
  }, [])

  const getRating = useCallback((intakeId) => state.ratings[intakeId] ?? null, [state.ratings])

  const setFlag = useCallback((intakeId, reason) => {
    setState((prev) => ({
      ...prev,
      flags: { ...prev.flags, [intakeId]: { reason, flagged_at: new Date().toISOString() } },
    }))
  }, [])

  const clearFlag = useCallback((intakeId) => {
    setState((prev) => ({ ...prev, flags: { ...prev.flags, [intakeId]: null } }))
  }, [])

  const getFlag = useCallback((intakeId) => state.flags[intakeId] ?? undefined, [state.flags])

  const archive = useCallback((intakeId) => {
    setState((prev) => ({
      ...prev,
      archives: { ...prev.archives, [intakeId]: { archived_at: new Date().toISOString() } },
    }))
  }, [])

  const isArchived = useCallback((intakeId) => Boolean(state.archives[intakeId]), [state.archives])

  const resetAll = useCallback(() => {
    setState({ ratings: {}, flags: {}, archives: {} })
  }, [])

  const applyOverlay = useCallback(
    (intakes) =>
      intakes.map((intake) => {
        const overlayRating = state.ratings[intake.id]
        const overlayFlag = state.flags[intake.id]
        const overlayArchive = state.archives[intake.id]
        return {
          ...intake,
          rating: overlayRating ? toRatingRow(intake.id, overlayRating) : intake.rating,
          flagged: overlayFlag === null ? false : overlayFlag ? true : intake.flagged,
          flagged_reason: overlayFlag === null ? null : overlayFlag ? overlayFlag.reason : intake.flagged_reason,
          flagged_at: overlayFlag === null ? null : overlayFlag ? overlayFlag.flagged_at : intake.flagged_at,
          archived_at: overlayArchive ? overlayArchive.archived_at : intake.archived_at,
        }
      }),
    [state]
  )

  const value = {
    getRating,
    setRating,
    getFlag,
    setFlag,
    clearFlag,
    isArchived,
    archive,
    resetAll,
    applyOverlay,
  }

  return <DemoShopStateContext.Provider value={value}>{children}</DemoShopStateContext.Provider>
}

export function useDemoShopState() {
  const ctx = useContext(DemoShopStateContext)
  if (!ctx) throw new Error('useDemoShopState must be used within DemoShopProvider')
  return ctx
}

import { createContext, useContext, useState } from 'react'
import { useBeltConnection } from '../../games/BreathBelt/hooks/useBeltConnection'
import { DEFAULT_TRIGGER_DEVICE } from '../../games/BreathBelt/constants'

const PhysioContext = createContext(null)

export function PhysioProvider({ children, isSimMode = false }) {
  const belt = useBeltConnection({ isSimMode })
  const [sessionNumber,   setSessionNumber]   = useState(1)
  const [triggerDevice,   setTriggerDevice]   = useState(DEFAULT_TRIGGER_DEVICE)

  return (
    <PhysioContext.Provider value={{
      belt,
      sessionNumber,  setSessionNumber,
      triggerDevice,  setTriggerDevice,
    }}>
      {children}
    </PhysioContext.Provider>
  )
}

export function usePhysioContext() {
  return useContext(PhysioContext)
}

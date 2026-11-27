import { useRef, useState, useCallback, useEffect } from 'react'
import { PMD_SERVICE, PMD_CONTROL, PMD_DATA, HR_SERVICE, HR_MEASUREMENT } from '../../BreathBelt/constants'
import { parsePmdAccFrame, parseHrRaw } from './beltScopeSignal.js'

// ── useH10Stream ────────────────────────────────────────────────────────────
//
// Raw Polar H10 stream, no calibration and no processing: every accelerometer
// packet and every heart-rate notification is handed to the caller as it
// arrives. Written for Belt Scope (/belt-scope). useBreathSignal is untouched;
// this repeats its connect sequence exactly (the same waits, HR before PMD
// because PMD startNotifications() briefly drops GATT on Windows/Chrome, and
// the same PMD start command: accelerometer, 200 Hz, ±8 g, 16-bit), so the
// stream is the one the study records.
//
//   const h10 = useH10Stream({ onAccel, onHr })
//   onAccel({ packetTs, devicePacketMicros, frameType, x, y, z })   x/y/z raw int16 = mg
//   onHr({ timestamp, heartRate, rrIntervals1024, contactStatus, rrMs })
//   h10.btState: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
//
// packetTs / timestamp are Date.now() at arrival, the clock of the study's
// packet_timestamp and HR timestamp columns. Callbacks are read through refs,
// so passing new functions on every render is fine.

export const PMD_START_ACC = [0x02, 0x02, 0x00, 0x01, 0xC8, 0x00, 0x01, 0x01, 0x10, 0x00, 0x02, 0x01, 0x08, 0x00]

export function useH10Stream({ onAccel, onHr } = {}) {
  const [btState, setBtState] = useState('IDLE')
  const [deviceName, setDeviceName] = useState(null)
  const [error, setError] = useState(null)
  const deviceRef = useRef(null)
  const accCharRef = useRef(null)
  const hrCharRef = useRef(null)
  const onAccelRef = useRef(onAccel)
  const onHrRef = useRef(onHr)
  const connectedRef = useRef(false)

  useEffect(() => { onAccelRef.current = onAccel; onHrRef.current = onHr })

  const accelHandler = useCallback((e) => {
    const packetTs = Date.now()
    const f = parsePmdAccFrame(e.target?.value)
    if (!f) return
    try { onAccelRef.current?.({ packetTs, ...f }) } catch (err) { console.error('H10 accel consumer:', err) }
  }, [])

  const hrHandler = useCallback((e) => {
    const row = { timestamp: Date.now(), ...parseHrRaw(e.target?.value) }
    try { onHrRef.current?.(row) } catch (err) { console.error('H10 HR consumer:', err) }
  }, [])

  const onGattDisconnected = useCallback(() => {
    if (connectedRef.current) { connectedRef.current = false; setBtState('DISCONNECTED') }
  }, [])

  const connect = useCallback(async () => {
    setBtState('CONNECTING')
    setError(null)
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [PMD_SERVICE],
      })
      deviceRef.current = device
      setDeviceName(device.name || null)
      const server = await device.gatt.connect()
      await new Promise(r => setTimeout(r, 1000))
      const pmdSvc = await server.getPrimaryService(PMD_SERVICE)
      const hrSvc = await server.getPrimaryService(HR_SERVICE)
      const control = await pmdSvc.getCharacteristic(PMD_CONTROL)
      const data = await pmdSvc.getCharacteristic(PMD_DATA)
      const hrChar = await hrSvc.getCharacteristic(HR_MEASUREMENT)
      accCharRef.current = data
      hrCharRef.current = hrChar
      await new Promise(r => setTimeout(r, 1000))
      data.oncharacteristicvaluechanged = accelHandler
      hrChar.oncharacteristicvaluechanged = hrHandler
      await hrChar.startNotifications()
      await new Promise(r => setTimeout(r, 200))
      const pmdCmd = new Uint8Array(PMD_START_ACC)
      if (control.properties.writeWithoutResponse) await control.writeValueWithoutResponse(pmdCmd)
      else await control.writeValueWithResponse(pmdCmd)
      await data.startNotifications()
      // listen for drops only once the start-up sequence (and its brief
      // Windows GATT blip) is over
      device.addEventListener('gattserverdisconnected', onGattDisconnected)
      connectedRef.current = true
      setBtState('CONNECTED')
    } catch (err) {
      console.error('BT:', err)
      // closing the chooser is not an error worth shouting about
      setError(err?.name === 'NotFoundError' ? null : (err?.message || String(err)))
      setBtState(err?.name === 'NotFoundError' ? 'IDLE' : 'ERROR')
    }
  }, [accelHandler, hrHandler, onGattDisconnected])

  const disconnect = useCallback(async () => {
    connectedRef.current = false
    try { deviceRef.current?.removeEventListener('gattserverdisconnected', onGattDisconnected) } catch { /* not attached */ }
    try { await accCharRef.current?.stopNotifications() } catch { /* already closed */ }
    try { await hrCharRef.current?.stopNotifications() } catch { /* already closed */ }
    try { deviceRef.current?.gatt?.disconnect() } catch { /* already closed */ }
    setBtState('IDLE')
  }, [onGattDisconnected])

  useEffect(() => () => {
    connectedRef.current = false
    accCharRef.current?.stopNotifications?.().catch(() => { /* unmount */ })
    hrCharRef.current?.stopNotifications?.().catch(() => { /* unmount */ })
    try { deviceRef.current?.gatt?.disconnect() } catch { /* unmount */ }
  }, [])

  return { btState, deviceName, error, connect, disconnect }
}

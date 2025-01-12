import { useEffect, useRef, useState } from 'react'

export const useSocketManager = (host: string) => {
  const socketRef = useRef<WebSocket | null>(null) // Ref for the WebSocket instance
  const [state, setState] = useState<Record<string, any>>({}) // Holds dynamic state updates

  useEffect(() => {
    const ws = new WebSocket(host)
    socketRef.current = ws // Assign the WebSocket to the ref

    ws.onopen = () => {
      console.log('Connected to the server')
    }

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        console.log('Received string data:', event.data)
      } else if (event.data instanceof ArrayBuffer) {
        const bufferValues = new Uint8Array(event.data)
        handleServerData(Array.from(bufferValues), updateState)
      }
    }

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Disconnected from server')
      socketRef.current = null // Clean up the ref
    }

    return () => {
      ws.close() // Ensure the WebSocket is closed on cleanup
    }
  }, [host])

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message)
    } else {
      console.error('WebSocket is not connected')
    }
  }

  const updateState = (key: string, value: any) => {
    setState(prevState => ({
      ...prevState,
      [key]: value,
    }))
  }

  return { sendMessage, state, socket: socketRef.current }
}

const handleServerData = (
  bufferValues: number[],
  updateState: (key: string, value: any) => void,
) => {
  const byteData = new DataView(new Uint8Array(bufferValues).buffer)
  const originalValue = byteData.getInt32(0, false) // Big-endian
  const identifier = byteData.getUint32(4, false) // Offset 4 (after 4 bytes), big-endian

  console.log('byteData', byteData)
  console.log('originalValue', originalValue)
  console.log('identifier', identifier)

  switch (identifier) {
    case 0: // RPM
      let adjustedValue = originalValue
      if (originalValue !== 0) adjustedValue += 50

      const convertedRPM = Math.abs(adjustedValue / 110)
      updateState('_convertedRPM', convertedRPM)

      const rawSpeed = Math.abs(Math.floor(adjustedValue / 256))
      updateState('_currentSpeed', rawSpeed)
      break

    case 1: // BRAKE
      updateState('_brakeValue', originalValue)
      break

    case 2: // FNR
      updateState('_fnrValue', originalValue)
      break

    case 3: // BEAMS
      updateState('_beamsValue', originalValue)
      break

    case 4: // BLINKERS
      updateState('_blinkersValue', originalValue)
      break

    case 5: // SEATBELT
      updateState('_seatbeltValue', originalValue)
      break

    case 6: // BATTERY
      updateState('_batteryValue', originalValue)
      break

    case 8: // CAR CHARGING
      updateState('_carCharging', originalValue)
      break

    case 909: // LITHIUM BATTERIES
      updateState('_lithiumBatteries', originalValue)
      break

    default:
      console.warn('Unhandled identifier:', identifier)
  }
}

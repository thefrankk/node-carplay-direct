// import { useState, useCallback } from 'react'
// import { TouchAction } from 'node-carplay/web'
// import { CarPlayWorker } from './worker/types'

// export const useCarplayTouch = (
//   worker: CarPlayWorker,
//   width: number,
//   height: number,
// ) => {
//   const [pointerdown, setPointerDown] = useState(false)

//   const sendTouchEvent: React.PointerEventHandler<HTMLDivElement> = useCallback(
//     e => {
//       let action = TouchAction.Up
//       if (e.type === 'pointerdown') {
//         action = TouchAction.Down
//         setPointerDown(true)
//       } else if (pointerdown) {
//         switch (e.type) {
//           case 'pointermove':
//             action = TouchAction.Move
//             break
//           case 'pointerup':
//           case 'pointercancel':
//           case 'pointerout':
//             setPointerDown(false)
//             action = TouchAction.Up
//             break
//         }
//       } else {
//         return
//       }

//       const { offsetX: x, offsetY: y } = e.nativeEvent
//       worker.postMessage({
//         type: 'touch',
//         payload: { x: x / width, y: y / height, action },
//       })
//     },
//     [pointerdown, worker, width, height],
//   )

//   return sendTouchEvent
// }

import { useState, useCallback } from 'react'
import { TouchAction } from 'node-carplay/web'
import { CarPlayWorker } from './worker/types'

export const useCarplayTouch = (
  worker: CarPlayWorker,
  width: number,
  height: number,
) => {
  const [pointerdown, setPointerDown] = useState(false)

  const sendTouchEvent: React.PointerEventHandler<HTMLDivElement> = useCallback(
    e => {
      let action = TouchAction.Up

      // Determine the action type
      if (e.type === 'pointerdown') {
        action = TouchAction.Down
        setPointerDown(true)
      } else if (pointerdown) {
        switch (e.type) {
          case 'pointermove':
            action = TouchAction.Move
            break
          case 'pointerup':
          case 'pointercancel':
          case 'pointerout':
            setPointerDown(false)
            action = TouchAction.Up
            break
        }
      } else {
        return
      }

      // Calculate the correct touch coordinates
      const target = e.currentTarget as HTMLDivElement
      const rect = target.getBoundingClientRect() // Get container dimensions and position
      const scaleX = width / rect.width // Scale factor for X-axis
      const scaleY = height / rect.height // Scale factor for Y-axis

      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      // Send the touch event to the worker
      worker.postMessage({
        type: 'touch',
        payload: { x, y, action },
      })
    },
    [pointerdown, worker, width, height],
  )

  return sendTouchEvent
}

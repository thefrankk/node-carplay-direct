import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { RotatingLines } from 'react-loader-spinner'
import './App.css'
import {
  findDevice,
  requestDevice,
  DongleConfig,
  CommandMapping,
} from 'node-carplay/web'
import { CarPlayWorker } from './worker/types'
import useCarplayAudio from './useCarplayAudio'
import { useCarplayTouch } from './useCarplayTouch'
import { InitEvent } from './worker/render/RenderEvents'
import debug from 'debug'

const width = window.innerWidth
const height = window.innerHeight

const videoChannel = new MessageChannel()
const micChannel = new MessageChannel()

const config: Partial<DongleConfig> = {
  width,
  height,
  fps: 60,
  mediaDelay: 300,
}

const RETRY_DELAY_MS = 30000

function App() {
  const [isPlugged, setPlugged] = useState(false)
  const [deviceFound, setDeviceFound] = useState<Boolean | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  )

  const renderWorker = useMemo(() => {
    if (!canvasElement) return

    const worker = new Worker(
      new URL('./worker/render/Render.worker.ts', import.meta.url),
    )
    const canvas = canvasElement.transferControlToOffscreen()
    worker.postMessage(new InitEvent(canvas, videoChannel.port2), [
      canvas,
      videoChannel.port2,
    ])
    return worker
  }, [canvasElement])

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setCanvasElement(canvasRef.current)
    }
  }, [])

  const carplayWorker = useMemo(() => {
    const worker = new Worker(
      new URL('./worker/CarPlay.worker.ts', import.meta.url),
    ) as CarPlayWorker
    const payload = {
      videoPort: videoChannel.port1,
      microphonePort: micChannel.port1,
    }
    worker.postMessage({ type: 'initialise', payload }, [
      videoChannel.port1,
      micChannel.port1,
    ])
    return worker
  }, [])

  const { processAudio, getAudioPlayer, startRecording, stopRecording } =
    useCarplayAudio(carplayWorker, micChannel.port2)

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  // subscribe to worker messages
  useEffect(() => {
    carplayWorker.onmessage = ev => {
      const { type } = ev.data
      switch (type) {
        case 'plugged':
          setPlugged(true)

          console.log('plugged')
          break
        case 'unplugged':
          console.log('unplugged')

          setPlugged(false)
          break
        case 'requestBuffer':
          clearRetryTimeout()
          getAudioPlayer(ev.data.message)
          break
        case 'audio':
          clearRetryTimeout()
          processAudio(ev.data.message)
          break
        case 'media':
          //TODO: implement
          break
        case 'command':
          const {
            message: { value },
          } = ev.data
          switch (value) {
            case CommandMapping.startRecordAudio:
              startRecording()
              break
            case CommandMapping.stopRecordAudio:
              stopRecording()
              break
          }
          break
        case 'failure':
          if (retryTimeoutRef.current == null) {
            console.error(
              `Carplay initialization failed -- Reloading page in ${RETRY_DELAY_MS}ms`,
            )
            retryTimeoutRef.current = setTimeout(() => {
              window.location.reload()
            }, RETRY_DELAY_MS)
          }
          break
      }
    }
  }, [
    carplayWorker,
    clearRetryTimeout,
    getAudioPlayer,
    processAudio,
    renderWorker,
    startRecording,
    stopRecording,
  ])

  const checkDevice = useCallback(
    async (request: boolean = false) => {
      console.log('Checking devices', request)

      const device = request ? await requestDevice() : await findDevice()
      if (device) {
        setDeviceFound(true)
        const payload = {
          config,
        }
        carplayWorker.postMessage({ type: 'start', payload })
      } else {
        setDeviceFound(false)
      }
    },
    [carplayWorker],
  )

  // usb connect/disconnect handling and device check
  useEffect(() => {
    navigator.usb.onconnect = async () => {
      checkDevice()
    }

    navigator.usb.ondisconnect = async () => {
      const device = await findDevice()
      if (!device) {
        carplayWorker.postMessage({ type: 'stop' })
        setDeviceFound(false)
      }
    }

    checkDevice()
  }, [carplayWorker, checkDevice])

  const onClick = useCallback(() => {
    checkDevice(true)
    console.log('Click on device')

    const log = debug('app:component')
    log('This is a debug log')
  }, [checkDevice])

  const sendTouchEvent = useCarplayTouch(carplayWorker, width, height)

  const isLoading = !isPlugged

  return (
    <div
      style={{ height: '100%', touchAction: 'none' }}
      id={'main'}
      className="App"
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {deviceFound === false && (
            <button onClick={onClick} rel="noopener noreferrer">
              Plug-In Carplay Dongle and Press TEST
            </button>
          )}
          {deviceFound === true && (
            <RotatingLines
              strokeColor="grey"
              strokeWidth="5"
              animationDuration="0.75"
              width="96"
              visible={true}
            />
          )}
        </div>
      )}
      <div
        id="videoContainer"
        onPointerDown={sendTouchEvent}
        onPointerMove={sendTouchEvent}
        onPointerUp={sendTouchEvent}
        onPointerCancel={sendTouchEvent}
        onPointerOut={sendTouchEvent}
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          justifyContent: 'center', // Horizontally center
          alignItems: 'center', // Vertically center
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          id="video"
          style={
            isPlugged
              ? {
                  display: 'block',
                  height: '100%', // Adjust as needed
                  width: '100%', // Adjust as needed
                }
              : { display: 'none' }
          }
        />
        {isPlugged && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              zIndex: 10,
            }}
          >
            <button onClick={() => console.log('Button 1 clicked')}>
              Button 1
            </button>
            <button onClick={() => console.log('Button 2 clicked')}>
              Button 2
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

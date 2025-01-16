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
import { FiArrowLeft, FiBattery, FiHome } from 'react-icons/fi' // Feather Home Icon
import { useSocketManager } from './SocketManager'

const width = window.innerWidth * 0.82
const height = window.innerHeight * 0.82

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

  const { sendMessage, state } = useSocketManager('ws://localhost:8080')

  useEffect(() => {
    // You can send an initial message if needed when the app starts
    sendMessage('Initial connection message from App')
  }, [sendMessage])

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

  const handleServerMessage = useCallback(() => {
    console.log('Navigating to Home')
    sendMessage('launch-dashboard')

    // Add navigation logic here
  }, [])

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
      style={{
        height: '100vh', // Use vh for consistent height
        //backgroundSize: '98%', // Start slightly zoomed-in
        backgroundSize: 'cover', // Start slightly zoomed-in

        touchAction: 'none',
        //backgroundImage: 'url("/Background_Dark.png")', // Reference public folder
        //backgroundImage: 'url("/esfera_resized.png")', // Reference public folder
        backgroundImage:
          'linear-gradient(to top, #000000, #271a1f, #482d3a, #6a425a, #8c597f, #8c597f, #8c597f, #8c597f, #6a425a, #482d3a, #271a1f, #000000)',

        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        position: 'relative', // Ensure elements inside are positioned relative to this container
      }}
      id="main"
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
            <button
              onClick={onClick}
              rel="noopener noreferrer"
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                zIndex: 32, // Explicitly set z-index
              }}
            >
              Plug-In Carplay Dongle and Press
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
          position: 'absolute',
          width: '70%', //82
          height: '70%', //82
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          touchAction: 'none', // Ensure touch actions are passed to canvas
          top: '50%', // Move the top of the container to the center
          left: '50%', // Move the left of the container to the center
          transform: 'translate(-50%, -50%)', // Offset by 50% of its own width and height
        }}
      >
        <canvas
          ref={canvasRef}
          id="video"
          style={
            isPlugged
              ? {
                  display: 'block',
                  height: '100%',
                  width: '100%',
                  // zIndex: 30, // Explicitly set z-index
                  touchAction: 'none', // Ensure touch actions are passed to canvas
                }
              : { display: 'none' }
          }
        />
        {!isPlugged && (
          <div
            style={{
              display: 'block',
              height: '100%',
              width: '100%',
              backgroundColor: 'rgba(70, 69, 69, 0)', // Add a semi-transparent background
              zIndex: 20, // Place it behind the canvas (if visible)
            }}
          />
        )}
      </div>
      {/* Left Icon */}
      <div
        style={{
          position: 'absolute',
          left: '20px', // Position 10px from the left edge
          top: '50%', // Center vertically
          transform: 'translateY(-50%)',
          fontSize: '24px',
          color: '#000', // Change to your desired color
        }}
      >
        <FiHome color="rgb(100, 100, 100)" size={38} />
      </div>
      {/* Right Icon */}
      <div
        style={{
          position: 'absolute',
          right: '10px', // Position 10px from the right edge
          top: '50%', // Center vertically
          transform: 'translateY(-50%)',
          fontSize: '24px',
          color: '#000', // Change to your desired color
        }}
      >
        <FiHome color="white" size={38} />
      </div>

      {/* Top Text and Icons */}
      <div
        style={{
          position: 'absolute',
          top: '10px', // Position near the top of the screen
          left: '50%',
          transform: 'translateX(-50%)', // Center horizontally
          display: 'flex',
          justifyContent: 'space-between', // Distribute left and right sections
          alignItems: 'center',
          width: '25%', // Reduce width to bring sections closer
        }}
      >
        {/* Left Section: 120 and MPH */}
        <div
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column', // Stack "120" and "MPH"
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '30px',
              fontWeight: 'bold',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            120
          </span>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 'normal',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            MPH
          </span>
        </div>

        {/* Right Section: Fuel Text and Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            textAlign: 'right',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginRight: '5px',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            55%
          </span>
          <FiBattery color="green" size={36} />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          backgroundColor: 'rgba(66, 68, 73, 0)', // 0.9 Slight transparency
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 32,

          padding: '18px 0',
        }}
      >
        <button
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 35,
            cursor: 'pointer',
            color: '#000000', // Ensure visibility against transparent background
          }}
          onClick={handleServerMessage}
        >
          <FiHome color="white" size={38} />;
        </button>
      </div>
    </div>
  )
}
export default App

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
import { GaugeComponent } from 'react-gauge-component'
import GlobalStyle from './utils/GlobalStyle'
import BatteryGauge from 'react-battery-gauge'
import Modal from './utils/ModalCarplay'
import CarPlayDialog from './utils/CarPlayDialog'

const width = window.innerWidth * 0.74
const height = window.innerHeight * 0.74

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

  //Icons
  const [isOn, setIsOn] = useState(true) // State to manage on/off status

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

          setFooterText('Connecting with phone..')

          setTimeout(() => setCarPlayConnection(false), 3000) // Simulate update

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
        setFooterText('Searching for phone..')
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

  const leftSectionStyle = isOn => ({
    fontSize: isOn ? '32px' : '22px', // 30px if turned on, 20px if turned off
    color: isOn ? 'white' : 'gray', // White if turned on, gray if turned off
  })

  const [footerText, setFooterText] = useState('Initializing...')
  const [showCarPlayConnection, setCarPlayConnection] = useState(true)

  const isFOn = true // Example variable to control "F"
  const isNOn = false // Example variable to control "N"
  const isROn = false // Example variable to control "R"

  return (
    <>
      <GlobalStyle />
      <div
        style={{
          position: 'relative',
          height: '100vh',
          width: '100%',
          overflow: 'hidden', // Prevent blur overflow
        }}
        id="main"
        className="App"
      >
        {/* Blurred Background */}
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '120%',
            height: '120%',
            backgroundImage: 'url("/esfera_resized.png")',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            filter: 'blur(35px)', // Apply blur here
            zIndex: -1, // Ensure this stays behind the content
          }}
        />
        {showCarPlayConnection && (
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
            <CarPlayDialog
              isDay={false}
              onClose={() => {}}
              footerText={footerText}
            />

            {deviceFound === false && (
              <button
                onClick={onClick}
                rel="noopener noreferrer"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0)', // Add a semi-transparent background                  border: 'none',
                  position: 'absolute',
                  border: 'none',

                  zIndex: 32, // Explicitly set z-index
                  top: '10%', // Move the top of the container to the center
                  left: '50%', // Move the left of the container to the center
                  transform: 'translate(-50%, -50%)', // Offset by 50% of its own width and height
                }}
              >
                Plug-In Carplay Dongle and Press /** * */ public test test test
              </button>
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
            width: '74%', //82
            height: '74%', //82
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
        {/* Left Icons */}
        <div
          style={{
            position: 'absolute',
            left: '-25px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          {/* Left Blinker */}
          <img
            src="/assets/izq_on_Dark.png"
            alt="Left Blinker"
            style={{
              width: '160px',
              height: '150px',
              opacity:
                state._blinkersValue === 3 || state._blinkersValue === 2
                  ? 1
                  : 0,
              filter:
                state._blinkersValue === 3 || state._blinkersValue === 2
                  ? 'none'
                  : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          />

          {/* Beams */}
          <img
            src="/assets/Luces_Dark.png"
            alt="Beams"
            style={{
              width: '32px',
              height: '20px',
              opacity: state._beamsValue ? 1 : 0,
              filter: state._beamsValue ? 'none' : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          />

          {/* Low Lights */}
          <img
            src="/assets/low_lights_dark.png"
            alt="Low Lights"
            style={{
              width: '32px',
              height: '20px',
              opacity: state._lowLightsValue ? 1 : 0,
              filter: state._lowLightsValue ? 'none' : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          />
        </div>

        {/* Right Icons */}
        <div
          style={{
            position: 'absolute',
            right: '-25px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          {/* Right Blinker */}
          <img
            src="/assets/Dcha_Dark.png"
            alt="Right Blinker"
            style={{
              width: '160px',
              height: '150px',
              opacity:
                state._blinkersValue === 3 || state._blinkersValue === 1
                  ? 1
                  : 0,
              filter:
                state._blinkersValue === 3 || state._blinkersValue === 1
                  ? 'none'
                  : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          />
          {/* Parking Image */}
          <img
            src="/assets/parking_dark.png"
            alt="Parking"
            style={{
              width: '35px', // Set size dynamically
              height: '25px',
              opacity: state._brakeValue === 1 ? 1 : 0, // Full opacity if brake is active
              transition: 'all 0.3s ease', // Smooth transition for changes
            }}
          />

          {/* Seatbelt */}
          <img
            src="/assets/Cinturon_Dark.png"
            alt="Seatbelt"
            style={{
              width: '30px',
              height: '35px',
              opacity: state._seatbeltValue ? 1 : 0,
              filter: state._seatbeltValue ? 'none' : 'grayscale(100%)',
              transition: 'all 0.3s ease',
            }}
          />
        </div>

        {/* Top Container */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            justifyContent: 'space-between', // Space out sections
            alignItems: 'center',
            width: '35%', // Adjust width to control spacing
          }}
        >
          {/* FNR Management */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '22%', // Adjust width to fine-tune spacing
              marginLeft: '-10px', // Move slightly to the left
            }}
          >
            {/* F */}
            <div
              style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '2px',
              }}
            >
              <span
                style={{
                  fontSize: state._fnrValue === 0 ? '36px' : '30px', // Larger font size for active
                  color:
                    state._fnrValue === 0
                      ? 'rgba(255, 255, 255, 1)' // Highlight active
                      : 'rgba(255, 255, 255, 0.5)', // Dim inactive
                  transition: 'all 0.3s ease', // Smooth transitions
                }}
              >
                F
              </span>
            </div>

            {/* N */}
            <div
              style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '2px',
              }}
            >
              <span
                style={{
                  fontSize: state._fnrValue === 1 ? '36px' : '30px', // Larger font size for active
                  color:
                    state._fnrValue === 1
                      ? 'rgba(255, 255, 255, 1)' // Highlight active
                      : 'rgba(255, 255, 255, 0.5)', // Dim inactive
                  transition: 'all 0.3s ease', // Smooth transitions
                }}
              >
                N
              </span>
            </div>

            {/* R */}
            <div
              style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '2px',
              }}
            >
              <span
                style={{
                  fontSize: state._fnrValue === 2 ? '36px' : '30px', // Larger font size for active
                  color:
                    state._fnrValue === 2
                      ? 'rgba(255, 255, 255, 1)' // Highlight active
                      : 'rgba(255, 255, 255, 0.5)', // Dim inactive
                  transition: 'all 0.3s ease', // Smooth transitions
                }}
              >
                R
              </span>
            </div>
          </div>

          {/* Center Section: Dynamic Speed */}
          <div
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column', // Stack speed and unit
              alignItems: 'center',
              marginLeft: '25px',
            }}
          >
            <span
              style={{
                fontSize: '58px',
                color: 'rgba(255, 255, 255, 1)',
              }}
            >
              {state._currentSpeed || 0}
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

          {/* Right Section: Dynamic Battery */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              textAlign: 'right',
              position: 'relative',
              right: '-25px', // Moves the section to the right without affecting others
            }}
          >
            <span
              style={{
                fontSize: '25px',
                color: 'rgba(255, 255, 255, 1)',
                marginRight: '5px', // Add space between text and icon
              }}
            >
              {state._batteryValue || 0}%
            </span>
            <BatteryGauge
              value={state._batteryValue || 0}
              size={50}
              animated={true}
              customization={{
                readingText: {
                  lightContrastColor: '#111',
                  darkContrastColor: '#fff',
                  lowBatteryColor: 'red',
                  fontFamily: 'Helvetica',
                  fontSize: 0,
                  showPercentage: true,
                },
              }}
            />
          </div>
        </div>

        {/* Bottom Navigation */}
        <div
          style={{
            position: 'fixed',
            bottom: -5,
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '18px 0',
            zIndex: 32,
          }}
        >
          {/* Left Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              transform: ' translateY(-20px) translateX(125px)', // Move group closer to the Home button
            }}
          >
            <button
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '15px',
                transform: `rotate(${
                  state.button1Rotation || 0
                }deg) translateY(0px)`, // Adjust rotation and position //25 -20

                cursor: 'pointer',
                color: 'rgba(129, 130, 133, 0.9)',
                transition: 'transform 0.3s ease',

                marginRight: '5px', // Reduce spacing
              }}
              onClick={() => {}}
            >
              ECO
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '20px',
                transform: `rotate(${state.button2Rotation || 0}deg)`,
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.9)',

                transition: 'transform 0.3s ease',
                marginRight: '-15px',
              }}
              onClick={() => {}}
            >
              NORMAL
            </button>
          </div>

          {/* Home Button */}
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
            <FiHome color="white" size={50} />
          </button>

          {/* Right Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              transform: ' translateY(-20px) translateX(-138px)', // Move group closer to the Home button
            }}
          >
            <button
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '15px',
                transform: `rotate(${state.button3Rotation || 0}deg)`,
                cursor: 'pointer',
                color: 'rgba(129, 130, 133, 0.9)',
                transition: 'transform 0.3s ease',
                marginRight: '-25px',
              }}
              onClick={() => {}}
            >
              SPORT
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '15px',
                transform: `rotate(${
                  state.button1Rotation || 0
                }deg) translateY(0px)`, // Adjust rotation and position                cursor: 'pointer', //-25 20
                color: 'rgba(129, 130, 133, 0.9)',

                transition: 'transform 0.3s ease',
                marginLeft: '35px',
              }}
              onClick={() => {}}
            >
              RACE
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
export default App

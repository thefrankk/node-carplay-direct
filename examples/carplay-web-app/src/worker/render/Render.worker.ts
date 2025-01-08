// Based on https://github.com/codewithpassion/foxglove-studio-h264-extension/tree/main
// MIT License
import { getDecoderConfig, isKeyFrame } from './lib/utils'
import { InitEvent, RenderEvent, WorkerEvent } from './RenderEvents'
import { WebGL2Renderer } from './WebGL2Renderer'
import { WebGLRenderer } from './WebGLRenderer'
import { WebGPURenderer } from './WebGPURenderer'

export interface FrameRenderer {
  draw(data: VideoFrame): void
}

// eslint-disable-next-line no-restricted-globals
const scope = self as unknown as Worker

type HostType = Window & typeof globalThis

export class RenderWorker {
  constructor(private host: HostType) {}

  private renderer: FrameRenderer | null = null
  private videoPort: MessagePort | null = null
  private pendingFrame: VideoFrame | null = null
  private startTime: number | null = null
  private frameCount = 0
  private timestamp = 0
  private fps = 0

  private onVideoDecoderOutput = (frame: VideoFrame) => {
    // Update statistics.
    if (this.startTime == null) {
      this.startTime = performance.now()
    } else {
      const elapsed = (performance.now() - this.startTime) / 1000
      this.fps = ++this.frameCount / elapsed
    }

    // Schedule the frame to be rendered.
    this.renderFrame(frame)
  }

  private renderFrame = (frame: VideoFrame) => {
    if (!this.pendingFrame) {
      // Schedule rendering in the next animation frame.
      requestAnimationFrame(this.renderAnimationFrame)
    } else {
      // Close the current pending frame before replacing it.
      this.pendingFrame.close()
    }
    // Set or replace the pending frame.
    this.pendingFrame = frame
  }

  private renderAnimationFrame = () => {
    if (this.pendingFrame) {
      this.renderer?.draw(this.pendingFrame)
      this.pendingFrame = null
    }
  }

  private onVideoDecoderOutputError = (err: Error) => {
    console.error(`H264 Render worker decoder error`, err)
  }

  private decoder = new VideoDecoder({
    output: this.onVideoDecoderOutput,
    error: this.onVideoDecoderOutputError,
  })

  init = (event: InitEvent) => {
    switch (event.renderer) {
      case 'webgl':
        this.renderer = new WebGLRenderer(event.canvas)
        break
      case 'webgl2':
        this.renderer = new WebGL2Renderer(event.canvas)
        break
      case 'webgpu':
        this.renderer = new WebGPURenderer(event.canvas)
        break
    }
    this.videoPort = event.videoPort
    this.videoPort.onmessage = ev => {
      this.onFrame(ev.data as RenderEvent)
    }

    if (event.reportFps) {
      setInterval(() => {
        if (this.decoder.state === 'configured') {
          console.debug(`FPS: ${this.fps}`)
        }
      }, 5000)
    }
  }

  onFrame = async (event: RenderEvent) => {
    const frameData = new Uint8Array(event.frameData)

    // Only configure if the decoder is unconfigured:
    if (this.decoder.state === 'unconfigured') {
      const decoderConfig = getDecoderConfig(frameData)
      if (!decoderConfig) {
        console.error('Failed to get valid decoder configuration.')
        return
      }

      // Debug logs:
      console.log('Decoder Config:', decoderConfig)
      console.log('Frame Data:', frameData)

      // Example check for H.264 config validity (allowing "avc1.XXXX"):
      if (
        !decoderConfig.codec.startsWith('avc1') ||
        decoderConfig.codedWidth <= 0 ||
        decoderConfig.codedHeight <= 0
      ) {
        console.error('Invalid or unsupported configuration:', decoderConfig)
        return
      }

      try {
        // 1. Check support first:
        try {
          const supportInfo =
            await VideoDecoder.isConfigSupported(decoderConfig)
          if (!supportInfo.supported) {
            console.error(
              'Unsupported decoder configuration:',
              supportInfo.config,
            )
            // Optionally, still try configuring to see if you get a more descriptive error:
            this.decoder.configure(supportInfo.config)
          } else {
            // If it says it's supported, just configure normally:
            this.decoder.configure(decoderConfig)
          }
        } catch (error) {
          // Usually 'NotSupportedError'
          console.error(
            'Error during decoder configuration:',
            error.name,
            error.message,
            error,
          )
        }

        // 2. If supported, configure the decoder:
        this.decoder.configure(decoderConfig)
      } catch (error) {
        // For example: NotSupportedError if the browser rejects it
        console.error('Error during decoder configuration:', error)
        return
      }
    }

    // If the decoder is configured, decode the incoming frame chunk.
    if (this.decoder.state === 'configured') {
      try {
        this.decoder.decode(
          new EncodedVideoChunk({
            type: isKeyFrame(frameData) ? 'key' : 'delta',
            data: frameData,
            timestamp: this.timestamp++,
          }),
        )
      } catch (e) {
        console.error('H264 Render Worker decode error:', e)
      }
    }
  }
}

// eslint-disable-next-line no-restricted-globals
const worker = new RenderWorker(self)
scope.addEventListener('message', (event: MessageEvent<WorkerEvent>) => {
  if (event.data.type === 'init') {
    worker.init(event.data as InitEvent)
  }
})

export {}

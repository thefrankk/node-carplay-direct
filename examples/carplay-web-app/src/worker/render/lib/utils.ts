// Based on https://github.com/codewithpassion/foxglove-studio-h264-extension/tree/main
// MIT License
import { Bitstream, NALUStream, SPS } from './h264-utils'

type GetNaluResult = { type: NaluTypes; nalu: Uint8Array; rawNalu: Uint8Array }

enum NaluTypes {
  NDR = 1,
  IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  AUD = 9,
}

function getNaluFromStream(
  buffer: Uint8Array,
  type: NaluTypes,
): GetNaluResult | null {
  const stream = new NALUStream(buffer, { type: 'annexB' })

  for (const nalu of stream.nalus()) {
    if (nalu?.nalu) {
      const bitstream = new Bitstream(nalu.nalu)
      bitstream.seek(3)
      const nal_unit_type = bitstream.u(5)
      if (nal_unit_type === type) {
        return { type: nal_unit_type, ...nalu }
      }
    }
  }

  return null
}

function isKeyFrame(frameData: Uint8Array): boolean {
  const idr = getNaluFromStream(frameData, NaluTypes.IDR)
  return Boolean(idr)
}

function getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
  const spsNalu = getNaluFromStream(frameData, NaluTypes.SPS)
  if (spsNalu) {
    const sps = new SPS(spsNalu.nalu)

    // Extract codec MIME (e.g., 'avc1.64002A')
    const codec = sps.MIME

    // Ensure the codec starts with 'avc1' (H.264)
    if (!codec.startsWith('avc1')) {
      console.error('Unsupported codec:', codec)
      return null // Reject unsupported codec
    }

    // Extract level from the codec string (after 'avc1.')
    const levelHex = codec.split('.')[1] // e.g., '64002A'
    const level = parseInt(levelHex, 16) // Convert to numeric value

    // Validate that the level is supported (Baseline Profile at different levels)
    let supportedLevel = false
    switch (level) {
      case 0x640020: // Baseline Profile Level 2.0
      case 0x64002a:
      case 0x64001f: // Baseline Profile Level 3.0 (or 3.1, depending on hardware)
        supportedLevel = true
        break
      default:
        console.error('Unsupported level:', levelHex)
        return null // Reject unsupported level
    }

    if (!supportedLevel) {
      return null // Reject unsupported level
    }

    // Prepare the decoder configuration
    const decoderConfig: VideoDecoderConfig = {
      codec: sps.MIME, // codec like 'avc1.64002A'
      codedHeight: sps.picHeight,
      codedWidth: sps.picWidth,
    }

    console.log('Valid Decoder Config:', decoderConfig) // Log the valid config
    return decoderConfig
  }
  return null // No SPS found, invalid frame
}

// function getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
//   const spsNalu = getNaluFromStream(frameData, NaluTypes.SPS)
//   if (spsNalu) {
//     const sps = new SPS(spsNalu.nalu)
//     const decoderConfig: VideoDecoderConfig = {
//       codec: sps.MIME,
//       codedHeight: sps.picHeight,
//       codedWidth: sps.picWidth,
//     }
//     return decoderConfig
//   }
//   return null
// }

export { getDecoderConfig, isKeyFrame }

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

// function getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
//   const spsNalu = getNaluFromStream(frameData, NaluTypes.SPS)
//   if (spsNalu) {
//     const sps = new SPS(spsNalu.nalu)

//     // Extract MIME type (codec identifier)
//     const codec = sps.MIME

//     // Extract profile and level from codec string (e.g., 'avc1.64001E' or 'avc1.640020')
//     const [profile, levelHex] = codec.split('.')
//     const level = parseInt(levelHex, 16) // Parse level as an integer

//     // Validate profile and level
//     if (profile !== 'avc1') {
//       console.error('Unsupported profile:', profile)
//       return null
//     }

//     // Check the level
//     let supportedLevel = false
//     switch (level) {
//       case 0x640020: // Baseline Profile Level 2.0
//       case 0x64001e: // Baseline Profile Level 3.1
//         supportedLevel = true
//         break
//       default:
//         console.error('Unsupported level:', levelHex)
//         return null
//     }

//     if (!supportedLevel) {
//       return null // Return null if the level is unsupported
//     }

//     // Return valid configuration if supported
//     const decoderConfig: VideoDecoderConfig = {
//       codec: sps.MIME, // MIME type (e.g., 'avc1.64001E')
//       codedHeight: sps.picHeight, // Frame height
//       codedWidth: sps.picWidth, // Frame width
//     }

//     return decoderConfig
//   }
//   return null
// }

function getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
  const spsNalu = getNaluFromStream(frameData, NaluTypes.SPS)
  if (spsNalu) {
    const sps = new SPS(spsNalu.nalu)
    const decoderConfig: VideoDecoderConfig = {
      codec: sps.MIME,
      codedHeight: sps.picHeight,
      codedWidth: sps.picWidth,
    }
    return decoderConfig
  }
  return null
}

export { getDecoderConfig, isKeyFrame }

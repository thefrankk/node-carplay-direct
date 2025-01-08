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

const getDecoderConfig = (frameData: Uint8Array) => {
  // Extract codec information from frame data (e.g., using the first bytes or some other method)
  // You would need to inspect the actual frame data to find out what codec it's using

  // Dummy example to show the profile/level structure:
  const codec = 'avc1.64001E' // Change this dynamically based on actual frame data

  let profileLevel
  if (codec.startsWith('avc1')) {
    const levelHex = codec.slice(5) // Extracts the level (e.g., '64001E' or '640020')
    profileLevel = parseInt(levelHex, 16) // Convert hex to number

    // Example: Handle different profiles and levels
    switch (profileLevel) {
      case 0x640020: // Baseline Profile Level 2.0
        return { codec: 'avc1.640020', codedWidth: 752, codedHeight: 704 }
      case 0x64001e: // Baseline Profile Level 3.1
        return { codec: 'avc1.64001E', codedWidth: 752, codedHeight: 704 }
      // Add more cases if needed, depending on what profile/level you expect
      default:
        console.error(`Unsupported codec: ${codec}`)
        return null
    }
  }

  return null
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

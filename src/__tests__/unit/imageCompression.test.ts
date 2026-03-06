import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock browser-image-compression before importing our module
vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}))

import imageCompression from 'browser-image-compression'
import { compressImage } from '../../utils/imageCompression'

const mockCompress = vi.mocked(imageCompression)

function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

beforeEach(() => {
  mockCompress.mockReset()
})

describe('compressImage', () => {
  it('rejects PDF files with a user-facing error', async () => {
    const pdf = makeFile('doc.pdf', 1_000_000, 'application/pdf')
    await expect(compressImage(pdf)).rejects.toThrow('PDF files cannot be compressed')
  })

  it('also rejects files with .pdf extension regardless of type', async () => {
    const pdf = makeFile('doc.pdf', 500_000, 'application/octet-stream')
    await expect(compressImage(pdf)).rejects.toThrow('PDF files cannot be compressed')
  })

  it('passes through images under 5MB without compression', async () => {
    const small = makeFile('photo.jpg', 2_000_000)
    mockCompress.mockResolvedValue(small as unknown as File)

    const result = await compressImage(small)

    expect(mockCompress).toHaveBeenCalledWith(
      small,
      expect.objectContaining({ maxSizeMB: 4.5, maxWidthOrHeight: 1920 })
    )
    expect(result).toBe(small)
  })

  it('compresses images over 5MB', async () => {
    const large = makeFile('large.jpg', 8_000_000)
    const compressed = makeFile('large.jpg', 4_000_000)
    mockCompress.mockResolvedValue(compressed as unknown as File)

    const result = await compressImage(large)
    expect(result).toBe(compressed)
  })

  it('passes maxSizeMB: 4.5 and maxWidthOrHeight: 1920 to compressor', async () => {
    const img = makeFile('photo.png', 3_000_000, 'image/png')
    mockCompress.mockResolvedValue(img as unknown as File)

    await compressImage(img)

    expect(mockCompress).toHaveBeenCalledWith(img, {
      maxSizeMB: 4.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    })
  })
})

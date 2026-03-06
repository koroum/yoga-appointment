import imageCompression from 'browser-image-compression'

const OPTIONS = {
  maxSizeMB: 4.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

/**
 * Compress an image file before upload.
 * - Rejects PDFs with a user-facing error.
 * - Compresses images over 5MB to ≤4.5MB at max 1920px.
 * - Always calls the compressor (library handles no-op for small files).
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('PDF files cannot be compressed. Please upload an image file (JPEG, PNG, or WebP).')
  }

  return imageCompression(file, OPTIONS) as unknown as File
}

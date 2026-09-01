import type { ImageToDraw } from '@domain/pack'
import { coverRect, wrapText } from '@domain/rules/imageLayout'

/**
 * Drawing the pack images, on a canvas, in the interface.
 *
 * The interface is the only place with a canvas — which is a feature, not a
 * constraint: it means no ffmpeg to download, and the contributor could be shown
 * exactly what is being produced.
 *
 * The source image is served by our own protocol, so the canvas stays clean and
 * `toBlob` works; a remote image would taint it and refuse to export.
 */

/** Loads a picked file through the telmi-file protocol. */
const loadImage = (id: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`image illisible : ${id}`))
    image.src = window.telmi.fileUrl(id)
  })

export const drawPackImage = async (spec: ImageToDraw): Promise<Uint8Array> => {
  const source = await loadImage(spec.sourceId)

  const canvas = document.createElement('canvas')
  canvas.width = spec.width
  canvas.height = spec.height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('canvas indisponible')

  const rect = coverRect(source, spec)
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height)

  if (spec.caption !== null && spec.caption.trim() !== '') {
    const fontSize = Math.round(spec.height * 0.082)
    const padding = Math.round(spec.height * 0.05)
    context.font = `700 ${fontSize}px exo, sans-serif`
    context.textBaseline = 'bottom'

    const lines = wrapText(spec.caption, spec.width - padding * 2, 3, (text) => context.measureText(text).width)
    const lineHeight = Math.round(fontSize * 1.22)
    const blockHeight = lines.length * lineHeight

    // A dark band under the words: a title has to stay readable over any picture.
    const gradient = context.createLinearGradient(0, spec.height - blockHeight - padding * 2, 0, spec.height)
    gradient.addColorStop(0, 'rgba(20, 6, 36, 0)')
    gradient.addColorStop(0.45, 'rgba(20, 6, 36, 0.72)')
    gradient.addColorStop(1, 'rgba(20, 6, 36, 0.92)')
    context.fillStyle = gradient
    context.fillRect(0, spec.height - blockHeight - padding * 2, spec.width, blockHeight + padding * 2)

    context.fillStyle = '#ffffff'
    lines.forEach((line, index) => {
      context.fillText(line, padding, spec.height - padding - (lines.length - 1 - index) * lineHeight)
    })
  }

  if (spec.pagination !== null) {
    const fontSize = Math.round(spec.height * 0.05)
    const padding = Math.round(spec.height * 0.04)
    context.font = `400 ${fontSize}px exo, sans-serif`
    context.textBaseline = 'top'
    context.textAlign = 'right'
    context.fillStyle = 'rgba(255, 255, 255, 0.82)'
    context.shadowColor = 'rgba(20, 6, 36, 0.9)'
    context.shadowBlur = 6
    context.fillText(spec.pagination, spec.width - padding, padding)
    context.shadowBlur = 0
    context.textAlign = 'left'
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob === null) throw new Error(`export png impossible : ${spec.path}`)
  return new Uint8Array(await blob.arrayBuffer())
}

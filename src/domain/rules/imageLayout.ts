/**
 * How a title is laid out on a pack image.
 *
 * This is arithmetic, not drawing: text wrapping and aspect-ratio cropping are
 * where a picture goes wrong, and neither needs a canvas to be decided — only a
 * way to measure a string. Keeping it here means it is tested, and that the
 * layer barrier protects it from acquiring a DOM dependency.
 */

/** Measures the width of a string in the current font. */
export type Measure = (text: string) => number

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Fills the frame without distorting: the image is scaled up until it covers,
 * then centred, so the excess is cropped rather than squashed.
 */
export const coverRect = (
  source: { width: number; height: number },
  frame: { width: number; height: number }
): Rect => {
  if (source.width <= 0 || source.height <= 0) return { x: 0, y: 0, ...frame }
  const scale = Math.max(frame.width / source.width, frame.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height }
}

/**
 * Wraps text to `maxWidth`, keeping at most `maxLines` lines.
 *
 * A word longer than the line is kept rather than dropped — a title made of one
 * long word must still appear — and the last line is cut with an ellipsis rather
 * than allowed to overflow.
 */
export const wrapText = (
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: Measure
): string[] => {
  const words = text.trim().split(/\s+/).filter((word) => word !== '')
  if (words.length === 0 || maxLines < 1) return []

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (measure(candidate) <= maxWidth || current === '') {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines) {
      current = ''
      break
    }
  }
  if (current !== '' && lines.length < maxLines) lines.push(current)

  const last = lines[lines.length - 1]
  if (last !== undefined && measure(last) > maxWidth) {
    let cut = last
    while (cut.length > 1 && measure(`${cut}…`) > maxWidth) cut = cut.slice(0, -1)
    lines[lines.length - 1] = `${cut}…`
  }
  return lines
}

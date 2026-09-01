import { describe, expect, it } from 'vitest'
import { coverRect, wrapText } from '@domain/rules/imageLayout'

/** A monospace-ish measurer: 10 units per character. Predictable on purpose. */
const measure = (text: string): number => text.length * 10

describe('coverRect — filling the frame without distorting', () => {
  it('leaves a source of the same ratio untouched', () => {
    expect(coverRect({ width: 640, height: 480 }, { width: 640, height: 480 })).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480
    })
  })

  it('crops the sides of an image too wide, rather than squashing it', () => {
    const rect = coverRect({ width: 1000, height: 500 }, { width: 640, height: 480 })
    expect(rect.height).toBe(480)
    expect(rect.width).toBeCloseTo(960)
    // Centred: as much cropped left as right.
    expect(rect.x).toBeCloseTo(-160)
    expect(rect.y).toBe(0)
  })

  it('crops top and bottom of an image too tall', () => {
    const rect = coverRect({ width: 500, height: 1000 }, { width: 640, height: 480 })
    expect(rect.width).toBe(640)
    expect(rect.height).toBeCloseTo(1280)
    expect(rect.y).toBeCloseTo(-400)
  })

  it('scales a small image up until it covers', () => {
    const rect = coverRect({ width: 64, height: 48 }, { width: 640, height: 480 })
    expect(rect).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  })

  it('survives a source of no size rather than dividing by zero', () => {
    expect(coverRect({ width: 0, height: 0 }, { width: 640, height: 480 })).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480
    })
  })
})

describe('wrapText', () => {
  it('leaves a short title on one line', () => {
    expect(wrapText('Le Loup', 200, 3, measure)).toEqual(['Le Loup'])
  })

  it('breaks between words, never inside one', () => {
    expect(wrapText('Ava et la couronne du pouvoir', 120, 3, measure)).toEqual([
      'Ava et la',
      'couronne du',
      'pouvoir'
    ])
  })

  it('keeps a word longer than the line, cut with an ellipsis', () => {
    const lines = wrapText('anticonstitutionnellement', 100, 1, measure)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/…$/)
    expect(measure(lines[0]!)).toBeLessThanOrEqual(100)
  })

  it('never rends more lines than allowed', () => {
    const lines = wrapText('un deux trois quatre cinq six sept huit neuf dix', 60, 2, measure)
    expect(lines).toHaveLength(2)
  })

  it('cuts the last line rather than letting it overflow', () => {
    const lines = wrapText('Gouzabas Boucle-de-Feu et les cent bergeres chauves', 110, 2, measure)
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(110)
  })

  it('normalises the spacing it was given', () => {
    expect(wrapText('  Le    Loup  ', 200, 3, measure)).toEqual(['Le Loup'])
  })

  it('rends nothing for nothing', () => {
    expect(wrapText('', 200, 3, measure)).toEqual([])
    expect(wrapText('   ', 200, 3, measure)).toEqual([])
    expect(wrapText('Le Loup', 200, 0, measure)).toEqual([])
  })
})

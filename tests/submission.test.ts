import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, titleFromFilename } from '../src/renderer/src/submission/useSubmission'

describe('titleFromFilename', () => {
  it('drops the extension', () => {
    expect(titleFromFilename('Le Petit Chaperon rouge.mp3')).toBe('Le Petit Chaperon rouge')
  })

  it('drops a leading track number, whatever its punctuation', () => {
    expect(titleFromFilename('01 - Le Loup.mp3')).toBe('Le Loup')
    expect(titleFromFilename('02. Les Trois Cochons.mp3')).toBe('Les Trois Cochons')
    expect(titleFromFilename('3) Boucle d Or.mp3')).toBe('Boucle d Or')
    expect(titleFromFilename('04_Cendrillon.mp3')).toBe('Cendrillon')
  })

  it('turns underscores into spaces and collapses runs of spaces', () => {
    expect(titleFromFilename('Le_grand_méchant_loup.mp3')).toBe('Le grand méchant loup')
    expect(titleFromFilename('Trop    d   espaces.mp3')).toBe('Trop d espaces')
  })

  it('does not eat a number that belongs to the title', () => {
    expect(titleFromFilename('20 000 lieues sous les mers.mp3')).toBe('20 000 lieues sous les mers')
    expect(titleFromFilename('Ali Baba et les 40 voleurs.mp3')).toBe('Ali Baba et les 40 voleurs')
  })

  it('copes with an already clean name, and with an empty one', () => {
    expect(titleFromFilename('Cornebidouille')).toBe('Cornebidouille')
    expect(titleFromFilename('.mp3')).toBe('')
  })
})

describe('formatBytes', () => {
  it('picks the readable unit', () => {
    expect(formatBytes(512)).toBe('1 Ko')
    expect(formatBytes(88411)).toBe('86 Ko')
    expect(formatBytes(52 * 1024 ** 2)).toBe('52.0 Mo')
    expect(formatBytes(Math.round(1.7 * 1024 ** 3))).toBe('1.70 Go')
  })
})

describe('formatDuration', () => {
  it('shows a dash when the duration is unknown', () => {
    expect(formatDuration(null)).toBe('—')
  })

  it('switches to hours past sixty minutes', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(850.7)).toBe('14:11')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

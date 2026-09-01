import { describe, expect, it } from 'vitest'
import type { Chapter, PickedFile, Submission } from '@domain/model'
import { MARKERS } from '@domain/pack'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import { buildNodes, buildNotes, packUuid, planPack, slugify } from '@domain/rules/pack'

const file = (name: string, bytes = 1024): PickedFile => ({ id: `id-${name}`, name, bytes, from: 'disk' })

const chapter = (title: string): Chapter => ({
  key: `k-${title}`,
  title,
  audio: file(`${title}.mp3`),
  duration: 60,
  image: null
})

const submission = (titles: string[], over: Partial<Submission> = {}): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Contes du soir',
  category: 'Contes',
  description: 'Deux contes.',
  question: 'Quelle histoire veux-tu écouter ?',
  minAge: 5,
  cover: file('cover.jpg'),
  chapters: titles.map(chapter),
  rights: { status: 'own-work', source: 'moi', declaredBy: '@moi' },
  ...over
})

const identity = { uuid: 'fffffc-abc', version: 1 }

describe('buildNodes — the wiring, for any number of chapters', () => {
  it('starts on the question, which leads to the first menu entry', () => {
    const nodes = buildNodes(3, true, true)
    expect(nodes.startAction).toEqual({ action: 'q', index: 0 })
    expect(nodes.stages['q']?.ok).toEqual({ action: 'm', index: 0 })
  })

  it('lists every menu entry in the « m » action, in order', () => {
    expect(buildNodes(3, false, false).actions['m']).toEqual([
      { stage: 'm0' },
      { stage: 'm1' },
      { stage: 'm2' }
    ])
  })

  it('sends OK from a menu entry to its chapter', () => {
    const nodes = buildNodes(3, false, false)
    expect(nodes.stages['m1']?.ok).toEqual({ action: 's1', index: 0 })
    expect(nodes.actions['s1']).toEqual([{ stage: 's1' }])
  })

  it('forbids skipping forward while a chapter plays', () => {
    expect(buildNodes(2, false, false).stages['s0']?.control).toEqual({
      ok: false,
      home: true,
      autoplay: true
    })
  })

  it('sends HOME from a chapter back to its own menu entry', () => {
    expect(buildNodes(3, false, false).stages['s2']?.home).toEqual({ action: 'm', index: 2 })
  })

  it('makes the menu wrap: the last chapter returns to the first entry', () => {
    expect(buildNodes(3, false, false).stages['s2']?.ok).toEqual({ action: 'm', index: 0 })
    expect(buildNodes(3, false, false).stages['s1']?.ok).toEqual({ action: 'm', index: 2 })
  })

  it('handles a single chapter, which loops onto itself', () => {
    const nodes = buildNodes(1, false, false)
    expect(nodes.actions['m']).toEqual([{ stage: 'm0' }])
    expect(nodes.stages['s0']?.ok).toEqual({ action: 'm', index: 0 })
    expect(nodes.stages['s0']?.home).toEqual({ action: 'm', index: 0 })
  })

  it('always carries the back wiring the storyteller expects', () => {
    const nodes = buildNodes(1, false, false)
    expect(nodes.stages['backStage']).toEqual({
      image: null,
      audio: null,
      ok: { action: 'backChildAction', index: 0 },
      home: { action: 'backAction', index: 0 },
      control: { ok: true, home: false, autoplay: true }
    })
    expect(nodes.actions['backAction']).toEqual([{ stage: 'backStage' }])
    expect(nodes.actions['backChildAction']).toEqual([])
  })

  it('leaves the labels silent until a voice exists, and never the chapters', () => {
    const silent = buildNodes(2, false, false)
    expect(silent.stages['q']?.audio).toBeNull()
    expect(silent.stages['m0']?.audio).toBeNull()
    // The chapter itself always plays: that is the whole point of the pack.
    expect(silent.stages['s0']?.audio).toBe('s0.mp3')

    const spoken = buildNodes(2, true, true)
    expect(spoken.stages['q']?.audio).toBe('q.mp3')
    expect(spoken.stages['m0']?.audio).toBe('m0.mp3')
  })

  it('points each menu entry at its own picture', () => {
    const nodes = buildNodes(2, false, false)
    expect(nodes.stages['m0']?.image).toBe('m0.png')
    expect(nodes.stages['s0']?.image).toBeNull()
  })

  it('declares one stage pair per chapter, plus the question and the back stage', () => {
    const stages = Object.keys(buildNodes(4, false, false).stages).sort()
    expect(stages).toEqual(['backStage', 'm0', 'm1', 'm2', 'm3', 'q', 's0', 's1', 's2', 's3'])
  })
})

describe('planPack — every file the pack will contain', () => {
  it('accounts for all four markers ConvertZip demands', () => {
    const plan = planPack(submission(['Un', 'Deux']), identity)
    const produced = [
      'metadata.json',
      'nodes.json',
      ...plan.images.map((i) => i.path),
      ...plan.spoken.map((s) => s.path)
    ]
    for (const marker of MARKERS) expect(produced).toContain(marker)
  })

  it('draws the cover at 512 and the stage images at 640×480', () => {
    const plan = planPack(submission(['Un']), identity)
    const byPath = new Map(plan.images.map((i) => [i.path, i]))
    expect(byPath.get('cover.png')).toMatchObject({ width: 512, height: 512 })
    expect(byPath.get('title.png')).toMatchObject({ width: 640, height: 480 })
    expect(byPath.get('images/m0.png')).toMatchObject({ width: 640, height: 480 })
  })

  it('burns the chapter title and its rank into each menu image', () => {
    const plan = planPack(submission(['Un', 'Deux', 'Trois']), identity)
    expect(plan.images.find((i) => i.path === 'images/m1.png')).toMatchObject({
      caption: 'Deux',
      pagination: '2/3'
    })
  })

  it('falls back to the cover for a chapter without its own image', () => {
    const withImage = submission(['Un', 'Deux'])
    withImage.chapters[1]!.image = file('deux.jpg')
    const plan = planPack(withImage, identity)
    expect(plan.images.find((i) => i.path === 'images/m0.png')?.sourceId).toBe('id-cover.jpg')
    expect(plan.images.find((i) => i.path === 'images/m1.png')?.sourceId).toBe('id-deux.jpg')
  })

  it('copies each chapter audio under the name its stage expects', () => {
    const plan = planPack(submission(['Un', 'Deux']), identity)
    expect(plan.audios).toEqual([
      { path: 'audios/s0.mp3', sourceId: 'id-Un.mp3' },
      { path: 'audios/s1.mp3', sourceId: 'id-Deux.mp3' }
    ])
  })

  it('asks for title.mp3 even when nothing is spoken, since it is a marker', () => {
    const plan = planPack(submission(['Un']), identity)
    expect(plan.spoken).toEqual([{ path: 'title.mp3', text: 'Contes du soir' }])
  })

  it('adds the question and the labels once a voice exists', () => {
    const plan = planPack(submission(['Un', 'Deux']), { ...identity, spokenTitles: true })
    expect(plan.spoken.map((s) => s.path)).toEqual([
      'title.mp3',
      'audios/q.mp3',
      'audios/m0.mp3',
      'audios/m1.mp3'
    ])
  })

  it('skips the spoken question when the contributor left it empty', () => {
    const plan = planPack(submission(['Un'], { question: '  ' }), { ...identity, spokenTitles: true })
    expect(plan.spoken.map((s) => s.path)).toEqual(['title.mp3', 'audios/m0.mp3'])
    expect(plan.nodes.stages['q']?.audio).toBeNull()
  })

  it('writes a metadata Telmi-Sync will read, version included', () => {
    const plan = planPack(submission(['Un']), { uuid: 'fffffc-xyz', version: 3 })
    expect(plan.metadata).toEqual({
      title: 'Contes du soir',
      uuid: 'fffffc-xyz',
      image: 'cover.png',
      version: 3,
      category: 'Contes',
      description: 'Deux contes.',
      age: 5
    })
  })

  it('names the notes after the stages, so the Studio shows something useful', () => {
    const plan = planPack(submission(['Le Loup']), identity)
    expect(plan.notes['m0']).toEqual({ title: 'm0', notes: 'Le Loup' })
    expect(plan.notes['s0']).toEqual({ title: 'Le Loup', notes: '' })
    expect(plan.notes['q']?.notes).toBe('Quelle histoire veux-tu écouter ?')
  })
})

describe('buildNotes', () => {
  it('covers every stage that carries a meaning', () => {
    const notes = buildNotes(submission(['Un', 'Deux']))
    expect(Object.keys(notes).sort()).toEqual(['m0', 'm1', 'q', 's0', 's1'])
  })
})

describe('slugify', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('Les contes de la mère Pauline')).toBe('les-contes-de-la-mere-pauline')
    expect(slugify("C'est toi le sorcier !")).toBe('c-est-toi-le-sorcier')
  })

  it('never rends an empty name', () => {
    expect(slugify('')).toBe('histoire')
    expect(slugify('???')).toBe('histoire')
  })

  it('stays short enough for any filesystem', () => {
    expect(slugify('a'.repeat(200)).length).toBe(60)
  })
})

describe('packUuid', () => {
  it('keeps the family prefix Telmi packs use', () => {
    expect(packUuid('3f2a9c11-dead-beef')).toMatch(/^fffffc-/)
  })

  it('differs for two different sources', () => {
    expect(packUuid('aaa')).not.toBe(packUuid('bbb'))
  })
})

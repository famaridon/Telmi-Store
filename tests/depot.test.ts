import { describe, expect, it } from 'vitest'
import { formaterDuree, formaterOctets, titreDepuisNom } from '../src/renderer/src/depot/useDepot'

describe('titreDepuisNom', () => {
  it('retire l\'extension', () => {
    expect(titreDepuisNom('Le Petit Chaperon rouge.mp3')).toBe('Le Petit Chaperon rouge')
  })

  it('retire une numerotation de tete, quelle que soit sa ponctuation', () => {
    expect(titreDepuisNom('01 - Le Loup.mp3')).toBe('Le Loup')
    expect(titreDepuisNom('02. Les Trois Cochons.mp3')).toBe('Les Trois Cochons')
    expect(titreDepuisNom('3) Boucle d Or.mp3')).toBe('Boucle d Or')
    expect(titreDepuisNom('04_Cendrillon.mp3')).toBe('Cendrillon')
  })

  it('remplace les tirets bas et normalise les espaces', () => {
    expect(titreDepuisNom('Le_grand_méchant_loup.mp3')).toBe('Le grand méchant loup')
    expect(titreDepuisNom('Trop    d   espaces.mp3')).toBe('Trop d espaces')
  })

  it('ne mange pas un nombre qui fait partie du titre', () => {
    expect(titreDepuisNom('20 000 lieues sous les mers.mp3')).toBe('20 000 lieues sous les mers')
    expect(titreDepuisNom('Ali Baba et les 40 voleurs.mp3')).toBe('Ali Baba et les 40 voleurs')
  })

  it('supporte un nom deja propre ou vide', () => {
    expect(titreDepuisNom('Cornebidouille')).toBe('Cornebidouille')
    expect(titreDepuisNom('.mp3')).toBe('')
  })
})

describe('formaterOctets', () => {
  it('choisit l\'unite lisible', () => {
    expect(formaterOctets(512)).toBe('1 Ko')
    expect(formaterOctets(88411)).toBe('86 Ko')
    expect(formaterOctets(52 * 1024 ** 2)).toBe('52.0 Mo')
    expect(formaterOctets(Math.round(1.7 * 1024 ** 3))).toBe('1.70 Go')
  })
})

describe('formaterDuree', () => {
  it('affiche un tiret quand la duree est inconnue', () => {
    expect(formaterDuree(null)).toBe('—')
  })

  it('passe aux heures au-dela de soixante minutes', () => {
    expect(formaterDuree(0)).toBe('0:00')
    expect(formaterDuree(65)).toBe('1:05')
    expect(formaterDuree(850.7)).toBe('14:11')
    expect(formaterDuree(3661)).toBe('1:01:01')
  })
})

import ErrorBanner from '../presentation/ErrorBanner'
import { formatDuration } from '../presentation/format'
import { useRecorder } from './useRecorder'
import type { Voices } from './useVoices'

interface Props {
  voices: Voices
}

/**
 * Recording the labels the storyteller says out loud.
 *
 * The target audience is three to six years old — children who cannot read yet —
 * so a silent menu is a real loss: they would see a title they cannot decipher.
 * A parent's voice does the job better than any synthesis, and takes two minutes.
 */
function VoicePanel({ voices }: Props): React.JSX.Element {
  const recorder = useRecorder(voices.keep)

  return (
    <section>
      <h2>
        La voix{' '}
        {voices.recorded.size > 0 && (
          <span className="count">
            {voices.recorded.size} / {voices.labels.length}
          </span>
        )}
      </h2>
      <p className="hint">
        La conteuse annonce chaque titre à voix haute — c’est ce qui permet à un enfant qui ne
        lit pas encore de choisir. Dis-les au micro : ta voix vaut mieux que n’importe quelle
        synthèse. <strong>Étape facultative</strong> : sans enregistrement, les titres restent
        lisibles sur les images.
      </p>

      {recorder.error && <ErrorBanner error={recorder.error} onDismiss={recorder.dismissError} />}
      {voices.error && <ErrorBanner error={voices.error} onDismiss={voices.dismissError} />}

      <ul className="voices">
        {voices.labels.map((label) => {
          const active = recorder.state.step === 'recording' && recorder.state.path === label.path
          const seconds = recorder.state.step === 'recording' ? recorder.state.seconds : 0
          const busy = recorder.state.step === 'recording'
          const voice = voices.recorded.get(label.path)
          return (
            <li key={label.path} className="voice">
              <span className="voice-text">
                {label.text.trim() === '' ? <em className="quiet">(sans titre)</em> : label.text}
              </span>

              {voice && !active && (
                <>
                  <audio controls preload="metadata" src={voice.url} />
                  <span className="figure">{formatDuration(voice.seconds)}</span>
                </>
              )}

              {active ? (
                <button type="button" className="primary" onClick={recorder.stop}>
                  ■ arrêter ({seconds.toFixed(1)} s)
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => recorder.start(label.path)}>
                  {voice ? 'refaire' : '● enregistrer'}
                </button>
              )}

              {voice && !active && (
                <button type="button" className="link" onClick={() => voices.drop(label.path)}>
                  retirer
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {voices.recorded.size > 0 && (
        <p className="hint voice-state">
          {voices.complete ? (
            <>
              ✓ Tous les titres du menu sont enregistrés : la conteuse les dira à voix haute.
            </>
          ) : (
            <>
              Il reste {voices.missing} titre(s) à dire. Tant qu’il en manque, la conteuse
              n’annoncera <strong>aucun</strong> titre — mieux vaut un menu entièrement muet
              qu’un menu qui parle une fois sur deux.
            </>
          )}{' '}
          <button type="button" className="link" onClick={voices.dropAll}>
            tout effacer
          </button>
        </p>
      )}
    </section>
  )
}

export default VoicePanel

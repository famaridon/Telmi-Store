import { useState } from 'react'
import type { DeviceCode } from '@domain/auth'

interface Props {
  code: DeviceCode
  onOpen: () => void
  onCancel: () => void
}

/**
 * The waiting screen of the Device Flow.
 *
 * The code is the biggest thing here on purpose: it is the only thing the
 * contributor has to do something with. The three steps are numbered because
 * they really are a sequence, and doing them out of order does not work.
 */
function DeviceFlowSteps({ code, onOpen, onCancel }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Copying is a convenience; the code stays readable on screen.
    }
  }

  return (
    <div className="device-flow">
      <ol className="device-steps">
        <li>
          <button type="button" className="primary" onClick={onOpen}>
            Ouvrir github.com/login/device
          </button>
        </li>
        <li>
          <span>Saisis ce code :</span>
          <button type="button" className="device-code" title="Cliquer pour copier" onClick={() => void copy()}>
            {code.userCode}
          </button>
          <span className="quiet">{copied ? 'copié' : 'clique pour copier'}</span>
        </li>
        <li>Autorise l’application, et reviens ici.</li>
      </ol>

      <p className="device-waiting">
        <span className="pulse" aria-hidden="true"></span>
        J’attends ton autorisation. Cette page se mettra à jour toute seule.
      </p>

      <button type="button" className="link" onClick={onCancel}>
        annuler
      </button>
    </div>
  )
}

export default DeviceFlowSteps

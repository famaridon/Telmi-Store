import type { AppError } from '@domain/errors'
import { describeError } from './messages'

interface Props {
  error: AppError
  onDismiss?: () => void
}

/** A failure always says what happened. Never a spinner that turns forever. */
function ErrorBanner({ error, onDismiss }: Props): React.JSX.Element {
  const shown = describeError(error)
  return (
    <div className="error" role="alert">
      <strong>{shown.message}</strong>
      {shown.detail && <code>{shown.detail}</code>}
      {onDismiss && (
        <button type="button" className="link" onClick={onDismiss}>
          fermer
        </button>
      )}
    </div>
  )
}

export default ErrorBanner

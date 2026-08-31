import { useState } from 'react'
import type { FileKind, PickedFile } from '@shared/types'
import type { IpcError } from '@shared/ipc'

interface Props {
  kind: FileKind
  placeholder: string
  onAdd: (files: PickedFile[]) => void
  onError: (error: IpcError) => void
}

/** URL field with progress: the download happens in the main process. */
function UrlField({ kind, placeholder, onAdd, onError }: Props): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    const address = url.trim()
    if (address === '' || busy) return

    setBusy(true)
    setProgress('connexion…')
    const unsubscribe = window.telmi.on('download:progress', ({ received, total }) => {
      setProgress(
        total === null ? `${(received / 1024 ** 2).toFixed(1)} Mo reçus` : `${Math.round((received / total) * 100)} %`
      )
    })

    const r = await window.telmi.files.download(address, kind)
    unsubscribe()
    setBusy(false)
    setProgress(null)

    if (r.ok) {
      onAdd([r.value])
      setUrl('')
    } else {
      onError(r.error)
    }
  }

  return (
    <div className="url-field">
      <input
        type="url"
        value={url}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
      />
      <button type="button" disabled={busy || url.trim() === ''} onClick={() => void submit()}>
        {busy ? (progress ?? '…') : 'Récupérer'}
      </button>
    </div>
  )
}

export default UrlField

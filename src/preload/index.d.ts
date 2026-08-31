import type { TelmiApi } from './index'

declare global {
  interface Window {
    telmi: TelmiApi
  }
}

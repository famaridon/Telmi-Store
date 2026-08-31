import type { ApiTelmi } from './index'

declare global {
  interface Window {
    telmi: ApiTelmi
  }
}

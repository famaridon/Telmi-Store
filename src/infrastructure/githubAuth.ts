import type { DeviceCode, Identity, PollOutcome } from '@domain/auth'
import { REQUIRED_SCOPE } from '@domain/auth'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { GitHubAuth } from '@domain/ports'
import { parseScopes } from '@domain/rules/auth'

/**
 * GitHub's three endpoints for the Device Flow.
 *
 * No client secret anywhere: the flow exists precisely because a desktop
 * application cannot keep one. The `clientId` identifies the application and is
 * public.
 */
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const USER_URL = 'https://api.github.com/user'

const TIMEOUT_MS = 20_000

interface DeviceCodeBody {
  device_code?: string
  user_code?: string
  verification_uri?: string
  expires_in?: number
  interval?: number
  error?: string
}

interface TokenBody {
  access_token?: string
  scope?: string
  error?: string
}

interface UserBody {
  login?: string
  name?: string | null
}

const askGitHub = async <T>(url: string, body: Record<string, string>): Promise<Result<T>> => {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (e) {
    return fail({ code: 'auth/github-unreachable', cause: causeOf(e) })
  }

  const text = await response.text()
  if (!response.ok) {
    return fail({ code: 'auth/github-refused', status: response.status, body: text.slice(0, 300) })
  }
  try {
    return ok(JSON.parse(text) as T)
  } catch {
    return fail({ code: 'auth/github-refused', status: response.status, body: text.slice(0, 300) })
  }
}

export const createGitHubAuth = (clientId: string): GitHubAuth => ({
  async requestDeviceCode(): Promise<Result<DeviceCode>> {
    if (clientId === '') return fail({ code: 'auth/not-configured' })

    const answer = await askGitHub<DeviceCodeBody>(DEVICE_CODE_URL, {
      client_id: clientId,
      scope: REQUIRED_SCOPE
    })
    if (!answer.ok) return answer
    const body = answer.value

    // The most likely misconfiguration: the OAuth App exists but its owner
    // never ticked "Enable Device Flow".
    if (body.error === 'device_flow_disabled') return fail({ code: 'auth/device-flow-disabled' })
    if (body.error !== undefined || body.device_code === undefined || body.user_code === undefined) {
      return fail({ code: 'auth/github-refused', status: 200, body: body.error ?? 'reponse incomplete' })
    }

    return ok({
      deviceCode: body.device_code,
      userCode: body.user_code,
      verificationUri: body.verification_uri ?? 'https://github.com/login/device',
      expiresIn: body.expires_in ?? 900,
      interval: body.interval ?? 5
    })
  },

  async poll(deviceCode: string): Promise<Result<PollOutcome>> {
    const answer = await askGitHub<TokenBody>(TOKEN_URL, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
    if (!answer.ok) return answer
    const body = answer.value

    if (body.access_token !== undefined) {
      return ok({ status: 'granted', token: body.access_token, scopes: parseScopes(body.scope ?? '') })
    }

    // Every refusal below is expected traffic, not a failure of ours.
    switch (body.error) {
      case 'authorization_pending':
        return ok({ status: 'pending' })
      case 'slow_down':
        return ok({ status: 'slow-down' })
      case 'expired_token':
        return ok({ status: 'expired' })
      case 'access_denied':
        return ok({ status: 'denied' })
      case 'device_flow_disabled':
        return fail({ code: 'auth/device-flow-disabled' })
      default:
        return fail({ code: 'auth/github-refused', status: 200, body: body.error ?? 'reponse incomplete' })
    }
  },

  async identify(token: string): Promise<Result<Identity>> {
    let response: Response
    try {
      response = await fetch(USER_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (e) {
      return fail({ code: 'auth/github-unreachable', cause: causeOf(e) })
    }

    if (!response.ok) {
      return fail({
        code: 'auth/github-refused',
        status: response.status,
        body: (await response.text()).slice(0, 300)
      })
    }

    const body = (await response.json()) as UserBody
    if (body.login === undefined) {
      return fail({ code: 'auth/github-refused', status: response.status, body: 'reponse sans login' })
    }
    return ok({ login: body.login, name: body.name ?? null })
  }
})

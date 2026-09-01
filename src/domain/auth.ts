/**
 * Signing in to GitHub, as the Device Flow describes it.
 *
 * The shape of the exchange, and why it looks like this:
 *
 *   1. The application asks GitHub for a pair of codes. It keeps the secret one
 *      (`deviceCode`) and shows the human one (`userCode`) to the contributor.
 *   2. The contributor opens `verificationUri` in a browser and types the human
 *      code. That is where the password is entered — in GitHub's own page, never
 *      in the application.
 *   3. Meanwhile the application polls GitHub with the secret code: "has anyone
 *      approved this yet?" Once the contributor approves, the poll answers with
 *      a token.
 *
 * The application therefore never handles a password, and needs no client
 * secret: the `clientId` is public by design, which is exactly why this flow
 * exists for desktop applications whose code anyone can read.
 */

/** What GitHub hands back when the flow starts. */
export interface DeviceCode {
  /** Secret. Identifies this attempt; never shown. */
  deviceCode: string
  /** Shown to the contributor, e.g. "WDJB-MJHT". */
  userCode: string
  /** Where the contributor types it. */
  verificationUri: string
  /** Seconds before the attempt dies. */
  expiresIn: number
  /** Minimum seconds between two polls. GitHub refuses a faster pace. */
  interval: number
}

/** The answer to one poll, as data. */
export type PollOutcome =
  /** Nobody has approved yet. Normal, and the common case. */
  | { status: 'pending' }
  /** We polled too fast. GitHub asks for a slower pace. */
  | { status: 'slow-down' }
  /** The attempt died of old age. A new code is needed. */
  | { status: 'expired' }
  /** The contributor said no. */
  | { status: 'denied' }
  /** Approved. */
  | { status: 'granted'; token: string; scopes: string[] }

/**
 * Who a token belongs to.
 *
 * No avatar on purpose: it would be fetched from avatars.githubusercontent.com,
 * and the renderer loads nothing from the network. The login is what identifies
 * a contributor anyway.
 */
export interface Identity {
  login: string
  name: string | null
}

/** A signed-in contributor. */
export interface Session {
  identity: Identity
  scopes: string[]
}

/** What the application is allowed to do. Nothing more is ever asked. */
export const REQUIRED_SCOPE = 'public_repo'

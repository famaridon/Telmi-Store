/**
 * The identifier of our GitHub OAuth App — "Telmi Store", owned by @famaridon.
 *
 * Committed on purpose. A client id identifies an application, it does not
 * authenticate it: RFC 8252 classifies native applications as public clients,
 * unable to keep a secret, which is precisely why the Device Flow exists. No
 * client secret is involved anywhere in this project.
 *
 * What keeps someone from reusing it to impersonate us is GitHub's own
 * authorization page, which names the application and its owner.
 *
 * The environment variable stays useful for pointing a build at another OAuth
 * App — a fork, or a test one. Left empty, signing in reports
 * `auth/not-configured` and the interface explains what to create.
 */
export const GITHUB_CLIENT_ID =
  process.env['TELMI_STORE_GITHUB_CLIENT_ID'] ?? 'Ov23likVrp9mwsOFlqtu'

/**
 * The store a proposal goes to.
 *
 * A single one for now. The directory of stores is a later stage; until then the
 * interface shows this name so nobody proposes into the wrong repository by
 * accident.
 */
export const DEFAULT_STORE_REPO = process.env['TELMI_STORE_REPO'] ?? 'famaridon/telmi-store-dev'

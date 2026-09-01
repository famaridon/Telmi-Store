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
 * Where the directory of stores is read from.
 *
 * A file, not a constant: adding a store must cost one pull request on it rather
 * than a new release of this application.
 */
export const STORE_DIRECTORY_URL =
  process.env['TELMI_STORE_DIRECTORY'] ??
  'https://raw.githubusercontent.com/famaridon/Telmi-Store/main/annuaire/stores.json'

/**
 * The store aimed at when the directory cannot be reached at all.
 *
 * Offline, or a directory that moved: better to keep working against one known
 * store than to refuse everything.
 */
export const FALLBACK_STORE_REPO = 'famaridon/telmi-store-dev'

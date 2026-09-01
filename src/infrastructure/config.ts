/**
 * The identifier of our GitHub OAuth App.
 *
 * It is public: the Device Flow exists so a desktop application, whose code
 * anyone can read, can sign a user in without keeping a secret. Committing it is
 * therefore correct, not a leak.
 *
 * As long as it is empty, signing in reports `auth/not-configured` and the
 * interface explains what to create on GitHub — rather than failing obscurely.
 *
 * To create it: github.com/settings/applications/new, then tick
 * "Enable Device Flow" in the application's settings.
 */
export const GITHUB_CLIENT_ID = process.env['TELMI_STORE_GITHUB_CLIENT_ID'] ?? ''

import type { DeviceCode, Identity, PollOutcome } from './auth'
import type { AppError, Result } from './errors'
import type { FileKind, LocalStory, PickedFile } from './model'
import type { BuiltPack, PackPlan } from './pack'
import type { Proposal } from './proposals'
import type { Proposed, ProposeRequest } from './propose'

/**
 * What the application needs from the outside world, expressed as interfaces it
 * owns. Adapters live in src/infrastructure and depend on these; nothing here
 * depends on them.
 */

/** Telmi-Sync's library. Read-only: we never write into it. */
export interface StoryLibrary {
  list(): Promise<Result<LocalStory[]>>
}

/**
 * Keeper of the files the contributor picked. Holds the capability table that
 * the `telmi-file://` protocol reads, and is the only component that knows a path.
 */
export interface FileVault {
  /** Registers a path and describes it, or explains why it is unusable. */
  admit(path: string, kind: FileKind, url?: string): Promise<Result<PickedFile>>
  /** Resolves an id granted by `admit`. Null for anything else. */
  resolve(id: string): string | null
  /** Absolute path of a fresh, unique file to write into. */
  reserve(name: string): Promise<Result<string>>
  /** Forgets and deletes everything written through `reserve`. */
  clear(): Promise<void>
}

/** Asks the user for files. Implemented with the native dialog. */
export interface FilePicker {
  pick(kind: FileKind, multiple: boolean): Promise<Result<PickedFile[]>>
}

export type ProgressReport = (received: number, total: number | null) => void

/** Fetches a remote file into the vault. */
export interface Fetcher {
  fetchInto(url: string, kind: FileKind, onProgress: ProgressReport): Promise<Result<PickedFile>>
}

/**
 * GitHub's side of the Device Flow. Three exchanges, each returning data:
 * ask for a code, poll once, then find out whose token it is.
 */
export interface GitHubAuth {
  requestDeviceCode(): Promise<Result<DeviceCode>>
  /** One poll. An expected refusal is an outcome, not an error. */
  poll(deviceCode: string): Promise<Result<PollOutcome>>
  identify(token: string): Promise<Result<Identity>>
}

/** An asset published in a release, as the world can now reach it. */
export interface PublishedAsset {
  /** Stable public URL. Redirects to a signed one, which is normal. */
  url: string
  bytes: number
}

/**
 * Publishing the pack in a repository the CONTRIBUTOR owns.
 *
 * Every operation is idempotent, because a publication interrupted halfway must
 * be resumable: relaunching must not create a second repository, a duplicate
 * release, or two assets of the same name.
 */
export interface GitHubRepos {
  /** Creates the repository if absent. Rends its « owner/name ». */
  ensureRepo(token: string, name: string, description: string): Promise<Result<string>>
  /** Creates the release for that tag if absent. Rends its id. */
  ensureRelease(token: string, repo: string, tag: string, body: string): Promise<Result<number>>
  /** Replaces any asset already carrying that name. */
  putAsset(
    token: string,
    repo: string,
    releaseId: number,
    fileName: string,
    path: string,
    onProgress: ProgressReport
  ): Promise<Result<PublishedAsset>>
  /** Confirms the public URL answers, and with the size we uploaded. */
  checkPublic(url: string, expectedBytes: number): Promise<Result<void>>
}

/**
 * Proposing an entry to a store, through a pull request.
 *
 * No repository is ever cloned: six REST calls put two small files on a branch
 * of the contributor's own fork, and open the proposal. Idempotent like the
 * publication — correcting a proposal updates the branch and the existing pull
 * request rather than opening a second one.
 */
export interface GitHubPulls {
  propose(token: string, request: ProposeRequest): Promise<Result<Proposed>>
  /** The contributor's own proposals to that store, with what was said on them. */
  mine(token: string, storeRepo: string): Promise<Result<Proposal[]>>
}

/** Where the token sleeps between two sessions. Never in the renderer. */
export interface TokenStore {
  read(): Promise<Result<string | null>>
  write(token: string): Promise<Result<void>>
  clear(): Promise<Result<void>>
}

/** Lets the application wait without knowing about timers, so tests run fast. */
export type Sleep = (seconds: number) => Promise<void>

/** The desktop around the application: the browser, the file manager. */
export interface Shell {
  openUrl(url: string): Promise<void>
  /** Shows a file in the system's file manager. */
  revealFile(path: string): Promise<void>
}

/**
 * A file the interface produced: an image it drew, a label it recorded.
 *
 * These are the only bytes that ever cross the boundary, and they are small.
 * Chapter audio never does — only the ids that resolve to paths.
 */
export interface PackFile {
  path: string
  bytes: Uint8Array
}

/**
 * Writes a pack from its plan.
 *
 * Only the interface has a canvas and a microphone, so it hands over what it
 * produced; the writer checks that every file the plan names is there.
 */
export interface PackWriter {
  write(plan: PackPlan, files: PackFile[]): Promise<Result<BuiltPack>>
}

/** Everything the use cases need, gathered so the composition root wires it once. */
export interface Ports {
  library: StoryLibrary
  vault: FileVault
  picker: FilePicker
  fetcher: Fetcher
  auth: GitHubAuth
  repos: GitHubRepos
  pulls: GitHubPulls
  tokens: TokenStore
  shell: Shell
  packs: PackWriter
  sleep: Sleep
}

export type { AppError, Result }

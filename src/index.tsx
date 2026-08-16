import * as orchestrator from "@mfe-orchestrator-hub/client"
import { configure, globalVariables, type Manifest, manifest, type OrchestratorConfig, remoteUrl } from "@mfe-orchestrator-hub/client"
import { type ReactNode, useRef } from "react"
import { type AsyncState, useAsync } from "./useAsync"

export type { GlobalVariable, Identities, Manifest, Microfrontend, OrchestratorConfig } from "@mfe-orchestrator-hub/client"
export type { AsyncState } from "./useAsync"

/**
 * Tells the core that the host configures the client through this package, so a missing or invalid
 * `backendUrl` / `projectId` is reported with the `<OrchestratorProvider>` snippet instead of the
 * bare `configure()` one.
 *
 * Guarded and cast on purpose: older cores do not expose the hook, and a nicer error message is
 * never worth a crash. Called both at load, for hooks used without a provider, and inside the
 * provider, in case a bundler drops a top level call it believes to be side effect free.
 */
const declareIntegration = (): void => {
    ;(orchestrator as unknown as { registerIntegration?: (integration: string) => void }).registerIntegration?.("react")
}

declareIntegration()

/**
 * Replaces the logged in user, so a *User* canary is decided on the new one from the next resolution
 * on. Pass `undefined` on logout. It drops the memoized manifest of the core, which a second
 * `configure()` deliberately does not.
 *
 * Remotes already imported keep the version drawn for the previous user: the federation runtime holds
 * the container it loaded. Resolve your remotes behind your own auth guard, or reload after the switch.
 *
 * Guarded like `registerIntegration`: a host still on a core that predates this call gets a warning
 * naming the upgrade, not a crash on an import that resolves to undefined.
 */
export const setUserId = (userId: OrchestratorConfig["userId"]): void => {
    const call = (orchestrator as unknown as { setUserId?: (value: OrchestratorConfig["userId"]) => void }).setUserId
    if (!call) {
        console.warn(
            "[@mfe-orchestrator-hub/client-react] setUserId() is not available in the installed @mfe-orchestrator-hub/client, so the user was not changed and the canary still sees the previous one. Upgrade that package."
        )
        return
    }
    call(userId)
}

export interface OrchestratorProviderProps {
    config: OrchestratorConfig
    children?: ReactNode
}

/**
 * Keeps the core in step with the `userId` of the provider config across renders.
 *
 * The first render is skipped: `configure()` has just carried that value itself, and calling the
 * setter on top of it would drop a manifest that may already be in flight — and would do it on every
 * render when the host passes a getter, since a function is always taken as a change.
 */
const useSyncedUserId = (userId: OrchestratorConfig["userId"]): void => {
    const applied = useRef<{ known: boolean; value: OrchestratorConfig["userId"] }>({ known: false, value: undefined })
    if (applied.current.known && Object.is(applied.current.value, userId)) {
        return
    }
    const changed = applied.current.known
    applied.current = { known: true, value: userId }
    if (changed) {
        setUserId(userId)
    }
}

/**
 * Hands the configuration to `@mfe-orchestrator-hub/client` and renders its children.
 *
 * `configure()` runs in the render pass, before any child renders, and is idempotent, so re renders
 * and StrictMode double invocations are harmless. It stays a convenience: the recommended place is
 * still the very top of the entry point, since a bundler may import a remote before React mounts.
 *
 * The one option that keeps being read after the first render is `config.userId`: pass the user from
 * your auth state and a login, a logout or an account switch reaches the core on its own, through
 * `setUserId()`. Everything else in the config is fixed for the page load, as `configure()` says.
 */
export const OrchestratorProvider = ({ config, children }: OrchestratorProviderProps) => {
    declareIntegration()
    configure(config)
    useSyncedUserId(config.userId)
    return <>{children}</>
}

/** The ready to use, version pinned URL of a remote. Use it verbatim. */
export const useRemoteUrl = (slug: string): AsyncState<string> => useAsync(() => remoteUrl(slug), [slug])

/** The global variables of the environment, as a plain object. */
export const useGlobalVariables = (): AsyncState<Record<string, string>> => useAsync(() => globalVariables(), [])

/** The whole manifest of the environment. */
export const useManifest = (): AsyncState<Manifest> => useAsync(() => manifest(), [])

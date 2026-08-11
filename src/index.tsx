import { configure, globalVariables, type Manifest, manifest, type OrchestratorConfig, remoteUrl } from "@mfe-orchestrator-hub/client"
import type { ReactNode } from "react"
import { type AsyncState, useAsync } from "./useAsync"

export type { GlobalVariable, Identities, Manifest, Microfrontend, OrchestratorConfig } from "@mfe-orchestrator-hub/client"
export type { AsyncState } from "./useAsync"

export interface OrchestratorProviderProps {
    config: OrchestratorConfig
    children?: ReactNode
}

/**
 * Hands the configuration to `@mfe-orchestrator-hub/client` and renders its children.
 *
 * `configure()` runs in the render pass, before any child renders, and is idempotent, so re renders
 * and StrictMode double invocations are harmless. It stays a convenience: the recommended place is
 * still the very top of the entry point, since a bundler may import a remote before React mounts.
 */
export const OrchestratorProvider = ({ config, children }: OrchestratorProviderProps) => {
    configure(config)
    return <>{children}</>
}

/** The ready to use, version pinned URL of a remote. Use it verbatim. */
export const useRemoteUrl = (slug: string): AsyncState<string> => useAsync(() => remoteUrl(slug), [slug])

/** The global variables of the environment, as a plain object. */
export const useGlobalVariables = (): AsyncState<Record<string, string>> => useAsync(() => globalVariables(), [])

/** The whole manifest of the environment. */
export const useManifest = (): AsyncState<Manifest> => useAsync(() => manifest(), [])

import type { ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** React refuses to run updates outside act() unless the environment says it is a test. */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const baseConfig = { backendUrl: "https://console.test/api", projectId: "p1" }

/**
 * A stand in for the core package. `setUserId` can be dropped from it, which is what a host still on
 * a core that predates the call actually has.
 */
const createCore = (overrides: Record<string, unknown> = {}) => ({
    configure: vi.fn(),
    registerIntegration: vi.fn(),
    remoteUrl: vi.fn(async () => "https://console.test/serve/mfe/files/auto/p1/checkout/_v/1.0.0/assets/remoteEntry.js"),
    manifest: vi.fn(async () => ({ globalVariables: [], microfrontends: [] })),
    globalVariables: vi.fn(async () => ({})),
    setUserId: vi.fn(),
    ...overrides
})

/**
 * A fresh module registry per test, so the mocked core is the one the adapter imports and the refs
 * kept across renders start empty.
 */
const loadAdapter = async (core: ReturnType<typeof createCore> | Record<string, unknown>) => {
    vi.resetModules()
    vi.doMock("@mfe-orchestrator-hub/client", () => core)
    return await import("../src/index")
}

interface Mounted {
    rerender: (element: ReactNode) => Promise<void>
    unmount: () => Promise<void>
}

const mount = async (element: ReactNode): Promise<Mounted> => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    let root: Root | undefined
    await act(async () => {
        root = createRoot(container)
        root.render(element)
    })
    return {
        rerender: async next => {
            await act(async () => {
                root?.render(next)
            })
        },
        unmount: async () => {
            await act(async () => {
                root?.unmount()
            })
            container.remove()
        }
    }
}

describe("@mfe-orchestrator-hub/client-react", () => {
    let mounted: Mounted | undefined

    beforeEach(() => {
        mounted = undefined
    })

    afterEach(async () => {
        await mounted?.unmount()
        vi.doUnmock("@mfe-orchestrator-hub/client")
    })

    describe("OrchestratorProvider", () => {
        it("given a provider rendered for the first time, when it mounts, then the configuration is handed over and the user is not set again on top of it", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)

            expect(core.configure).toHaveBeenCalledWith({ ...baseConfig, userId: "user-1" })
            expect(core.setUserId).not.toHaveBeenCalled()
        })

        it("given the user changed in the provider config, when it renders again, then the core is told about the new one", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: "user-2" }}>child</OrchestratorProvider>)

            expect(core.setUserId).toHaveBeenCalledTimes(1)
            expect(core.setUserId).toHaveBeenCalledWith("user-2")
        })

        it("given a user that logs out, when the provider renders without one, then undefined reaches the core", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: undefined }}>child</OrchestratorProvider>)

            expect(core.setUserId).toHaveBeenCalledExactlyOnceWith(undefined)
        })

        it("given the same user, when the provider renders again with a brand new config object, then nothing is set and no request is thrown away", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)

            expect(core.setUserId).not.toHaveBeenCalled()
        })

        it("given a getter kept stable across renders, when the provider renders again, then it is not taken as a change", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)
            const currentUserId = () => "user-1"

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: currentUserId }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: currentUserId }}>child</OrchestratorProvider>)

            expect(core.setUserId).not.toHaveBeenCalled()
        })

        it("given a getter recreated on every render, when the provider renders again, then it is taken as a change, which is why a stable reference is documented", async () => {
            const core = createCore()
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: () => "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: () => "user-1" }}>child</OrchestratorProvider>)

            expect(core.setUserId).toHaveBeenCalledTimes(1)
        })
    })

    describe("setUserId", () => {
        it("given a core that exposes it, when the user is set, then the call is forwarded untouched", async () => {
            const core = createCore()
            const { setUserId } = await loadAdapter(core)

            setUserId("user-9")

            expect(core.setUserId).toHaveBeenCalledExactlyOnceWith("user-9")
        })

        it("given a core that predates the call, when the user is set, then it does not throw and warns naming the package to upgrade", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
            const { setUserId } = await loadAdapter(createCore({ setUserId: undefined }))

            setUserId("user-9")

            expect(warn).toHaveBeenCalledTimes(1)
            expect(String(warn.mock.calls[0][0])).toContain("@mfe-orchestrator-hub/client")
            warn.mockRestore()
        })

        it("given a core that predates the call, when the provider follows a user change, then the page keeps rendering", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
            const core = createCore({ setUserId: undefined })
            const { OrchestratorProvider } = await loadAdapter(core)

            mounted = await mount(<OrchestratorProvider config={{ ...baseConfig, userId: "user-1" }}>child</OrchestratorProvider>)
            await mounted.rerender(<OrchestratorProvider config={{ ...baseConfig, userId: "user-2" }}>child</OrchestratorProvider>)

            expect(warn).toHaveBeenCalledTimes(1)
            expect(document.body.textContent).toContain("child")
            warn.mockRestore()
        })
    })
})

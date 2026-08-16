# @mfe-orchestrator-hub/client-react

**Part of [MFE Orchestrator](https://mfe-orchestrator.dev)** — the control plane for your
microfrontends. The site is the short version; the
[documentation](https://mfe-orchestrator.dev/documentation/docs/integration/client-sdk) is where this
package sits in context: environments, deployments, canary releases.

React bindings for [`@mfe-orchestrator-hub/client`](https://github.com/mfe-orchestrator/client-core).

Ergonomics only. Every decision — which version is served, how the manifest is fetched, how the
identities are kept — lives in the core. This package is a provider and three hooks.

## Install

```sh
pnpm add @mfe-orchestrator-hub/client-react
```

`@mfe-orchestrator-hub/client` comes along as a dependency. `react` is a peer dependency (18 or 19).

## Usage

```tsx
import { OrchestratorProvider, useRemoteUrl, useGlobalVariables, useManifest } from "@mfe-orchestrator-hub/client-react"

const App = () => (
    <OrchestratorProvider
        config={{
            backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
            projectId: import.meta.env.VITE_MFE_PROJECT_ID
        }}
    >
        <Checkout />
    </OrchestratorProvider>
)
```

`OrchestratorProvider` calls `configure()` before its children render, and `configure()` is
idempotent, so re renders and StrictMode double invocations are harmless.

It stays a convenience. The recommended place is still the very top of the entry point, because a
bundler may import a remote before React ever mounts:

```ts
import { configure } from "@mfe-orchestrator-hub/client"

configure({ backendUrl: "…", projectId: "…" })
```

Both are fine together: the provider's second call is the no op.

### `environment` is optional

Leave `environment` out and the console resolves it server side, matching the domain the host page
is served on against the domains configured on the project's environments. One build then runs
unchanged in staging and in production, with no environment variable to thread through the host. If
no environment of the project claims that domain, the manifest request fails and every hook reports
the error.

Pass it explicitly when the domain alone cannot tell the environments apart — several environments
behind one host, a local dev server, a preview deployment:

```tsx
<OrchestratorProvider
    config={{
        backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
        projectId: import.meta.env.VITE_MFE_PROJECT_ID,
        environment: import.meta.env.VITE_MFE_ENVIRONMENT
    }}
>
```

Nothing changes for a host that already passes it. As with everything else here, the choice belongs
to the core: this package only hands `config` over, so omitting the field requires a
`@mfe-orchestrator-hub/client` that supports it.

### `useRemoteUrl(slug)`

```tsx
const Checkout = () => {
    const { data: url, error, loading } = useRemoteUrl("checkout-new")

    if (loading) return <Spinner />
    if (error) return <p>{error.message}</p>
    return <p>{url}</p>
}
```

The URL is already pinned to the version the backend resolved. Use it verbatim: never rebuild it and
never strip the `_v/<version>/` segment.

### `useGlobalVariables()`

```tsx
const { data: variables } = useGlobalVariables()
// { API_URL: "https://…" }
```

### `useManifest()`

```tsx
const { data: manifest } = useManifest()
// { globalVariables: [...], microfrontends: [...] }
```

Every hook returns the same shape:

```ts
interface AsyncState<TValue> {
    data: TValue | undefined
    error: Error | undefined
    loading: boolean
}
```

All of them read the one memoized manifest of the core, so N hooks across N components still cost a
single network request.

### `setUserId(userId)`

The logged-in user is what a *User* canary is decided on, and it is the one thing that changes while
the page is alive. A second `configure()` is ignored on purpose, so it has its own call:

```tsx
import { setUserId } from "@mfe-orchestrator-hub/client-react"

auth.onLogin(user => setUserId(user.id))
auth.onLogout(() => setUserId(undefined)) // back to the stable version
```

`<OrchestratorProvider>` does it for you when the user lives in your React state: pass it in the
config and every change reaches the core.

```tsx
<OrchestratorProvider config={{ backendUrl, projectId, userId: session?.user.id }}>
```

Either way the memoized manifest is dropped, so the next `useRemoteUrl()` is answered for the new
user. Remotes **already imported** keep the version drawn for the previous one — the federation
runtime holds the container it loaded — so resolve them behind your own auth guard, or reload the page
after the switch.

Needs a `@mfe-orchestrator-hub/client` that exposes `setUserId()`. On an older core the call warns and
does nothing rather than crashing.

### With module federation

The hooks are for the app's own logic. The remote itself is wired in the bundler config, which talks
to the core directly — see the
[core README](https://github.com/mfe-orchestrator/client-core#bundler-configuration).

## Development

```sh
pnpm install
pnpm test        # vitest
pnpm build       # tsup, ESM + CJS + types
pnpm typecheck
```

## License

MIT © Lorenzo De Francesco

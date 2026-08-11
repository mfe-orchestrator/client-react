# @mfe-orchestrator/client-react

React bindings for [`@mfe-orchestrator/client`](https://github.com/mfe-orchestrator/client-core).

Ergonomics only. Every decision — which version is served, how the manifest is fetched, how the
identities are kept — lives in the core. This package is a provider and three hooks.

## Install

```sh
pnpm add @mfe-orchestrator/client-react
```

`@mfe-orchestrator/client` comes along as a dependency. `react` is a peer dependency (18 or 19).

## Usage

```tsx
import { OrchestratorProvider, useRemoteUrl, useGlobalVariables, useManifest } from "@mfe-orchestrator/client-react"

const App = () => (
    <OrchestratorProvider
        config={{
            backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
            projectId: import.meta.env.VITE_MFE_PROJECT_ID,
            environment: import.meta.env.VITE_MFE_ENVIRONMENT
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
import { configure } from "@mfe-orchestrator/client"

configure({ backendUrl: "…", projectId: "…", environment: "…" })
```

Both are fine together: the provider's second call is the no op.

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

### With module federation

The hooks are for the app's own logic. The remote itself is wired in the bundler config, which talks
to the core directly — see the
[core README](https://github.com/mfe-orchestrator/client-core#bundler-configuration).

## Development

```sh
pnpm install
pnpm build       # tsup, ESM + CJS + types
pnpm typecheck
```

## License

MIT © Lorenzo De Francesco

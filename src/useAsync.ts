import { type DependencyList, useEffect, useState } from "react"

/** The state of one asynchronous read from the core. */
export interface AsyncState<TValue> {
    data: TValue | undefined
    error: Error | undefined
    loading: boolean
}

const toError = (thrown: unknown): Error => (thrown instanceof Error ? thrown : new Error(String(thrown)))

/**
 * Runs `task` and tracks its outcome. Late results of a superseded run are dropped, so a slug that
 * changes while a previous resolution is still in flight cannot overwrite the newer answer.
 */
export const useAsync = <TValue>(task: () => Promise<TValue>, deps: DependencyList): AsyncState<TValue> => {
    const [state, setState] = useState<AsyncState<TValue>>({ data: undefined, error: undefined, loading: true })

    useEffect(() => {
        let active = true
        setState(previous => (previous.loading ? previous : { ...previous, loading: true }))
        task().then(
            data => {
                if (active) {
                    setState({ data, error: undefined, loading: false })
                }
            },
            thrown => {
                if (active) {
                    setState({ data: undefined, error: toError(thrown), loading: false })
                }
            }
        )
        return () => {
            active = false
        }
        // biome-ignore lint/correctness/useExhaustiveDependencies: the caller owns the dependency list, exactly like the core hooks it wraps
    }, deps)

    return state
}

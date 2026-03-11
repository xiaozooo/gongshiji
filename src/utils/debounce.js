/**
 * Simple debounce utility
 */
export function createDebouncer(ms = 800) {
    let timer = null
    let pendingFn = null

    function schedule(fn) {
        pendingFn = fn
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            if (pendingFn) pendingFn()
            timer = null
            pendingFn = null
        }, ms)
    }

    function flush() {
        if (timer && pendingFn) {
            clearTimeout(timer)
            pendingFn()
            timer = null
            pendingFn = null
        }
    }

    function cancel() {
        if (timer) clearTimeout(timer)
        timer = null
        pendingFn = null
    }

    return { schedule, flush, cancel }
}

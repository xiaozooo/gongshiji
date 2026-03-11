/**
 * Import conflict detection utilities
 */

/**
 * Classify incoming records against existing records index.
 * Returns array of { record, status: 'new'|'id_conflict'|'likely_duplicate', existingId? }
 */
export function detectConflicts(existingRecords, incomingRecords) {
    const idSet = new Set(existingRecords.map(r => r.id))
    const keyMap = new Map()
    for (const r of existingRecords) {
        const key = `${r.jobId}|${r.startTimestamp}|${Number(r.hours).toFixed(2)}`
        keyMap.set(key, r.id)
    }

    return incomingRecords.map(rec => {
        if (rec.id && idSet.has(rec.id)) {
            return { record: rec, status: 'id_conflict', existingId: rec.id }
        }
        const key = `${rec.jobId}|${rec.startTimestamp}|${Number(rec.hours).toFixed(2)}`
        if (keyMap.has(key)) {
            return { record: rec, status: 'likely_duplicate', existingId: keyMap.get(key) }
        }
        return { record: rec, status: 'new' }
    })
}

export function summarizeConflicts(conflicts) {
    const counts = { new: 0, id_conflict: 0, likely_duplicate: 0 }
    for (const c of conflicts) counts[c.status]++
    return counts
}

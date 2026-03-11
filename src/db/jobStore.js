import { getDB } from './database.js'
import { pickJobColor } from '../utils/colors.js'

export const DEFAULT_JOB_NAME = '小时工'
export const DEFAULT_JOB_WAGE = 10

function newJob(name, wage, currency = '', notes = '', isDefault = false) {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    return {
        id,
        name: name.trim(),
        wage: Number(wage) || 0,
        currency,
        notes,
        color: pickJobColor(id),
        isDefault,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
    }
}

export async function createJob(name, wage, currency = '', notes = '') {
    const db = await getDB()
    const job = newJob(name, wage, currency, notes, false)
    await db.put('jobs', job)
    return job
}

export async function updateJob(id, data) {
    const db = await getDB()
    const existing = await db.get('jobs', id)
    if (!existing) throw new Error('Job not found')
    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() }
    await db.put('jobs', updated)
    return updated
}

export async function softDeleteJob(id) {
    return updateJob(id, { isDeleted: true })
}

export async function restoreJob(id) {
    return updateJob(id, { isDeleted: false })
}

export async function getAllJobs(includeDeleted = false) {
    const db = await getDB()
    const all = await db.getAll('jobs')
    return includeDeleted ? all : all.filter(j => !j.isDeleted)
}

export async function getJob(id) {
    const db = await getDB()
    return db.get('jobs', id)
}

/** Set a job as the default, clearing isDefault from all others */
export async function setDefaultJob(id) {
    const db = await getDB()
    const all = await db.getAll('jobs')
    const tx = db.transaction('jobs', 'readwrite')
    for (const job of all) {
        const shouldBeDefault = job.id === id
        if (job.isDefault !== shouldBeDefault) {
            await tx.store.put({ ...job, isDefault: shouldBeDefault, updatedAt: new Date().toISOString() })
        }
    }
    await tx.done
}

/** Get the default job (first active job with isDefault=true) */
export async function getDefaultJob() {
    const all = await getAllJobs()
    return all.find(j => j.isDefault) || null
}

/**
 * Ensure at least one default job exists.
 * Called on app startup. If no jobs exist, creates a default one.
 * If jobs exist but none is default, sets the first one as default.
 */
export async function ensureDefaultJob() {
    const all = await getAllJobs()
    if (all.length === 0) {
        // First launch: create default job
        const db = await getDB()
        const job = newJob(DEFAULT_JOB_NAME, DEFAULT_JOB_WAGE, '', '', true)
        await db.put('jobs', job)
        return job
    }
    // If no default set, make the first active job default
    const hasDefault = all.some(j => j.isDefault)
    if (!hasDefault) {
        await setDefaultJob(all[0].id)
        return { ...all[0], isDefault: true }
    }
    return all.find(j => j.isDefault)
}

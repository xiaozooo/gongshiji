export const JOB_COLOR_PALETTE = [
    '#2563eb',
    '#16a34a',
    '#ea580c',
    '#0891b2',
    '#dc2626',
    '#7c3aed',
    '#0f766e',
    '#c2410c',
    '#1d4ed8',
    '#be123c'
]

function hashCode(str) {
    let h = 0
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    return h
}

export function pickJobColor(seed) {
    if (!seed) return JOB_COLOR_PALETTE[0]
    const idx = Math.abs(hashCode(String(seed))) % JOB_COLOR_PALETTE.length
    return JOB_COLOR_PALETTE[idx]
}

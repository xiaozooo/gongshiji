export function getWagePlaceholder(job) {
  return job ? `¥${job.wage}` : '工价'
}

export function getWageInputValueForEdit(recordWage, jobWage) {
  const record = Number(recordWage)
  const job = Number(jobWage)
  if (!Number.isFinite(record)) return ''
  if (Number.isFinite(job) && record === job) return ''
  return String(recordWage)
}

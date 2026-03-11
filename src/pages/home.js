import { getAllJobs, getDefaultJob } from '../db/jobStore.js'
import { addRecord, getLatestRecord, getRecordsByDateAndJob, getOverlappingRecords } from '../db/recordStore.js'
import { showToast } from '../components/toast.js'
import { showModalPromise } from '../components/modal.js'
import { getLocalDate, getYearMonth, formatHours, calcMinutes, calcNetWorkMinutes, localDateTimeToISO } from '../utils/time.js'
import { pickJobColor } from '../utils/colors.js'
import { resolveCopyDate } from '../utils/recordCopy.js'

export const DEFAULT_START_TIME = '09:00'
export const DEFAULT_END_TIME = '17:00'

export function getWagePlaceholder(job) {
  return job ? `¥${job.wage}` : '工价'
}

export function getHomeMemoFieldMarkup() {
  return ''
}

export function formatWorkDurationHours(workMinutes) {
  const hours = (Number(workMinutes) || 0) / 60
  return Number(hours.toFixed(2)).toString()
}

export function formatWorkMinutesBreakdown(totalMinutes, breakMinutes) {
  if (totalMinutes <= 0) return ''
  const workMinutes = calcNetWorkMinutes(totalMinutes, breakMinutes)
  return `总${totalMinutes}分钟 - 休息${breakMinutes}分钟 = 工作${workMinutes}分钟`
}

/** Format Date to YYYY-MM-DD for date input */
function toDateValue(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Format Date to HH:MM for time input */
function toTimeValue(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  const [jobs, defaultJob] = await Promise.all([getAllJobs(), getDefaultJob()])
  const displayJobs = [...jobs].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })
  let selectedJobId = defaultJob?.id || null
  const initDate = new Date()
  const defaultStartTime = DEFAULT_START_TIME
  const defaultEndTime = DEFAULT_END_TIME

  page.innerHTML = `
    <div class="page-header">
      <span class="page-title">工时记</span>
      <span style="font-size:13px;color:var(--color-text-muted);" id="home-date-label">${formatTodayLabel()}</span>
    </div>
    <div class="page-content">

      ${jobs.length === 0 ? `
        <div class="card" style="margin-bottom:var(--space-4);border-color:#fcd34d;background:#fffbeb;">
          <div style="font-size:20px;margin-bottom:4px;">💼</div>
          <div class="text-sm text-secondary">
            还没有工作，请前往 <a href="#settings" style="color:var(--color-primary)">设置</a> 添加。
          </div>
        </div>
      ` : ''}

      <!-- Job -->
      <div class="form-group">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:8px;">
          <label class="form-label" style="margin-bottom:0;">工作</label>
          <button type="button" class="btn btn-ghost btn-sm" id="home-copy-last">复制上一次</button>
        </div>
        <div id="home-job-picker" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label">日期</label>
        <input type="date" class="form-input" id="home-date" value="${toDateValue(initDate)}" />
        <div class="form-hint">默认当天，可选择其他日期用于补录</div>
      </div>

      <!-- Start / End Time -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
        <div class="form-group">
          <label class="form-label">开始时间</label>
          <input type="time" class="form-input" id="home-start" step="600" value="${defaultStartTime}" />
        </div>
        <div class="form-group">
          <label class="form-label">结束时间</label>
          <input type="time" class="form-input" id="home-end" step="600" value="${defaultEndTime}" />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
        <div class="form-group">
          <label class="form-label">休息时长（可选）</label>
          <input type="number" class="form-input" id="home-break" inputmode="numeric" min="0" step="10" placeholder="分钟" />
        </div>
        <div class="form-group">
          <label class="form-label">工价（可选）</label>
          <input type="number" class="form-input" id="home-wage" inputmode="decimal" min="0" step="0.5" placeholder="${getWagePlaceholder(defaultJob)}" />
        </div>
      </div>

      <!-- Time validation hint -->
      <div id="home-time-hint" class="form-error" style="margin-top:-12px;margin-bottom:var(--space-3);min-height:16px;"></div>

      <!-- Duration display -->
      <div class="card-white" style="text-align:center;margin-bottom:var(--space-4);">
        <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.4px;">工作时长</div>
        <div class="minute-display">
          <span id="home-min-num">0</span><span class="minute-unit">小时</span>
        </div>
        <div id="home-hour-sub" style="font-size:13px;color:var(--color-text-muted);min-height:18px;"></div>
        <div id="home-gross" style="font-size:14px;color:var(--color-accent);font-weight:500;min-height:20px;margin-top:4px;"></div>
      </div>

      ${getHomeMemoFieldMarkup()}

      <div style="display:flex;gap:var(--space-3);">
        <button class="btn btn-ghost" id="home-reset" style="flex:1;">重置</button>
        <button class="btn btn-primary btn-lg" id="home-save" style="flex:1;" disabled>保存记录</button>
      </div>
    </div>
  `

  function formatTodayLabel() {
    return new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  const jobPicker = page.querySelector('#home-job-picker')
  const dateIn = page.querySelector('#home-date')
  const startIn = page.querySelector('#home-start')
  const endIn = page.querySelector('#home-end')
  const timeHint = page.querySelector('#home-time-hint')
  const minNum = page.querySelector('#home-min-num')
  const hourSub = page.querySelector('#home-hour-sub')
  const gross = page.querySelector('#home-gross')
  const wageIn = page.querySelector('#home-wage')
  const breakIn = page.querySelector('#home-break')
  const copyLastBtn = page.querySelector('#home-copy-last')
  const saveBtn = page.querySelector('#home-save')
  const resetBtn = page.querySelector('#home-reset')

  function getJob() { return jobs.find(j => j.id === selectedJobId) }

  function renderJobPicker() {
    jobPicker.innerHTML = displayJobs.map(j => {
      const active = j.id === selectedJobId
      const border = active ? 'var(--color-primary)' : 'var(--color-border-dark)'
      const bg = active ? 'var(--color-primary-light)' : 'var(--color-bg)'
      const jobColor = j.color || pickJobColor(j.id)
      const titleColor = active ? jobColor : 'var(--color-text-secondary)'
      const metaColor = active ? jobColor : 'var(--color-text-muted)'
      return `<button type="button" class="btn" data-job-id="${j.id}" style="border:1px solid ${border};background:${bg};padding:10px 12px;min-width:132px;text-align:left;line-height:1.35;display:flex;flex-direction:column;align-items:flex-start;">
        <div style="font-weight:600;font-size:14px;color:${titleColor};">${j.name}${j.isDefault ? ' ★' : ''}</div>
        <div style="font-size:12px;color:${metaColor};margin-top:2px;">¥${j.wage}/h</div>
      </button>`
    }).join('')
  }

  /** Get the effective wage: custom input or job default */
  function getEffectiveWage() {
    const custom = parseFloat(wageIn.value)
    if (!isNaN(custom) && custom >= 0) return custom
    const job = getJob()
    return job ? job.wage : 0
  }

  /** Build full ISO timestamps from date + time inputs */
  function getTimestamps() {
    const dateVal = dateIn.value
    const startTime = startIn.value
    const endTime = endIn.value
    if (!dateVal || !startTime || !endTime) return null
    if (endTime <= startTime) return null

    const startTs = localDateTimeToISO(dateVal, startTime)
    const endTs = localDateTimeToISO(dateVal, endTime)
    return { startTs, endTs }
  }

  function getCurrentMinutes() {
    const ts = getTimestamps()
    if (!ts) return 0
    return calcMinutes(ts.startTs, ts.endTs)
  }

  function getBreakMinutes() {
    const rest = parseInt(breakIn.value || '0', 10)
    return Math.max(0, Number.isFinite(rest) ? rest : 0)
  }

  function updateUI() {
    wageIn.placeholder = getWagePlaceholder(getJob())
    const startTime = startIn.value
    const endTime = endIn.value
    const totalMinutes = getCurrentMinutes()
    const breakMinutes = getBreakMinutes()
    const workMinutes = calcNetWorkMinutes(totalMinutes, breakMinutes)

    // Time validation hint
    if (startTime && endTime && endTime <= startTime) {
      timeHint.textContent = '结束时间必须晚于开始时间'
    } else if (totalMinutes > 0 && breakMinutes >= totalMinutes) {
      timeHint.textContent = '休息时长必须小于总时长'
    } else {
      timeHint.textContent = ''
    }

    minNum.textContent = formatWorkDurationHours(workMinutes)
    if (totalMinutes > 0) {
      hourSub.textContent = formatWorkMinutesBreakdown(totalMinutes, breakMinutes)
    } else {
      hourSub.textContent = ''
    }
    const wage = getEffectiveWage()
    if (workMinutes > 0 && wage > 0) {
      const workHours = workMinutes / 60
      gross.textContent = `预计收入：¥${(workHours * wage).toFixed(2)}`
    } else {
      gross.textContent = ''
    }
    saveBtn.disabled = !selectedJobId || workMinutes <= 0
  }

  jobPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-job-id]')
    if (!btn) return
    selectedJobId = btn.dataset.jobId || null
    renderJobPicker()
    updateUI()
  })
  dateIn.addEventListener('change', updateUI)
  startIn.addEventListener('change', updateUI)
  endIn.addEventListener('change', updateUI)
  wageIn.addEventListener('input', updateUI)
  breakIn.addEventListener('input', updateUI)

  resetBtn.addEventListener('click', () => {
    const nd = new Date()
    dateIn.value = toDateValue(nd)
    startIn.value = defaultStartTime
    endIn.value = defaultEndTime
    wageIn.value = ''
    breakIn.value = ''
    if (defaultJob) {
      selectedJobId = defaultJob.id
      renderJobPicker()
    }
    updateUI()
  })

  copyLastBtn.addEventListener('click', async () => {
    const last = await getLatestRecord()
    if (!last) {
      showToast('暂无可复制的历史记录', 'warning')
      return
    }
    const job = jobs.find(j => j.id === last.jobId)
    if (!job) {
      showToast('上一次记录的工作不存在或已归档', 'warning')
      return
    }
    const startTime = toTimeValue(new Date(last.startTimestamp))
    const endTime = toTimeValue(new Date(last.endTimestamp))
    if (endTime <= startTime) {
      showToast('上一次记录时间无效，无法复制', 'warning')
      return
    }
    selectedJobId = job.id
    renderJobPicker()
    dateIn.value = resolveCopyDate(last) || toDateValue(new Date())
    startIn.value = startTime
    endIn.value = endTime
    breakIn.value = last.breakMinutes ? String(last.breakMinutes) : ''
    wageIn.value = Number(last.wage) !== Number(job.wage) ? String(last.wage) : ''
    updateUI()
    showToast('已复制上一次记录')
  })

  saveBtn.addEventListener('click', doSave)

  async function doSave() {
    const ts = getTimestamps()
    if (!ts || !selectedJobId) return
    const totalMinutes = calcMinutes(ts.startTs, ts.endTs)
    const breakMinutes = getBreakMinutes()
    const workMinutes = calcNetWorkMinutes(totalMinutes, breakMinutes)
    if (workMinutes <= 0) return
    const hours = Math.round((workMinutes / 60) * 100) / 100
    const job = getJob(); if (!job) return
    const wage = getEffectiveWage()
    saveBtn.disabled = true; saveBtn.textContent = '保存中...'
    try {
      const date = getLocalDate(ts.startTs)

      // Same-day same-job check
      let skipOverlapCheck = false
      const sameDay = await getRecordsByDateAndJob(date, selectedJobId)
      if (sameDay.length > 0) {
        const existH = formatHours(sameDay.reduce((s, r) => s + r.hours, 0))
        const choice = await showModalPromise({
          title: '已存在当日同工作记录',
          description: `当天 ${job.name} 已记录 ${existH} 小时。`,
          options: [
            { label: '追加（新建一条）', value: 'append', type: 'accent' },
            { label: '合并（累加时长）', value: 'merge', type: 'primary' },
            { label: '取消', value: 'cancel', type: 'ghost' }
          ]
        })
        if (choice === 'cancel') { restoreSave(); return }
        if (choice === 'merge') {
          await doMerge(sameDay, ts, '', wage, breakMinutes)
          showToast('已合并工时记录')
          resetForm(); return
        }
        // 'append' chosen — skip overlap check since user explicitly wants to add
        skipOverlapCheck = true
      }

      // Overlap check (only if not appending to same-day records)
      if (!skipOverlapCheck) {
        const overlapping = await getOverlappingRecords(ts.startTs, ts.endTs)
        if (overlapping.length > 0) {
          const choice = await showModalPromise({
            title: '检测到时间重叠',
            description: `与已有 ${overlapping.length} 条记录时间重叠。`,
            options: [
              { label: '允许重叠继续保存', value: 'allow', type: 'warning' },
              { label: '取消', value: 'cancel', type: 'ghost' }
            ]
          })
          if (choice === 'cancel') { restoreSave(); return }
        }
      }

      await addRecord({
        jobId: selectedJobId,
        jobName: job.name,
        wage,
        breakMinutes,
        startTimestamp: ts.startTs,
        endTimestamp: ts.endTs,
        hours,
        date: getLocalDate(ts.startTs),
        yearMonth: getYearMonth(ts.startTs),
        memo: '',
        isSplit: false,
        source: 'manual'
      })
      showToast('记录已保存 ✓', 'success')
      resetForm()
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error'); restoreSave()
    }
  }

  async function doMerge(existing, newRange, memo, wage, addBreakMinutes) {
    const first = existing.reduce((a, b) => new Date(a.createdAt || a.startTimestamp) < new Date(b.createdAt || b.startTimestamp) ? a : b)
    const mergedStart = existing.reduce((min, r) => new Date(r.startTimestamp) < new Date(min) ? r.startTimestamp : min, newRange.startTs)
    const mergedEnd = existing.reduce((max, r) => new Date(r.endTimestamp) > new Date(max) ? r.endTimestamp : max, newRange.endTs)
    const totalBreakMinutes = existing.reduce((s, r) => s + (r.breakMinutes || 0), 0) + addBreakMinutes
    const totalMinutes = calcMinutes(mergedStart, mergedEnd)
    const workMinutes = calcNetWorkMinutes(totalMinutes, totalBreakMinutes)
    if (workMinutes <= 0) throw new Error('休息时长超过总时长，无法合并')
    const totalHours = Math.round((workMinutes / 60) * 100) / 100
    const mergedMemo = [...new Set([...existing.map(r => r.memo).filter(Boolean), memo].filter(Boolean))].join(', ')
    const { updateRecord, deleteRecord } = await import('../db/recordStore.js')
    await updateRecord(first.id, {
      startTimestamp: mergedStart,
      endTimestamp: mergedEnd,
      hours: totalHours,
      breakMinutes: totalBreakMinutes,
      date: getLocalDate(mergedStart),
      yearMonth: getYearMonth(mergedStart),
      wage,
      memo: mergedMemo,
      isSplit: false
    })
    for (const r of existing.slice(1)) await deleteRecord(r.id)
  }

  function resetForm() {
    const nd = new Date()
    dateIn.value = toDateValue(nd)
    startIn.value = defaultStartTime
    endIn.value = defaultEndTime
    wageIn.value = ''
    breakIn.value = ''
    restoreSave()
    updateUI()
  }
  function restoreSave() { saveBtn.disabled = false; saveBtn.textContent = '保存记录'; updateUI() }

  renderJobPicker()
  updateUI()
  return page
}

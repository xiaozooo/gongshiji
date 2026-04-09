import { getAllJobs, createJob, updateJob, softDeleteJob, restoreJob, setDefaultJob } from '../db/jobStore.js'
import { showToast } from '../components/toast.js'
import { showModal } from '../components/modal.js'
import { pickJobColor } from '../utils/colors.js'

/**
 * Standalone jobs management panel, rendered as a section block.
 * Returns a <div> element. Pass onChanged() to be notified after mutations.
 */
export async function renderJobsPanel(container) {
  await redraw(container)
}

async function redraw(container) {
  const jobs = await getAllJobs(true)
  const active = jobs.filter(j => !j.isDeleted)
  const archived = jobs.filter(j => j.isDeleted)

  container.innerHTML = `
    <div class="section-header" style="margin-bottom:var(--space-3);">
      <span class="section-title">工作管理</span>
      <button class="btn btn-ghost btn-sm" id="jp-add" style="color:var(--color-primary);font-weight:600;">
        <span style="font-size:16px;margin-right:2px;line-height:1;">+</span>新建工作
      </button>
    </div>

    ${active.length === 0 ? `
      <div style="text-align:center;padding:32px 0;color:var(--color-text-muted);font-size:14px;background:var(--color-card-bg);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);">
        暂无工作，点击右上角新建
      </div>
    ` : active.map(j => jobRow(j, false)).join('')}

    ${archived.length > 0 ? `
      <div style="background:var(--color-surface-2);padding:16px;border-radius:var(--radius-lg);margin-top:var(--space-6);">
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-title">已归档（${archived.length}）</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${archived.map(j => jobRow(j, true)).join('')}
        </div>
      </div>
    ` : ''}
  `

  // Add button
  container.querySelector('#jp-add').onclick = () => openJobForm(null, container)

  // Action buttons via data-attributes
  container.querySelectorAll('[data-jp-edit]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation()
      const id = btn.dataset.jpEdit
      const job = jobs.find(j => j.id === id)
      if (job) openJobForm(job, container)
    }
  })

  container.querySelectorAll('[data-jp-archive]').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation()
      const id = btn.dataset.jpArchive
      const job = jobs.find(j => j.id === id)
      if (!job) return
      await softDeleteJob(id)
      showToast(`"${job.name}" 已归档`, 'warning')
      await redraw(container)
    }
  })

  container.querySelectorAll('[data-jp-restore]').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation()
      const id = btn.dataset.jpRestore
      const job = jobs.find(j => j.id === id)
      if (!job) return
      await restoreJob(id)
      showToast(`"${job.name}" 已恢复`)
      await redraw(container)
    }
  })

  // Set as default
  container.querySelectorAll('[data-jp-default]').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation()
      const id = btn.dataset.jpDefault
      const job = jobs.find(j => j.id === id)
      if (!job) return
      await setDefaultJob(id)
      showToast(`"${job.name}" 已设为默认`)
      await redraw(container)
    }
  })
}

function jobRow(job, isArchived) {
  const color = job.color || pickJobColor(job.id)
  const initials = [...job.name].slice(0, 2).join('')
  const defaultBadge = job.isDefault ? `<span class="badge badge-accent" style="font-size:10px;margin-left:6px;background:var(--color-accent-light);color:var(--color-accent);border:none;">默认</span>` : ''
  return `
    <div class="job-item${isArchived ? ' job-deleted' : ''}">
      <div class="job-avatar" style="background:${color};border-radius:50%;">${initials}</div>
      <div class="job-info">
        <div class="job-name">${job.name}${defaultBadge}</div>
        <div class="job-wage">¥${job.wage}/小时${job.notes ? ' · ' + job.notes : ''}</div>
      </div>
      ${isArchived
      ? `<button class="btn btn-ghost btn-sm" data-jp-restore="${job.id}">恢复</button>`
      : `<div style="display:flex;gap:6px;flex-wrap:wrap;">
             ${!job.isDefault ? `<button class="btn btn-ghost btn-sm" data-jp-default="${job.id}" style="color:var(--color-accent)">默认</button>` : ''}
             <button class="btn btn-ghost btn-sm" data-jp-edit="${job.id}">编辑</button>
             <button class="btn btn-ghost btn-sm" data-jp-archive="${job.id}" style="color:var(--color-danger)">归档</button>
           </div>`
    }
    </div>
  `
}

function openJobForm(existingJob, container) {
  const isEdit = !!existingJob
  const formContent = `
    <div class="form-group">
      <label class="form-label">工作名称 *</label>
      <input class="form-input" id="jf-name" type="text" placeholder="例如：厨房帮工、收银员..." maxlength="50" value="${existingJob?.name || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">时薪（元/小时）*</label>
      <input class="form-input" id="jf-wage" type="number" inputmode="decimal" min="0" step="0.5" placeholder="例如 15.5" value="${existingJob?.wage ?? ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">备注（可选）</label>
      <input class="form-input" id="jf-notes" type="text" placeholder="工作地点、特殊说明..." value="${existingJob?.notes || ''}" maxlength="100" />
    </div>
  `
  showModal({
    title: isEdit ? '编辑工作' : '新建工作',
    content: formContent,
    buttons: [
      {
        label: isEdit ? '保存修改' : '创建工作',
        id: 'jf-submit',
        type: 'primary',
        onClick: async () => {
          const name = document.getElementById('jf-name')?.value.trim()
          const wage = parseFloat(document.getElementById('jf-wage')?.value)
          const notes = document.getElementById('jf-notes')?.value.trim()
          if (!name) { showToast('工作名称不能为空', 'error'); return }
          if (isNaN(wage) || wage < 0) { showToast('请输入有效时薪', 'error'); return }
          if (isEdit) {
            await updateJob(existingJob.id, { name, wage, notes })
            showToast(`"${name}" 已更新`)
          } else {
            await createJob(name, wage, '', notes)
            showToast(`"${name}" 已创建`)
          }
          await redraw(container)
        }
      },
      { label: '取消', id: 'jf-cancel', type: 'ghost', onClick: () => { } }
    ]
  })
}

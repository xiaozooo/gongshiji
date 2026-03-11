import { getAllJobs, createJob, updateJob, softDeleteJob, restoreJob } from '../db/jobStore.js'
import { showToast } from '../components/toast.js'
import { showModal } from '../components/modal.js'

export async function render() {
    const page = document.createElement('div')
    page.className = 'page'

    async function reload() {
        const jobs = await getAllJobs(true) // include deleted
        const active = jobs.filter(j => !j.isDeleted)
        const deleted = jobs.filter(j => j.isDeleted)

        page.innerHTML = `
      <div class="page-header">
        <span class="page-title">工作管理</span>
        <button class="btn btn-primary btn-sm" id="jobs-add-btn">+ 新建</button>
      </div>
      <div class="page-content">
        ${active.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💼</div>
            <div class="empty-title">还没有工作</div>
            <div class="empty-desc">点击右上角新建一个工作，开始记录工时。</div>
          </div>
        ` : `
          <div class="section-header">
            <span class="section-title">我的工作（${active.length}）</span>
          </div>
          <div id="jobs-active-list">
            ${active.map(renderJobItem).join('')}
          </div>
        `}
        ${deleted.length > 0 ? `
          <div class="section-header mt-6">
            <span class="section-title">已归档（${deleted.length}）</span>
          </div>
          <div id="jobs-deleted-list">
            ${deleted.map(j => renderJobItem(j, true)).join('')}
          </div>
        ` : ''}
      </div>
    `

        // Add button
        page.querySelector('#jobs-add-btn')?.addEventListener('click', () => showJobForm())

        // Job item actions
        page.querySelectorAll('[data-job-edit]').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation()
                const job = jobs.find(j => j.id === el.dataset.jobEdit)
                if (job) showJobForm(job)
            })
        })
        page.querySelectorAll('[data-job-delete]').forEach(el => {
            el.addEventListener('click', async e => {
                e.stopPropagation()
                const job = jobs.find(j => j.id === el.dataset.jobDelete)
                if (!job) return
                await softDeleteJob(job.id)
                showToast(`"${job.name}" 已归档`, 'warning')
                reload()
            })
        })
        page.querySelectorAll('[data-job-restore]').forEach(el => {
            el.addEventListener('click', async e => {
                e.stopPropagation()
                const job = jobs.find(j => j.id === el.dataset.jobRestore)
                if (!job) return
                await restoreJob(job.id)
                showToast(`"${job.name}" 已恢复`)
                reload()
            })
        })
    }

    function renderJobItem(job, isDeleted = false) {
        const initials = job.name.slice(0, 2)
        const colors = ['#6366f1', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ef4444']
        const color = colors[Math.abs(hashCode(job.id)) % colors.length]
        return `
      <div class="job-item ${isDeleted ? 'job-deleted' : ''}">
        <div class="job-avatar" style="background: ${color}">${initials}</div>
        <div class="job-info">
          <div class="job-name">${job.name}</div>
          <div class="job-wage">¥${job.wage}/小时 ${job.currency ? `(${job.currency})` : ''}</div>
          ${job.notes ? `<div class="text-xs text-muted mt-1">${job.notes}</div>` : ''}
        </div>
        ${isDeleted ? `
          <button class="btn btn-ghost btn-sm" data-job-restore="${job.id}">恢复</button>
        ` : `
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm" data-job-edit="${job.id}">编辑</button>
            <button class="btn btn-ghost btn-sm" data-job-delete="${job.id}" style="color:var(--color-danger-light)">归档</button>
          </div>
        `}
      </div>
    `
    }

    function hashCode(str) {
        let h = 0
        for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
        return h
    }

    function showJobForm(existingJob = null) {
        const isEdit = !!existingJob
        const formContent = `
      <div class="form-group">
      <label class="form-label">工作名称 *</label>
        <input class="form-input" id="job-form-name" type="text" placeholder="例如：厨房帮工、收银员..." maxlength="50" value="${existingJob?.name || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">时薪（元/小时）*</label>
        <input class="form-input" id="job-form-wage" type="number" min="0" step="0.5" placeholder="例如 15.5" value="${existingJob?.wage || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">备注（可选）</label>
        <input class="form-input" id="job-form-notes" type="text" placeholder="工作地点、特殊说明..." value="${existingJob?.notes || ''}" maxlength="100" />
      </div>
    `
        const closeModal = showModal({
            title: isEdit ? '编辑工作' : '新建工作',
            content: formContent,
            buttons: [
                {
                    label: isEdit ? '保存修改' : '创建工作',
                    id: 'job-form-submit',
                    type: 'accent',
                    onClick: async () => {
                        const name = document.getElementById('job-form-name')?.value.trim()
                        const wage = parseFloat(document.getElementById('job-form-wage')?.value)
                        const notes = document.getElementById('job-form-notes')?.value.trim()
                        if (!name) { showToast('工作名称不能为空', 'error'); return }
                        if (isNaN(wage) || wage < 0) { showToast('请输入有效时薪', 'error'); return }
                        if (isEdit) {
                            await updateJob(existingJob.id, { name, wage, notes })
                            showToast(`"${name}" 已更新`)
                        } else {
                            await createJob(name, wage, '', notes)
                            showToast(`"${name}" 已创建`)
                        }
                        closeModal()
                        reload()
                    }
                },
                { label: '取消', id: 'job-form-cancel', type: 'ghost', onClick: () => { } }
            ]
        })
    }

    await reload()
    return page
}

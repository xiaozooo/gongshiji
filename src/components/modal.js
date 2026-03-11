/**
 * Modal component — bottom sheet style
 */

const overlay = () => document.getElementById('modal-overlay')
let _closeTimer = null

/**
 * Show modal. Options:
 * { title, description, buttons: [{ label, type, id, onClick }] }
 * Returns a cleanup function.
 */
export function showModal({ title, description, content, buttons = [] }) {
    const ov = overlay()

    // Cancel any pending close animation from a previous modal
    if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null }

    const modal = document.createElement('div')
    modal.className = 'modal'

    let html = ''
    if (title) html += `<div class="modal-title">${title}</div>`
    if (description) html += `<div class="modal-desc">${description}</div>`
    if (content) html += content
    html += `<div class="modal-actions">`
    for (const btn of buttons) {
        html += `<button class="btn btn-${btn.type || 'ghost'} btn-full" id="${btn.id || 'modal-btn-' + Math.random().toString(36).slice(2)}">${btn.label}</button>`
    }
    html += '</div>'
    modal.innerHTML = html

    // wire button handlers
    buttons.forEach(btn => {
        const el = modal.querySelector(`#${btn.id}`) || modal.querySelectorAll('.btn')[buttons.indexOf(btn)]
        if (el && btn.onClick) el.addEventListener('click', () => { btn.onClick(); close() })
    })

    ov.innerHTML = ''
    ov.appendChild(modal)
    requestAnimationFrame(() => ov.classList.add('active'))

    // click outside to close
    ov.addEventListener('click', onBackdrop)

    function onBackdrop(e) {
        if (e.target === ov) close()
    }

    function close() {
        ov.classList.remove('active')
        ov.removeEventListener('click', onBackdrop)
        _closeTimer = setTimeout(() => { ov.innerHTML = ''; _closeTimer = null }, 300)
    }

    return close
}

/** Wrap a modal in a promise that resolves with the button id that was clicked */
export function showModalPromise({ title, description, content, options }) {
    return new Promise(resolve => {
        const buttons = options.map(o => ({
            ...o,
            onClick: () => resolve(o.value ?? o.label)
        }))
        showModal({ title, description, content, buttons })
    })
}

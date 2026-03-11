/**
 * Toast notification component
 */

const container = () => document.getElementById('toast-container')

export function showToast(message, type = 'success', duration = 2000) {
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' }
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${message}</span>`
    container().appendChild(toast)
    setTimeout(() => {
        toast.classList.add('toast-out')
        setTimeout(() => toast.remove(), 280)
    }, duration)
}

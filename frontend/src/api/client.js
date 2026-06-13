import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token so App redirects to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  register: (username, password) =>
    api.post('/auth/register', { username, password }),
}

// ── Accounts ──────────────────────────────────────────────────────────────────
export const accountsApi = {
  list: () => api.get('/accounts'),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.patch(`/accounts/${id}`, data),
  deleteInfo: (id) => api.get(`/accounts/${id}/delete-info`),
  delete: (id) => api.delete(`/accounts/${id}`),
  recharge: (id, data) => api.post(`/accounts/${id}/recharge`, data),
  dashboard: () => api.get('/accounts/dashboard/summary'),
  fetchBalance: (id, force = false) => api.get(`/accounts/${id}/fetch-balance`, { params: { force_refresh: force } }),
}

// ── Records ───────────────────────────────────────────────────────────────────
export const recordsApi = {
  list: (params) => api.get('/records', { params }),
  create: (data) => api.post('/records', data),
  bulkCreate: (data) => api.post('/records/bulk', data),
  update: (id, data) => api.patch(`/records/${id}`, data),
  delete: (id) => api.delete(`/records/${id}`),
  exportCsv: (params) => {
    const token = localStorage.getItem('token')
    const qs = new URLSearchParams(params || {}).toString()
    const url = `/api/records/export/csv${qs ? '?' + qs : ''}`
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', `records_${Date.now()}.csv`)
    // Add auth via fetch since <a> can't send headers
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      })
  },
}

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const backendMessage = error?.response?.data?.message
    const message = backendMessage || error.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return data
}

export function toApiPath(url) {
  if (!url) return ''
  if (url.startsWith('/')) return url
  return `/${url}`
}

export default api

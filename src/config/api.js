import axios from 'axios'

// ✅ FIXED: Always point to backend (change port if needed)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1234/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const TOKENS_KEY = 'assignmate_tokens'

// ---------------- TOKEN HELPERS ----------------

function getTokens() {
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function setTokens(tokens) {
  try {
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  } catch (e) {}
}

function clearTokens() {
  try {
    window.localStorage.removeItem(TOKENS_KEY)
  } catch (e) {}
}

// ---------------- REQUEST INTERCEPTOR ----------------

api.interceptors.request.use((config) => {
  const tokens = getTokens()
  if (tokens?.accessToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

// ---------------- RESPONSE INTERCEPTOR ----------------

let isRefreshing = false
let refreshQueue = []

function processQueue(error, token = null) {
  refreshQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  refreshQueue = []
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const original = error.config

    // 🔁 Handle token refresh
    if (error.response && error.response.status === 401 && !original._retry) {
      const tokens = getTokens()

      if (!tokens?.refreshToken) {
        return Promise.reject(new Error(toErrorMessage(error)))
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return axios(original)
        })
      }

      original._retry = true
      isRefreshing = true

      return new Promise(async (resolve, reject) => {
        try {
          const resp = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken: tokens.refreshToken }
          )

          const newTokens = resp.data || {}

          setTokens({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
          })

          processQueue(null, newTokens.accessToken)

          original.headers.Authorization = `Bearer ${newTokens.accessToken}`

          resolve(axios(original))
        } catch (err) {
          processQueue(err, null)
          clearTokens()
          reject(err)
        } finally {
          isRefreshing = false
        }
      })
    }

    const message = toErrorMessage(error)
    return Promise.reject(new Error(message))
  }
)

// ---------------- HELPERS ----------------

function toErrorMessage(error) {
  const backendMessage = error?.response?.data?.message
  const backendError = error?.response?.data?.error
  return backendMessage || backendError || error?.message || 'Request failed'
}

function normalizePayload(payload, fallbackMessage) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const hasEnvelopeKeys = 'data' in payload || 'success' in payload
    if (hasEnvelopeKeys) {
      return {
        success: payload.success ?? true,
        message: payload.message || fallbackMessage,
        data: payload.data ?? null
      }
    }
  }

  return {
    success: true,
    message: fallbackMessage,
    data: payload
  }
}

async function performRequest(requestPromise, fallbackMessage) {
  try {
    const response = await requestPromise
    const normalized = normalizePayload(response?.data, fallbackMessage)

    if (normalized.success === false) {
      throw new Error(normalized.message || 'Request failed')
    }

    return normalized
  } catch (error) {
    return {
      success: false,
      message: toErrorMessage(error),
      data: null
    }
  }
}

// ---------------- API METHODS ----------------

export const apiRequest = {
  get(url, config, message = 'Request completed successfully.') {
    return performRequest(api.get(url, config), message)
  },
  post(url, payload, config, message = 'Request completed successfully.') {
    return performRequest(api.post(url, payload, config), message)
  },
  put(url, payload, config, message = 'Request completed successfully.') {
    return performRequest(api.put(url, payload, config), message)
  },
  delete(url, config, message = 'Request completed successfully.') {
    return performRequest(api.delete(url, config), message)
  }
}

// ---------------- FILE UPLOAD ----------------

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiRequest.post(
    '/files/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    },
    'File uploaded successfully.'
  )

  if (!response.success) {
    throw new Error(response.message)
  }

  return response.data
}

// ---------------- UTIL ----------------

export function toApiPath(url) {
  if (!url) return ''
  if (url.startsWith('/')) return url
  return `/${url}`
}

export default api
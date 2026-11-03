const env = import.meta.env

export const apiUrl = (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
export const apiKey = env.VITE_API_KEY || ''
export const mockMode = env.DEV && env.VITE_MOCK === '1'

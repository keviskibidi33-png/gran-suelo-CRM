import axios from 'axios'
import type {
    GranSueloPayload,
    GranSueloSaveResponse,
    GranSueloEnsayoDetail,
    GranSueloEnsayoSummary,
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.geofal.com.pe'

const api = axios.create({
    baseURL: API_URL,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            window.dispatchEvent(new CustomEvent('session-expired'))
        }
        return Promise.reject(error)
    },
)


const extractFilename = (contentDisposition?: string): string | undefined => {
    const match = typeof contentDisposition === 'string' ? contentDisposition.match(/filename="?([^";]+)"?/i) : null
    return match?.[1]
}

export async function saveGranSueloEnsayo(
    payload: GranSueloPayload,
    ensayoId?: number,
): Promise<GranSueloSaveResponse> {
    const { data } = await api.post<GranSueloSaveResponse>('/api/gran-suelo/excel', payload, {
        params: {
            download: false,
            ensayo_id: ensayoId,
        },
    })
    return data
}

export async function saveAndDownloadGranSueloExcel(
    payload: GranSueloPayload,
    ensayoId?: number,
): Promise<{ blob: Blob; ensayoId?: number; filename?: string }> {
    const response = await api.post('/api/gran-suelo/excel', payload, {
        params: {
            download: true,
            ensayo_id: ensayoId,
        },
        responseType: 'blob',
    })

    const ensayoIdHeader = response.headers['x-gran-suelo-id']
    const contentDisposition = response.headers['content-disposition']
    const parsedId = Number(ensayoIdHeader)
    const filenameMatch =
        typeof contentDisposition === 'string'
            ? contentDisposition.match(/filename=\"?([^\";]+)\"?/i)
            : null

    return {
        blob: response.data,
        ensayoId: Number.isFinite(parsedId) ? parsedId : undefined,
        filename: filenameMatch?.[1],
    }
}

export async function listGranSueloEnsayos(limit = 100): Promise<GranSueloEnsayoSummary[]> {
    const { data } = await api.get<GranSueloEnsayoSummary[]>('/api/gran-suelo/', {
        params: { limit },
    })
    return data
}

export async function getGranSueloEnsayoDetail(ensayoId: number): Promise<GranSueloEnsayoDetail> {
    const { data } = await api.get<GranSueloEnsayoDetail>(`/api/gran-suelo/${ensayoId}`)
    return data
}

export default api

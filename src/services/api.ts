import axios from 'axios'
import type {
    GranAgregadoPayload,
    GranAgregadoSaveResponse,
    GranAgregadoEnsayoDetail,
    GranAgregadoEnsayoSummary,
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

export async function saveGranAgregadoEnsayo(
    payload: GranAgregadoPayload,
    ensayoId?: number,
): Promise<GranAgregadoSaveResponse> {
    const { data } = await api.post<GranAgregadoSaveResponse>('/api/gran-agregado/excel', payload, {
        params: {
            download: false,
            ensayo_id: ensayoId,
        },
    })
    return data
}

export async function saveAndDownloadGranAgregadoExcel(
    payload: GranAgregadoPayload,
    ensayoId?: number,
): Promise<{ blob: Blob; ensayoId?: number }> {
    const response = await api.post('/api/gran-agregado/excel', payload, {
        params: {
            download: true,
            ensayo_id: ensayoId,
        },
        responseType: 'blob',
    })

    const ensayoIdHeader = response.headers['x-gran-agregado-id']
    const parsedId = Number(ensayoIdHeader)
    return {
        blob: response.data,
        ensayoId: Number.isFinite(parsedId) ? parsedId : undefined,
    }
}

export async function listGranAgregadoEnsayos(limit = 100): Promise<GranAgregadoEnsayoSummary[]> {
    const { data } = await api.get<GranAgregadoEnsayoSummary[]>('/api/gran-agregado/', {
        params: { limit },
    })
    return data
}

export async function getGranAgregadoEnsayoDetail(ensayoId: number): Promise<GranAgregadoEnsayoDetail> {
    const { data } = await api.get<GranAgregadoEnsayoDetail>(`/api/gran-agregado/${ensayoId}`)
    return data
}

export default api

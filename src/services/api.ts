import axios from "axios"
import type {
    EquiArenaPayload,
    EquiArenaSaveResponse,
    EquiArenaEnsayoDetail,
    EquiArenaEnsayoSummary,
} from "@/types"

const API_URL = import.meta.env.VITE_API_URL || "https://api.geofal.com.pe"

const api = axios.create({
    baseURL: API_URL,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            window.dispatchEvent(new CustomEvent("session-expired"))
        }
        return Promise.reject(error)
    },
)

export async function saveEquiArenaEnsayo(
    payload: EquiArenaPayload,
    ensayoId?: number,
): Promise<EquiArenaSaveResponse> {
    const { data } = await api.post<EquiArenaSaveResponse>("/api/equi-arena/excel", payload, {
        params: {
            download: false,
            ensayo_id: ensayoId,
        },
    })
    return data
}

export async function saveAndDownloadEquiArenaExcel(
    payload: EquiArenaPayload,
    ensayoId?: number,
): Promise<{ blob: Blob; ensayoId?: number }> {
    const response = await api.post("/api/equi-arena/excel", payload, {
        params: {
            download: true,
            ensayo_id: ensayoId,
        },
        responseType: "blob",
    })

    const ensayoIdHeader = response.headers["x-equi-arena-id"]
    const parsedId = Number(ensayoIdHeader)
    return {
        blob: response.data,
        ensayoId: Number.isFinite(parsedId) ? parsedId : undefined,
    }
}

export async function listEquiArenaEnsayos(limit = 100): Promise<EquiArenaEnsayoSummary[]> {
    const { data } = await api.get<EquiArenaEnsayoSummary[]>("/api/equi-arena/", {
        params: { limit },
    })
    return data
}

export async function getEquiArenaEnsayoDetail(ensayoId: number): Promise<EquiArenaEnsayoDetail> {
    const { data } = await api.get<EquiArenaEnsayoDetail>(`/api/equi-arena/${ensayoId}`)
    return data
}

export default api

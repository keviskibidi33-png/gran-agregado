import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { Beaker, ChevronDown, Download, Loader2, Trash2 } from "lucide-react"
import { getEquiArenaEnsayoDetail, saveAndDownloadEquiArenaExcel, saveEquiArenaEnsayo } from "@/services/api"
import type { EquiArenaPayload } from "@/types"

const DRAFT_KEY = "equi_arena_form_draft_v1"
const DEBOUNCE_MS = 700
const TRIAL_COUNT = 3

const TIPO_MUESTRA = ["-", "SUELO", "AGREGADO FINO"] as const
const METODO_AGITACION = ["-", "MANUAL", "MECÁNICO"] as const
const PREPARACION = ["-", "PROCEDIMIENTO A", "PROCEDIMIENTO B"] as const
const REVISORES = ["-", "FABIAN LA ROSA"] as const
const APROBADORES = ["-", "IRMA COAQUIRA"] as const

const initialState = (): EquiArenaPayload => ({
    muestra: "",
    numero_ot: "",
    fecha_ensayo: "",
    realizado_por: "",
    tipo_muestra: "-",
    metodo_agitacion: "-",
    preparacion_muestra: "-",
    temperatura_solucion_c: null,
    masa_4_medidas_g: null,
    tiempo_saturacion_min: [10, 10, 10],
    tiempo_agitacion_seg: [45, 45, 45],
    tiempo_decantacion_min: [20, 20, 20],
    lectura_arcilla_in: [null, null, null],
    lectura_arena_in: [null, null, null],
    equivalente_arena_promedio_pct: null,
    equipo_balanza_01g_codigo: "-",
    equipo_horno_110_codigo: "-",
    equipo_equivalente_arena_codigo: "-",
    equipo_agitador_ea_codigo: "-",
    equipo_termometro_codigo: "-",
    equipo_tamiz_no4_codigo: "-",
    observaciones: "",
    revisado_por: "-",
    revisado_fecha: "",
    aprobado_por: "-",
    aprobado_fecha: "",
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ""

    const compact = value.replace(/\s+/g, "")
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-SU)?(?:-(\d{2}))?$/)
    if (match) {
        return `${match[1]}-SU-${match[2] || year}`
    }
    return value
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ""

    const compact = value.replace(/\s+/g, "")
    const year = getCurrentYearShort()
    const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) return `${match[1]}-${match[2] || year}`
    }
    return value
}

const normalizeFlexibleDate = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ""

    const digits = value.replace(/\D/g, "")
    const year = getCurrentYearShort()
    const pad2 = (part: string) => part.padStart(2, "0").slice(-2)
    const build = (d: string, m: string, y: string = year) => `${pad2(d)}/${pad2(m)}/${pad2(y)}`

    if (value.includes("/")) {
        const [d = "", m = "", yRaw = ""] = value.split("/").map((part) => part.trim())
        if (!d || !m) return value
        let yy = yRaw.replace(/\D/g, "")
        if (yy.length === 4) yy = yy.slice(-2)
        if (yy.length === 1) yy = `0${yy}`
        if (!yy) yy = year
        return build(d, m, yy)
    }

    if (digits.length === 2) return build(digits[0], digits[1])
    if (digits.length === 3) return build(digits[0], digits.slice(1, 3))
    if (digits.length === 4) return build(digits.slice(0, 2), digits.slice(2, 4))
    if (digits.length === 5) return build(digits[0], digits.slice(1, 3), digits.slice(3, 5))
    if (digits.length === 6) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6))
    if (digits.length >= 8) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(6, 8))

    return value
}

const getEnsayoId = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get("ensayo_id")
    if (!raw) return null
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
}

type FormattedFieldKey = "muestra" | "numero_ot" | "fecha_ensayo" | "revisado_fecha" | "aprobado_fecha"
type TrialFieldKey = "tiempo_saturacion_min" | "tiempo_agitacion_seg" | "tiempo_decantacion_min" | "lectura_arcilla_in" | "lectura_arena_in"

export default function EquiArenaForm() {
    const [form, setForm] = useState<EquiArenaPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoId())

    const equivalentByTrial = useMemo(() => {
        return Array.from({ length: TRIAL_COUNT }, (_, idx) => {
            const arcilla = form.lectura_arcilla_in[idx]
            const arena = form.lectura_arena_in[idx]
            if (arcilla == null || arena == null || arcilla <= 0) return null
            return Math.ceil((arena / arcilla) * 100)
        })
    }, [form.lectura_arcilla_in, form.lectura_arena_in])

    const equivalentAverage = useMemo(() => {
        const valid = equivalentByTrial.filter((v): v is number => v != null)
        if (!valid.length) return null
        return Math.ceil(valid.reduce((sum, item) => sum + item, 0) / valid.length)
    }, [equivalentByTrial])

    const progressSummary = useMemo(() => {
        const hasText = (value: string | null | undefined) => Boolean(value && value.trim() !== "" && value.trim() !== "-")
        const hasNum = (value: number | null | undefined) => value != null

        const sections = [
            {
                label: "Encabezado",
                ready: hasText(form.muestra) && hasText(form.numero_ot) && hasText(form.realizado_por),
                detail: `${[form.muestra, form.numero_ot, form.realizado_por].filter((v) => hasText(v)).length}/3`,
            },
            {
                label: "Condiciones",
                ready: form.tipo_muestra !== "-" && form.metodo_agitacion !== "-" && form.preparacion_muestra !== "-",
                detail: hasNum(form.temperatura_solucion_c) ? `Temp: ${form.temperatura_solucion_c} °C` : undefined,
            },
            {
                label: "Pruebas",
                ready: form.lectura_arcilla_in.some((v) => v != null) && form.lectura_arena_in.some((v) => v != null),
                detail: equivalentAverage != null ? `EA prom: ${equivalentAverage}%` : "Sin cálculo",
            },
            {
                label: "Equipos",
                ready:
                    form.equipo_balanza_01g_codigo !== "-" &&
                    form.equipo_horno_110_codigo !== "-" &&
                    form.equipo_equivalente_arena_codigo !== "-",
                detail: hasText(form.observaciones) ? "Con observaciones" : "Sin observaciones",
            },
        ]

        const readyCount = sections.filter((section) => section.ready).length
        const completion = Math.round((readyCount / sections.length) * 100)
        return { completion, sections }
    }, [equivalentAverage, form])

    const setField = useCallback(<K extends keyof EquiArenaPayload>(key: K, value: EquiArenaPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    const applyFormattedField = useCallback((key: FormattedFieldKey, formatter: (raw: string) => string) => {
        setForm((prev) => {
            const current = String(prev[key] ?? "")
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
    }, [])

    const setTrialValue = useCallback((key: TrialFieldKey, index: number, raw: string) => {
        setForm((prev) => {
            const next = [...prev[key]]
            next[index] = parseNum(raw)
            return { ...prev, [key]: next }
        })
    }, [])

    useEffect(() => {
        const raw = localStorage.getItem(`${DRAFT_KEY}:${editingEnsayoId ?? "new"}`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw)
            setForm({
                ...initialState(),
                ...parsed,
                tiempo_saturacion_min: Array.isArray(parsed.tiempo_saturacion_min)
                    ? [...parsed.tiempo_saturacion_min.slice(0, TRIAL_COUNT), ...Array(TRIAL_COUNT).fill(null)].slice(0, TRIAL_COUNT)
                    : [10, 10, 10],
                tiempo_agitacion_seg: Array.isArray(parsed.tiempo_agitacion_seg)
                    ? [...parsed.tiempo_agitacion_seg.slice(0, TRIAL_COUNT), ...Array(TRIAL_COUNT).fill(null)].slice(0, TRIAL_COUNT)
                    : [45, 45, 45],
                tiempo_decantacion_min: Array.isArray(parsed.tiempo_decantacion_min)
                    ? [...parsed.tiempo_decantacion_min.slice(0, TRIAL_COUNT), ...Array(TRIAL_COUNT).fill(null)].slice(0, TRIAL_COUNT)
                    : [20, 20, 20],
                lectura_arcilla_in: Array.isArray(parsed.lectura_arcilla_in)
                    ? [...parsed.lectura_arcilla_in.slice(0, TRIAL_COUNT), ...Array(TRIAL_COUNT).fill(null)].slice(0, TRIAL_COUNT)
                    : [null, null, null],
                lectura_arena_in: Array.isArray(parsed.lectura_arena_in)
                    ? [...parsed.lectura_arena_in.slice(0, TRIAL_COUNT), ...Array(TRIAL_COUNT).fill(null)].slice(0, TRIAL_COUNT)
                    : [null, null, null],
            })
        } catch {
            // ignore draft corruption
        }
    }, [editingEnsayoId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? "new"}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [editingEnsayoId, form])

    useEffect(() => {
        if (!editingEnsayoId) return
        let cancelled = false

        const run = async () => {
            setLoadingEdit(true)
            try {
                const detail = await getEquiArenaEnsayoDetail(editingEnsayoId)
                if (!cancelled && detail.payload) {
                    setForm({
                        ...initialState(),
                        ...detail.payload,
                        tiempo_saturacion_min: [...(detail.payload.tiempo_saturacion_min || [])].slice(0, TRIAL_COUNT),
                        tiempo_agitacion_seg: [...(detail.payload.tiempo_agitacion_seg || [])].slice(0, TRIAL_COUNT),
                        tiempo_decantacion_min: [...(detail.payload.tiempo_decantacion_min || [])].slice(0, TRIAL_COUNT),
                        lectura_arcilla_in: [...(detail.payload.lectura_arcilla_in || [])].slice(0, TRIAL_COUNT),
                        lectura_arena_in: [...(detail.payload.lectura_arena_in || [])].slice(0, TRIAL_COUNT),
                    })
                }
            } catch {
                toast.error("No se pudo cargar ensayo EquiArena para edición.")
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }

        void run()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId])

    const clearAll = useCallback(() => {
        if (!window.confirm("Se limpiarán los datos no guardados. ¿Deseas continuar?")) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? "new"}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.realizado_por) {
                toast.error("Complete Muestra, N OT y Realizado por.")
                return
            }

            setLoading(true)
            try {
                const payload: EquiArenaPayload = {
                    ...form,
                    equivalente_arena_promedio_pct: form.equivalente_arena_promedio_pct ?? equivalentAverage,
                }

                if (download) {
                    const { blob } = await saveAndDownloadEquiArenaExcel(payload, editingEnsayoId ?? undefined)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `EQUI_ARENA_${form.numero_ot}_${new Date().toISOString().slice(0, 10)}.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    await saveEquiArenaEnsayo(payload, editingEnsayoId ?? undefined)
                }

                localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? "new"}`)
                setForm(initialState())
                setEditingEnsayoId(null)
                if (window.parent !== window) window.parent.postMessage({ type: "CLOSE_MODAL" }, "*")
                toast.success(download ? "EquiArena guardado y descargado." : "EquiArena guardado.")
            } catch (error: unknown) {
                let msg = error instanceof Error ? error.message : "Error desconocido"
                if (axios.isAxiosError(error) && typeof error.response?.data?.detail === "string") msg = error.response.data.detail
                toast.error(`Error guardando EquiArena: ${msg}`)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, equivalentAverage, form],
    )

    const renderText = (label: string, value: string | undefined | null, onChange: (v: string) => void, placeholder?: string, onBlur?: () => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="text"
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="number"
                step="any"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )

    const trialHeader = ["Prueba 1", "Prueba 2", "Prueba 3"]

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Beaker className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Equivalente de Arena - ASTM D2419-22</h1>
                    <p className="text-sm text-muted-foreground">Formulario operativo EquiArena</p>
                </div>
            </div>

            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
                <div className="space-y-5">
                    {loadingEdit ? (
                        <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando ensayo...
                        </div>
                    ) : null}

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Encabezado</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderText("Muestra", form.muestra, (v) => setField("muestra", v), "1234-SU-26", () =>
                                applyFormattedField("muestra", normalizeMuestraCode),
                            )}
                            {renderText("N° OT", form.numero_ot, (v) => setField("numero_ot", v), "4567-26", () =>
                                applyFormattedField("numero_ot", normalizeNumeroOtCode),
                            )}
                            {renderText("Fecha ensayo", form.fecha_ensayo, (v) => setField("fecha_ensayo", v), "DD/MM/AA", () =>
                                applyFormattedField("fecha_ensayo", normalizeFlexibleDate),
                            )}
                            {renderText("Realizado por", form.realizado_por, (v) => setField("realizado_por", v))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Condiciones de ensayo</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderSelect("Tipo de muestra", form.tipo_muestra, TIPO_MUESTRA, (v) => setField("tipo_muestra", v as EquiArenaPayload["tipo_muestra"]))}
                            {renderSelect("Método de agitación", form.metodo_agitacion, METODO_AGITACION, (v) =>
                                setField("metodo_agitacion", v as EquiArenaPayload["metodo_agitacion"]),
                            )}
                            {renderSelect("Preparación de muestra", form.preparacion_muestra, PREPARACION, (v) =>
                                setField("preparacion_muestra", v as EquiArenaPayload["preparacion_muestra"]),
                            )}
                            {renderNum("Temperatura solución (°C)", form.temperatura_solucion_c, (v) => setField("temperatura_solucion_c", parseNum(v)))}
                            {renderNum("Masa de las 4 medidas (g)", form.masa_4_medidas_g, (v) => setField("masa_4_medidas_g", parseNum(v)))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Pruebas (H-I-J)</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm border border-border rounded-lg overflow-hidden">
                                <thead className="bg-muted/60">
                                    <tr>
                                        <th className="text-left px-3 py-2 border-b border-border">Campo</th>
                                        {trialHeader.map((label) => (
                                            <th key={label} className="px-3 py-2 border-b border-border text-center">
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { key: "tiempo_saturacion_min", label: "Tiempo saturación (min)" },
                                        { key: "tiempo_agitacion_seg", label: "Tiempo agitación (seg)" },
                                        { key: "tiempo_decantacion_min", label: "Tiempo decantación (min)" },
                                        { key: "lectura_arcilla_in", label: "Lectura de arcilla (in)" },
                                        { key: "lectura_arena_in", label: "Lectura de arena (in)" },
                                    ].map((row) => (
                                        <tr key={row.key} className="border-b border-border last:border-none">
                                            <td className="px-3 py-2 font-medium">{row.label}</td>
                                            {Array.from({ length: TRIAL_COUNT }, (_, idx) => (
                                                <td key={idx} className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={(form[row.key as TrialFieldKey][idx] as number | null) ?? ""}
                                                        onChange={(e) => setTrialValue(row.key as TrialFieldKey, idx, e.target.value)}
                                                        className="w-full h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className="px-3 py-2 font-medium bg-muted/40">EA por prueba (%)</td>
                                        {equivalentByTrial.map((value, idx) => (
                                            <td key={idx} className="px-2 py-2 text-center font-semibold bg-muted/30">
                                                {value ?? "-"}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium">EA promedio (%)</td>
                                        <td className="px-2 py-2" colSpan={2}>
                                            <input
                                                type="number"
                                                step="any"
                                                value={form.equivalente_arena_promedio_pct ?? ""}
                                                onChange={(e) => setField("equivalente_arena_promedio_pct", parseNum(e.target.value))}
                                                placeholder={equivalentAverage != null ? String(equivalentAverage) : ""}
                                                className="w-full h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-center text-xs text-muted-foreground">{equivalentAverage != null ? `Auto: ${equivalentAverage}` : "Sin cálculo"}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Equipos y observaciones</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderText("Balanza 0.1 g", form.equipo_balanza_01g_codigo, (v) => setField("equipo_balanza_01g_codigo", v))}
                            {renderText("Horno 110°C", form.equipo_horno_110_codigo, (v) => setField("equipo_horno_110_codigo", v))}
                            {renderText("Equipo Equivalente Arena", form.equipo_equivalente_arena_codigo, (v) => setField("equipo_equivalente_arena_codigo", v))}
                            {renderText("Agitador EA", form.equipo_agitador_ea_codigo, (v) => setField("equipo_agitador_ea_codigo", v))}
                            {renderText("Termómetro", form.equipo_termometro_codigo, (v) => setField("equipo_termometro_codigo", v))}
                            {renderText("Tamiz No. 4", form.equipo_tamiz_no4_codigo, (v) => setField("equipo_tamiz_no4_codigo", v))}
                            <div className="md:col-span-2">
                                {renderText("Observaciones", form.observaciones, (v) => setField("observaciones", v))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Cierre</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderSelect("Revisado por", form.revisado_por || "-", REVISORES, (v) => setField("revisado_por", v))}
                            {renderText("Fecha revisión", form.revisado_fecha, (v) => setField("revisado_fecha", v), "DD/MM/AA", () =>
                                applyFormattedField("revisado_fecha", normalizeFlexibleDate),
                            )}
                            {renderSelect("Aprobado por", form.aprobado_por || "-", APROBADORES, (v) => setField("aprobado_por", v))}
                            {renderText("Fecha aprobación", form.aprobado_fecha, (v) => setField("aprobado_fecha", v), "DD/MM/AA", () =>
                                applyFormattedField("aprobado_fecha", normalizeFlexibleDate),
                            )}
                        </div>
                    </div>
                </div>

                <aside className="mt-5 xl:mt-0 space-y-4">
                    <div className="bg-card border border-border rounded-lg shadow-sm p-4">
                        <p className="text-sm font-semibold mb-2">Estado del formulario</p>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressSummary.completion}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{progressSummary.completion}% completado</p>
                        <div className="mt-3 space-y-2">
                            {progressSummary.sections.map((section) => (
                                <div key={section.label} className="rounded-md border border-border px-3 py-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{section.label}</span>
                                        <span className={section.ready ? "text-green-600" : "text-amber-600"}>{section.ready ? "OK" : "Pendiente"}</span>
                                    </div>
                                    {section.detail ? <p className="text-muted-foreground mt-1">{section.detail}</p> : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm p-4 space-y-3">
                        <button
                            onClick={() => void save(false)}
                            disabled={loading}
                            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Guardar
                        </button>
                        <button
                            onClick={() => void save(true)}
                            disabled={loading}
                            className="w-full h-10 rounded-md border border-border text-sm font-medium hover:bg-muted transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Guardar y descargar
                        </button>
                        <button
                            onClick={clearAll}
                            disabled={loading}
                            className="w-full h-10 rounded-md border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Limpiar
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    )
}

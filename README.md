# Gran Agregado CRM Frontend

Microfrontend del módulo **Granulometría de Agregados ASTM C136/C136M-25** para Geofal.

- Dominio productivo: `https://gran-agregado.geofal.com.pe`
- Backend API: `https://api.geofal.com.pe` (rutas `/api/gran-agregado`)

## Objetivo

- Registrar/editar ensayos de Gran Agregado.
- Guardar estado en BD (`EN PROCESO`/`COMPLETO`).
- Exportar Excel con plantilla oficial `Template_GranAgregado.xlsx`.
- Cerrar modal del CRM al finalizar guardado.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Axios
- React Hot Toast

## Variables de entorno

- `VITE_API_URL=https://api.geofal.com.pe`
- `VITE_CRM_LOGIN_URL=https://crm.geofal.com.pe/login`

## Desarrollo local

```bash
npm install
npm run dev
```

## Cambios recientes (Febrero 2026)

- Normalización inteligente en `onBlur` para encabezado:
  - `Muestra`: `555` -> `555-SU-26`
  - `N OT`: `555` -> `555-26`
- Fechas inteligentes (igual estándar que CBR/Proctor):
  - `fecha_ensayo`, `revisado_fecha`, `aprobado_fecha`
  - Ejemplos: `1202` -> `12/02/26`, `1/2` -> `01/02/26`
- Panel lateral tipo Proctor agregado para control de progreso:
  - avance general (%)
  - estado por secciones (`OK` / `Pend.`)
  - resumen de tamices y control de error

## Validación recomendada

- Validar formato automático de `Muestra`, `N OT` y fechas al salir del input.
- Completar datos de granulometría y verificar actualización en vivo del panel lateral.
- Guardar y descargar para validar ciclo completo.

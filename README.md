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

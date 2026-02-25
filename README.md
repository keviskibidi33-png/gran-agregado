# EquiArena CRM Frontend

Microfrontend del módulo **Equivalente de Arena ASTM D2419-22** para Geofal.

- Dominio productivo: `https://equiarena.geofal.com.pe`
- Backend API: `https://api.geofal.com.pe` (rutas `/api/equi-arena`)

## Objetivo

- Registrar/editar ensayos de EquiArena.
- Guardar estado en BD (`EN PROCESO`/`COMPLETO`).
- Exportar Excel con plantilla oficial `Template_EquiArena.xlsx`.
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

## Alcance funcional

- Encabezado (`Muestra`, `N OT`, `Fecha`, `Realizado`).
- Condiciones de ensayo (tipo de muestra, método, preparación, temperatura, masa).
- Captura de 3 pruebas (tiempos + lecturas de arcilla/arena).
- Cálculo automático de EA por prueba y promedio.
- Equipos, observaciones y cierre (revisado/aprobado).

## Validación recomendada

- Validar formato automático de `Muestra`, `N OT` y fechas al salir del input.
- Completar datos de pruebas y verificar cálculo de EA promedio.
- Guardar y descargar para validar ciclo completo.

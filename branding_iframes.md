# Branding Iframes - Gran Agregado

Documento de referencia para mantener consistente el branding del microfrontend de **Gran Agregado** y su visualizacion embebida en iframe dentro del CRM.

## Alcance

- Microfrontend: `gran-agregado`
- Shell embebedor: `crm-geofal` modulo Gran Agregado
- Flujo: CRM abre `https://gran-agregado.geofal.com.pe` en dialog modal con `token` y opcionalmente `ensayo_id`

## Reglas visuales

- Mantener estilo tipo hoja tecnica, fiel a la plantilla Excel oficial de Gran Agregado.
- Preservar estructura de encabezado institucional y bloque ASTM C136/C136M-25.
- Mantener botonera final con accion doble: `Guardar` y `Guardar y Descargar`.
- Mantener consistencia de fuentes, bordes y jerarquia visual con GE Fino, GE Grueso y Gran Suelo.

## Contrato iframe

- Entrada por query params: `token`, `ensayo_id`.
- Mensajes hijo -> padre: `TOKEN_REFRESH_REQUEST`, `CLOSE_MODAL`.
- Mensaje padre -> hijo: `TOKEN_REFRESH`.

## Archivos clave

- `gran-agregado/src/pages/GranAgregadoForm.tsx`
- `gran-agregado/src/App.tsx`
- `gran-agregado/src/components/SessionGuard.tsx`
- `crm-geofal/src/components/dashboard/gran-agregado-module.tsx`

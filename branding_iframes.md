# Branding Iframes - Gran Suelo

Documento de referencia para mantener consistente el branding del microfrontend de **Gran Suelo** y su visualizacion embebida en iframe dentro del CRM.

## Alcance

- Microfrontend: `gran-suelo-CRM`
- Shell embebedor: `crm-geofal` modulo Gran Suelo
- Flujo: CRM abre `https://gran-suelo.geofal.com.pe` en dialog modal con `token` y opcionalmente `ensayo_id`

## Reglas visuales

- Mantener estilo tipo hoja tecnica, fiel a la plantilla Excel oficial de Gran Suelo.
- Preservar estructura de encabezado institucional y bloque ASTM D6913/D6913M-17.
- Mantener botonera final con accion doble: `Guardar` y `Guardar y Descargar`.
- Mantener consistencia de fuentes, bordes y jerarquia visual con GE Fino/GE Grueso.

## Contrato iframe

- Entrada por query params: `token`, `ensayo_id`.
- Mensajes hijo -> padre: `TOKEN_REFRESH_REQUEST`, `CLOSE_MODAL`.
- Mensaje padre -> hijo: `TOKEN_REFRESH`.

## Archivos clave

- `gran-suelo-CRM/src/pages/GranSueloForm.tsx`
- `gran-suelo-CRM/src/App.tsx`
- `gran-suelo-CRM/src/components/SessionGuard.tsx`
- `crm-geofal/src/components/dashboard/gran-suelo-module.tsx`

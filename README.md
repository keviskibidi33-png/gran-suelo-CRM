# Gran Suelo CRM Frontend

Microfrontend del módulo **Granulometría de Suelos ASTM D6913/D6913M-17** para Geofal.

- Dominio productivo: `https://gran-suelo.geofal.com.pe`
- Backend API: `https://api.geofal.com.pe` (rutas `/api/gran-suelo`)

## Objetivo

- Registrar/editar ensayos de Gran Suelo.
- Guardar estado en BD (`EN PROCESO`/`COMPLETO`).
- Exportar Excel con plantilla oficial `Template_GranSuelo.xlsx`.
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

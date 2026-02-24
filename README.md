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

## Cambios recientes (Febrero 2026)

- Encabezado con normalización inteligente en `onBlur`:
  - `Muestra`: `555` -> `555-SU-26`
  - `N OT`: `555` -> `555-26`
- Fechas inteligentes (alineado con CBR/Proctor):
  - `fecha_ensayo`, `revisado_fecha`, `aprobado_fecha`
  - Ejemplos: `1202` -> `12/02/26`, `1/2` -> `01/02/26`
- `Tamiz separador` con valor predeterminado `-`.
- Sidebar tipo Proctor para seguimiento en vivo:
  - avance general (%)
  - estado por secciones (`OK` / `Pend.`)
  - tabla de resumen (tamices llenos, peso total, CPL)

## Validación recomendada

- Probar `Muestra`, `N OT` y fechas con entrada corta y validar normalización al perder foco.
- Completar secciones y revisar que el progreso lateral se actualiza automáticamente.
- Guardar y descargar Excel para confirmar flujo completo.

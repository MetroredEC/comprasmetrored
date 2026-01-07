# Backend del Sistema de Compras

Este backend implementa una API REST sencilla utilizando **Node.js** y **Express**. Está pensado para servir como base del sistema de compras y aprobaciones, permitiendo almacenar solicitudes, cotizaciones, órdenes de compra, facturas y pagos. Los datos se persisten en un archivo JSON (`data/data.json`), pero la arquitectura es fácilmente extensible a bases de datos como SQLite, PostgreSQL o integración con Business Central (BC).

## Requisitos

- Node.js 18 o superior
- npm (incluido con Node)

## Instalación

1. Navega al directorio `backend`:

   ```bash
   cd sistema-compras-platform/backend
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Inicia el servidor:

   ```bash
   npm start
   ```

   Por defecto el servidor escucha en el puerto **3000**. Puedes cambiar el puerto definiendo la variable de entorno `PORT`.

## Endpoints principales

Los endpoints se agrupan bajo el prefijo `/api`. Todos usan y devuelven JSON.

- `GET /api/users` – Lista de usuarios y sus roles.
- `GET /api/solicitudes` – Devuelve todas las solicitudes.
- `POST /api/solicitudes` – Crea una nueva solicitud. Requiere `descripcion`, `area`, `items` (array de objetos con `descripcion`, `cantidad`, `precioUnitario`) y opcionalmente `urgencia` y `justificacionUrgencia`.
- `PUT /api/solicitudes/:id` – Actualiza una solicitud existente.
- `POST /api/solicitudes/:id/enviar` – Cambia una solicitud a estado `enviado`.
- `POST /api/solicitudes/:id/aprobar` – Jefatura aprueba una solicitud enviada.
- `POST /api/solicitudes/:id/rechazar` – Jefatura rechaza una solicitud enviada.
- `POST /api/solicitudes/:id/cotizaciones` – Añade una cotización a una solicitud aprobada. Requiere `proveedorId` y `monto`.
- `POST /api/solicitudes/:id/orden` – Selecciona cotización ganadora y genera orden de compra.
- `POST /api/solicitudes/:id/aprobar-presupuesto` – Contabilidad aprueba presupuesto y descuenta el monto.
- `POST /api/solicitudes/:id/factura` – Registra una factura para la solicitud.
- `POST /api/solicitudes/:id/pago` – Registra el pago de la factura asociada.

Además, existen endpoints para consultar y gestionar **proveedores**, **cotizaciones**, **órdenes de compra**, **facturas** y **pagos**.

## Integración con Business Central (BC)

El archivo `server.js` incluye funciones stub (por ejemplo, `syncWithBC`) para ilustrar dónde realizar las llamadas a la API OData de Dynamics 365 Business Central. Para integrarlo realmente:

1. Obtén las credenciales y la URL del servicio OData de tu instancia BC.
2. Implementa las llamadas HTTP necesarias (por ejemplo usando `node-fetch`) dentro de las funciones stub.
3. Ajusta el modelo de datos para mapear los objetos locales (solicitudes, órdenes, facturas) a las entidades de BC.

## Consideraciones de seguridad

- Este backend no incluye autenticación ni autorización real. En un entorno productivo deberías integrar JWT o un servicio de identidad.
- Las validaciones de entrada son básicas; se recomienda usar librerías como `Joi` o `express-validator` para validar el cuerpo de las peticiones.
- El almacenamiento en archivo JSON es suficiente para pruebas, pero no para producción; considera migrar a una base de datos.

## Scripts útiles

- `npm start` – Arranca el servidor en modo producción.
- `npm run dev` – Arranca el servidor en modo desarrollo con recarga automática (`nodemon`).
- `npm test` – Ejecuta las pruebas de API (si se añaden).

## Próximos pasos

- Añadir autenticación y autorización.
- Conectar con una base de datos relacional.
- Implementar logs estructurados y auditoría con persistencia.
- Desplegar en un servicio de hosting para exponer la API a través de HTTPS.
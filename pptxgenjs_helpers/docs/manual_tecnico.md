# Manual técnico del Sistema de Compras

## Introducción

Esta plataforma implementa un sistema de compras y aprobaciones para una organización de salud. Combina un **backend** desarrollado en Node.js/Express que expone una API REST y un **frontend** en JavaScript que consume dicha API. La solución está preparada para funcionar de manera autónoma (persistiendo en un archivo JSON) o integrarse con Dynamics 365 Business Central (BC) mediante OData.

## Arquitectura general

### Backend

El backend está ubicado en `sistema-compras-platform/backend` y utiliza las siguientes tecnologías:

- **Node.js** y **Express** para manejar rutas y middlewares.
- Persiste los datos en `backend/data/data.json`. Este archivo contiene todas las entidades: usuarios, presupuestos, matriz de aprobación, solicitudes, cotizaciones, órdenes de compra, facturas, pagos y auditoría.
- Las funciones `loadData()` y `saveData()` se encargan de leer y escribir el JSON respetando la estructura. Estas funciones pueden sustituirse por llamadas a una base de datos en una instalación real.
- El servidor incluye CORS habilitado para permitir llamadas desde el frontend alojado en dominios distintos (como GitHub Pages).
- Los endpoints principales se agrupan bajo el prefijo `/api` y cubren operaciones de consulta y modificación de:
  - Usuarios (`GET /api/users`)
  - Solicitudes (`GET`, `POST`, `PUT`), cambio de estado (`/enviar`, `/aprobar`, `/rechazar`), manejo de cotizaciones, generación de órdenes de compra, aprobación de presupuesto, registro de facturas y pagos.
  - Proveedores (`GET`, `POST`, `PUT`)
  - Reportes simples (por estado, área y proveedor)
  - Consultas de colecciones: cotizaciones, órdenes, facturas, pagos, presupuestos y la matriz de aprobación.
- Incluye stubs de integración con BC. La función `syncWithBC` se invoca en los puntos donde habría que sincronizar las entidades con Dynamics 365. Para activar la integración real se deben implementar llamadas OData con autenticación.

### Frontend

El frontend se encuentra en `sistema-compras-platform/frontend` y es un conjunto de archivos estáticos servibles por cualquier servidor web. Sus características principales son:

- **index.html**: estructura básica de la página, con cabecera, menú de navegación, contenedor principal y pie. Incluye el script de la aplicación.
- **assets/styles.css**: estilos reutilizados de la demo original para un aspecto limpio y corporativo.
- **assets/app.js**: módulo principal que implementa la lógica de interfaz:
  - Se conecta al backend mediante `fetch()` a la URL definida en `API_BASE_URL` (por defecto `http://localhost:3000`).
  - Carga los datos y mantiene un estado local (`appData`).
  - Permite seleccionar un usuario (sin contraseña) y ofrece diferentes módulos en función de su rol (dashboard, solicitudes, compras, proveedores, contabilidad, reportes y administración).
  - Implementa formularios para crear y editar solicitudes, agrega cotizaciones, selecciona proveedores, aprueba presupuestos, registra facturas y pagos. Todas las acciones se traducen en llamadas HTTP al backend.
  - El módulo de administración presenta la matriz de aprobación y presupuestos en modo de solo lectura. Para modificar estos valores se recomienda editar el archivo de datos en el backend.
  - Se puede definir `window.API_BASE_URL` en `index.html` para cambiar la URL de la API sin modificar el código.

## Modelo de datos

El archivo `data.json` sigue esta estructura simplificada (ver datos completos en la carpeta `backend/data`):

| Entidad               | Descripción                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| `usuarios`           | Lista de usuarios con `id`, `nombre`, `rol` (Solicitante, Jefatura, Compras, Contabilidad, Admin) y `area` en caso de ser jefatura o solicitante. |
| `presupuestos`       | Presupuestos por área con campos `area`, `montoAnual` y `montoDisponible`.    |
| `matrizAprobaciones` | Tramos de aprobación con campos `min`, `max` y `roles` requeridos para aprobar. |
| `solicitudes`        | Solicitudes de compra con campos de fecha, solicitante, área, descripción, urgencia, items (array con cantidad y precio), estado y referencias a cotizaciones, OC, factura y pago. |
| `cotizaciones`       | Ofertas enviadas por proveedores para una solicitud. Incluyen proveedor, monto y estado (recibida, aceptada, rechazada). |
| `ordenesCompra`      | Órdenes generadas a partir de una cotización aceptada. Indican solicitud, cotización, proveedor, fecha, monto, items, fecha de entrega y notas. |
| `facturas`           | Facturas asociadas a una orden, con fecha, monto y referencia.                 |
| `pagos`              | Pagos de facturas con fecha de pago, monto y método.                           |
| `audit`              | Bitácora de eventos (accion, entidad, usuario, timestamp). No se expone en el API actual pero sirve para auditoría futura. |

## Endpoints principales

### Solicitudes

| Método | Endpoint                                  | Descripción                                                                              |
|--------|--------------------------------------------|------------------------------------------------------------------------------------------|
| GET    | `/api/solicitudes`                        | Obtiene todas las solicitudes.                                                           |
| POST   | `/api/solicitudes`                        | Crea una nueva solicitud (en borrador).                                                  |
| PUT    | `/api/solicitudes/:id`                    | Actualiza una solicitud (campos libres).                                                 |
| POST   | `/api/solicitudes/:id/enviar`             | Cambia una solicitud de borrador a `enviado`.                                            |
| POST   | `/api/solicitudes/:id/aprobar`            | Aprueba una solicitud (jefatura).                                                        |
| POST   | `/api/solicitudes/:id/rechazar`           | Rechaza una solicitud (jefatura) con motivo.                                             |
| POST   | `/api/solicitudes/:id/cotizaciones`       | Añade una cotización a una solicitud aprobada por jefatura.                              |
| POST   | `/api/solicitudes/:id/orden`              | Selecciona la cotización ganadora y genera la orden de compra.                           |
| POST   | `/api/solicitudes/:id/aprobar-presupuesto`| Aprueba el presupuesto (contabilidad) y descuenta del monto disponible del área.         |
| POST   | `/api/solicitudes/:id/factura`            | Registra una factura para la solicitud.                                                  |
| POST   | `/api/solicitudes/:id/pago`               | Registra el pago de la factura asociada.                                                 |

### Proveedores

| Método | Endpoint                    | Descripción                                             |
|--------|-----------------------------|---------------------------------------------------------|
| GET    | `/api/proveedores`         | Devuelve la lista de proveedores.                       |
| POST   | `/api/proveedores`         | Crea un nuevo proveedor.                                |
| PUT    | `/api/proveedores/:id`     | Actualiza un proveedor existente.                       |

### Consultas adicionales

| Método | Endpoint            | Descripción                               |
|--------|---------------------|-------------------------------------------|
| GET    | `/api/users`        | Lista de usuarios.                         |
| GET    | `/api/cotizaciones` | Todas las cotizaciones.                    |
| GET    | `/api/ordenes`      | Todas las órdenes de compra.               |
| GET    | `/api/facturas`     | Todas las facturas.                        |
| GET    | `/api/pagos`        | Todos los pagos.                           |
| GET    | `/api/presupuestos`| Lista de presupuestos por área.            |
| GET    | `/api/matriz`       | Matriz de aprobaciones por monto.          |

### Reportes simples

| Método | Endpoint                                      | Respuesta                          |
|--------|-----------------------------------------------|------------------------------------|
| GET    | `/api/reportes/solicitudes/estado`            | Cantidad de solicitudes por estado. |
| GET    | `/api/reportes/solicitudes/area`              | Cantidad de solicitudes por área.   |
| GET    | `/api/reportes/solicitudes/proveedor`         | Solicitudes adjudicadas por proveedor. |

## Integración con Dynamics 365 Business Central

El archivo `backend/server.js` contiene la función `syncWithBC(entity, payload)` como ejemplo de punto de integración. Para vincular el sistema con BC:

1. **Obtener credenciales**: incluye el URL de tu instancia de BC, usuario y contraseña o token para autenticación OData.
2. **Mapear entidades**: identifica cómo mapear una solicitud, cotización, orden, factura o pago a las entidades de BC (Purchase Requisitions, Purchase Orders, Vendors, etc.).
3. **Implementar llamadas**: utiliza una librería HTTP (como `node-fetch` o `axios`) para realizar las llamadas OData POST/GET al sistema BC dentro de la función `syncWithBC`. Maneja errores y confirma que se almacena el ID devuelto por BC para futuras sincronizaciones.
4. **Manejo de eventos**: invoca `syncWithBC` cada vez que cambie el estado de una entidad relevante (envío de solicitud, aprobación, generación de OC, registro de factura, pago) para que BC se actualice en tiempo real.

## Despliegue

### Ejecución local

1. **Clonar el repositorio** y posicionarse en `sistema-compras-platform/backend`:
   ```bash
   npm install
   npm start
   ```
2. **Abrir el frontend**: navega a la carpeta `frontend` y abre `index.html` con tu navegador o usa un servidor local (`python -m http.server` por ejemplo). El frontend se conectará a `http://localhost:3000` por defecto. Si usas otra URL, define `window.API_BASE_URL` en `index.html`.

### Publicación en GitHub Pages

1. Crea un nuevo repositorio en GitHub (por ejemplo, `sistema-compras-plataforma`).
2. Copia el contenido de `sistema-compras-platform/frontend` a la raíz de tu repo y sube los archivos (`index.html`, `assets/...`, etc.).
3. Activa GitHub Pages en **Settings → Pages** seleccionando la rama `main` y la carpeta raíz `/`.
4. Despliega el backend en un servidor accesible públicamente (Heroku, Render, etc.) y configura `API_BASE_URL` en tu `index.html` para apuntar a esa URL. Sin backend, la interfaz mostrará errores al cargar los datos.

## Pruebas de QA

El siguiente conjunto de pruebas manuales asegura que el sistema funcione correctamente en el flujo completo. Se asume que existe al menos una solicitud de ejemplo en `data.json`.

1. **Login y dashboard**: abrir el frontend, seleccionar el usuario “Ana Pérez” y verificar que se muestran sus solicitudes y presupuesto correspondiente.
2. **Crear solicitud**: crear una nueva solicitud como solicitante; añadir items, guardar borrador y enviarla. Verificar que aparece en la lista con estado *enviado*.
3. **Aprobación jefatura**: iniciar sesión como jefatura del área correspondiente, aprobar la solicitud enviada y comprobar que el estado cambia a *aprobadoJefatura*.
4. **Carga de cotizaciones**: iniciar sesión como Compras, agregar dos cotizaciones a la solicitud aprobada. Verificar que el estado cambia a *enCotizacion*.
5. **Generar OC**: seleccionar una cotización en el detalle de la solicitud y generar la orden de compra. Comprobar que se crea una OC y el estado pasa a *ordenCompraGenerada*.
6. **Aprobación de presupuesto**: iniciar sesión como Contabilidad, aprobar el presupuesto de la solicitud y verificar que el presupuesto disponible del área se actualiza. El estado debe cambiar a *aprobadoContabilidad*.
7. **Registrar factura**: en la misma solicitud, registrar una factura e introducir el monto y fecha. Verificar que el estado se actualiza a *facturado* y la factura aparece en la sección de facturas.
8. **Registrar pago**: registrar el pago de la factura, definir fecha y método. Verificar que el estado cambia a *pagado* y el pago aparece registrado.
9. **Gestión de proveedores**: crear un proveedor nuevo, editar uno existente cambiando su estado y rating. Confirmar que la tabla de proveedores se actualiza correctamente.
10. **Reportes y lectura de datos**: acceder al módulo de reportes y comprobar que las cantidades por estado, área y proveedor coinciden con los datos registrados. Revisar la matriz y presupuestos en el módulo admin para asegurarse de que la información se carga correctamente.

Se recomienda, además, escribir pruebas automatizadas (por ejemplo usando Jest y Supertest para el backend) para validar las rutas, y Cypress o Playwright para pruebas end‑to‑end del frontend.
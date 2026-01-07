# Frontend del Sistema de Compras

Esta carpeta contiene la interfaz web de la plataforma de compras y aprobaciones que se conecta a un backend REST basado en Node.js. A diferencia de la demo estática original, este cliente obtiene y actualiza los datos mediante peticiones HTTP, por lo que requiere que el servidor esté disponible.

## Estructura

- `index.html`: página principal. Carga los estilos y el script `app.js`.
- `assets/styles.css`: estilos CSS reutilizados de la demo original.
- `assets/app.js`: lógica del frontend. Define las vistas, estados y acciones. Hace `fetch` contra el backend para leer y modificar datos.

## Uso local

1. **Arranca el backend.** Desde la carpeta `backend` ejecuta:
   ```bash
   npm install
   npm start
   ```
   Por defecto escuchará en `http://localhost:3000`.
2. **Abre el frontend.** Puedes servir esta carpeta con un servidor estático o abrir `index.html` directamente en tu navegador. El script intentará conectarse al backend en `http://localhost:3000` (puedes definir `window.API_BASE_URL` antes de cargar `app.js` si tienes el servidor en otra URL).
3. **Selecciona un usuario.** La pantalla de inicio de sesión permite escoger un usuario de la lista. Las acciones disponibles dependerán del rol.

## Publicación en GitHub Pages

Esta versión del frontend se puede publicar como sitio estático (por ejemplo, mediante GitHub Pages), pero **necesita un backend accesible**. Para que la aplicación funcione desde Pages:

1. Despliega el backend en una URL pública (por ejemplo, en un servicio como Heroku, Render, Vercel o tu propio servidor). Asegúrate de habilitar CORS.
2. Antes de cargar `app.js` en `index.html`, define la variable global `API_BASE_URL` apuntando a la URL de tu backend. Puedes hacerlo insertando un bloque `<script>` antes de incluir `app.js`, por ejemplo:
   ```html
   <script>
     window.API_BASE_URL = 'https://tu-backend.ejemplo.com';
   </script>
   <script src="assets/app.js"></script>
   ```
3. Publica esta carpeta (`frontend`) en GitHub Pages siguiendo los pasos habituales (ramas o carpeta `/docs`).

## Limitaciones

- Esta interfaz no implementa autenticación real; los usuarios se seleccionan de manera manual.
- El módulo **Admin** sólo muestra la matriz y presupuestos en modo de solo lectura. Para modificar estos valores debes editar `data.json` en el backend o extender la API con endpoints adicionales.
- El SLA no se calcula porque no se guarda un historial completo de eventos en este cliente. El backend incluye un campo de auditoría que podría aprovecharse para esta finalidad en futuras versiones.

## Contribuciones

Se agradece cualquier mejora a la interfaz, validaciones o nuevas funcionalidades. Asegúrate de coordinar con el equipo de backend para mantener la coherencia de los contratos de la API.
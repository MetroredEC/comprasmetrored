# Plataforma de Compras con Backend

Este proyecto amplía la demo estática y la convierte en una plataforma completa con un **backend** Node.js y un **frontend** web listo para ser publicado en GitHub Pages. La arquitectura separa la interfaz de usuario (frontend) del servidor (backend) para permitir despliegue independiente o integración con Dynamics 365 Business Central (BC).

## Estructura del repositorio

```
sistema-compras-platform/
├── backend/
│   ├── server.js           # Servidor Express con API REST
│   ├── package.json        # Dependencias y scripts
│   ├── data/
│   │   └── data.json       # Datos de ejemplo persistentes
│   └── README.md          # Guía de instalación y ejecución del backend
├── frontend/
│   ├── index.html         # Página principal
│   └── assets/
│       ├── app.js         # Lógica del frontend (consumo de API)
│       ├── styles.css     # Estilos
│       └── img/
│   └── README.md          # Cómo desplegar el frontend en GitHub Pages
└── docs/
    └── manual_tecnico.md  # Documentación técnica completa
```

## Cómo usar este repositorio

1. **Backend**: situado en la carpeta `backend`. Para ejecutarlo localmente necesitas Node.js instalado. Sigue las instrucciones de `backend/README.md`.
2. **Frontend**: situado en la carpeta `frontend`. Puedes abrir `index.html` directamente para desarrollo o desplegarlo en GitHub Pages siguiendo `frontend/README.md`.
3. **Integración con BC**: el servidor incluye funciones stub para integrar con Business Central a través de OData. Deberás configurar las credenciales y endpoints reales en el backend.

## Tests de QA

Se proporcionan pruebas manuales y scripts automáticos (tests) en el apartado `docs/manual_tecnico.md`. Estas pruebas cubren el flujo completo desde la creación de una solicitud hasta el pago.
const express = require('express');
const fs = require('fs');
const path = require('path');

// Ruta al archivo de datos JSON. Contiene las entidades del sistema.
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

/**
 * Carga y parsea el JSON de datos desde disco.
 */
function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

/**
 * Persiste el objeto de datos a disco.
 * @param {Object} data Estructura de datos completa.
 */
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Genera un ID pseudoaleatorio con un prefijo.
 * @param {string} prefix Prefijo (PR, Q, PO, INV, PAY, etc.).
 */
function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

const app = express();
app.use(express.json());

// Habilitar CORS para permitir que el frontend en GitHub Pages consuma la API.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// --- Endpoints de usuarios ---
app.get('/api/users', (req, res) => {
  const data = loadData();
  res.json(data.usuarios);
});

// --- Endpoints de solicitudes ---
// Obtener todas las solicitudes
app.get('/api/solicitudes', (req, res) => {
  const data = loadData();
  res.json(data.solicitudes);
});

// Crear nueva solicitud
app.post('/api/solicitudes', (req, res) => {
  const data = loadData();
  const {
    solicitanteId,
    area,
    descripcion,
    urgencia = false,
    justificacionUrgencia = '',
    items
  } = req.body;
  if (!solicitanteId || !area || !descripcion || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  const montoEstimado = items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
  const nueva = {
    id: generateId('PR'),
    fecha: new Date().toISOString(),
    solicitanteId,
    area,
    descripcion,
    urgencia: Boolean(urgencia),
    justificacionUrgencia,
    items,
    montoEstimado,
    estado: 'borrador',
    cotizaciones: [],
    proveedorSeleccionadoId: null,
    ordenCompraId: null,
    facturaId: null,
    pagoId: null
  };
  data.solicitudes.push(nueva);
  saveData(data);
  res.status(201).json(nueva);
});

// Actualizar solicitud completa
app.put('/api/solicitudes/:id', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  Object.assign(pr, req.body);
  // recalcular monto
  if (Array.isArray(pr.items)) {
    pr.montoEstimado = pr.items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
  }
  saveData(data);
  res.json(pr);
});

// Enviar solicitud para aprobación
app.post('/api/solicitudes/:id/enviar', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'borrador') return res.status(400).json({ error: 'Solo se pueden enviar borradores' });
  pr.estado = 'enviado';
  saveData(data);
  res.json(pr);
});

// Aprobar solicitud (jefatura)
app.post('/api/solicitudes/:id/aprobar', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'enviado') return res.status(400).json({ error: 'Estado no válido para aprobación' });
  pr.estado = 'aprobadoJefatura';
  saveData(data);
  res.json(pr);
});

// Rechazar solicitud (jefatura)
app.post('/api/solicitudes/:id/rechazar', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'enviado') return res.status(400).json({ error: 'Estado no válido para rechazo' });
  pr.estado = 'rechazado';
  pr.motivoRechazo = req.body.motivo || '';
  saveData(data);
  res.json(pr);
});

// Añadir cotización a una solicitud (Compras)
app.post('/api/solicitudes/:id/cotizaciones', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (!['aprobadoJefatura', 'enCotizacion'].includes(pr.estado)) {
    return res.status(400).json({ error: 'La solicitud no está en un estado válido para cotización' });
  }
  const { proveedorId, monto, detalle = '' } = req.body;
  if (!proveedorId || !monto) return res.status(400).json({ error: 'Faltan campos proveedorId o monto' });
  const proveedor = data.proveedores.find(p => p.id === proveedorId);
  if (!proveedor) return res.status(400).json({ error: 'Proveedor no encontrado' });
  if (proveedor.estado === 'bloqueado') return res.status(400).json({ error: 'Proveedor bloqueado' });
  const qid = generateId('Q');
  const cot = {
    id: qid,
    solicitudId: pr.id,
    proveedorId,
    fecha: new Date().toISOString(),
    monto: Number(monto),
    detalle,
    estado: 'recibida'
  };
  data.cotizaciones.push(cot);
  pr.cotizaciones.push(qid);
  pr.estado = 'enCotizacion';
  saveData(data);
  res.status(201).json(cot);
});

// Seleccionar cotización y generar orden (Compras)
app.post('/api/solicitudes/:id/orden', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'enCotizacion') return res.status(400).json({ error: 'Estado no válido para generar orden' });
  const { cotizacionId } = req.body;
  if (!cotizacionId) return res.status(400).json({ error: 'cotizacionId obligatorio' });
  const cot = data.cotizaciones.find(c => c.id === cotizacionId);
  if (!cot || cot.solicitudId !== pr.id) return res.status(400).json({ error: 'Cotización inválida' });
  // Marcar cotizaciones aceptada/rechazada
  pr.cotizaciones.forEach(cid => {
    const c = data.cotizaciones.find(ct => ct.id === cid);
    if (c.id === cotizacionId) c.estado = 'aceptada';
    else c.estado = 'rechazada';
  });
  pr.proveedorSeleccionadoId = cot.proveedorId;
  const poId = generateId('PO');
  const po = {
    id: poId,
    solicitudId: pr.id,
    cotizacionId: cot.id,
    proveedorId: cot.proveedorId,
    fecha: new Date().toISOString(),
    monto: cot.monto,
    estado: 'generada',
    items: pr.items,
    fechaEntrega: null,
    notas: ''
  };
  data.ordenesCompra.push(po);
  pr.ordenCompraId = poId;
  pr.estado = 'ordenCompraGenerada';
  saveData(data);
  res.json(po);
});

// Aprobar presupuesto (Contabilidad)
app.post('/api/solicitudes/:id/aprobar-presupuesto', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'ordenCompraGenerada') return res.status(400).json({ error: 'Estado no válido para aprobar presupuesto' });
  const presupuesto = data.presupuestos.find(p => p.area === pr.area);
  const po = data.ordenesCompra.find(o => o.id === pr.ordenCompraId);
  if (!presupuesto || !po) return res.status(500).json({ error: 'Presupuesto u orden no encontrada' });
  presupuesto.montoDisponible -= po.monto;
  pr.estado = 'aprobadoContabilidad';
  saveData(data);
  res.json(pr);
});

// Registrar factura (Contabilidad)
app.post('/api/solicitudes/:id/factura', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'aprobadoContabilidad') return res.status(400).json({ error: 'Estado no válido para registrar factura' });
  const { referencia, fecha, monto } = req.body;
  if (!referencia || !fecha) return res.status(400).json({ error: 'Faltan referencia o fecha' });
  const po = data.ordenesCompra.find(o => o.id === pr.ordenCompraId);
  const factId = generateId('INV');
  const factura = {
    id: factId,
    poId: po.id,
    proveedorId: pr.proveedorSeleccionadoId,
    fecha,
    monto: monto || po.monto,
    estado: 'registrada',
    referencia
  };
  data.facturas.push(factura);
  pr.facturaId = factId;
  pr.estado = 'facturado';
  saveData(data);
  res.json(factura);
});

// Registrar pago (Contabilidad)
app.post('/api/solicitudes/:id/pago', (req, res) => {
  const data = loadData();
  const pr = data.solicitudes.find(s => s.id === req.params.id);
  if (!pr) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (pr.estado !== 'facturado') return res.status(400).json({ error: 'Estado no válido para registrar pago' });
  const { fechaPago, metodo } = req.body;
  const inv = data.facturas.find(f => f.id === pr.facturaId);
  if (!inv) return res.status(500).json({ error: 'Factura no encontrada' });
  const payId = generateId('PAY');
  const pago = {
    id: payId,
    facturaId: inv.id,
    fechaPago,
    monto: inv.monto,
    metodo: metodo || 'Transferencia'
  };
  data.pagos.push(pago);
  pr.pagoId = payId;
  pr.estado = 'pagado';
  saveData(data);
  res.json(pago);
});

// --- Endpoints de proveedores ---
app.get('/api/proveedores', (req, res) => {
  res.json(loadData().proveedores);
});

// Crear o actualizar proveedor
app.post('/api/proveedores', (req, res) => {
  const data = loadData();
  const { nombre, estado = 'aprobado', rating = null } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
  const nuevo = {
    id: generateId('SUP'),
    nombre,
    estado,
    rating: rating === null ? null : Number(rating)
  };
  data.proveedores.push(nuevo);
  saveData(data);
  res.status(201).json(nuevo);
});

// Actualizar proveedor existente
app.put('/api/proveedores/:id', (req, res) => {
  const data = loadData();
  const prov = data.proveedores.find(p => p.id === req.params.id);
  if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });
  Object.assign(prov, req.body);
  saveData(data);
  res.json(prov);
});

// --- Endpoints de consulta de colecciones ---
// Retorna todas las cotizaciones
app.get('/api/cotizaciones', (req, res) => {
  const data = loadData();
  res.json(data.cotizaciones);
});

// Retorna todas las órdenes de compra
app.get('/api/ordenes', (req, res) => {
  const data = loadData();
  res.json(data.ordenesCompra);
});

// Retorna todas las facturas
app.get('/api/facturas', (req, res) => {
  const data = loadData();
  res.json(data.facturas);
});

// Retorna todos los pagos
app.get('/api/pagos', (req, res) => {
  const data = loadData();
  res.json(data.pagos);
});

// Retorna los presupuestos por área
app.get('/api/presupuestos', (req, res) => {
  const data = loadData();
  res.json(data.presupuestos);
});

// Retorna la matriz de aprobaciones
app.get('/api/matriz', (req, res) => {
  const data = loadData();
  res.json(data.matrizAprobaciones);
});

// --- Endpoints de reportes ---
// Reporte simple: número de solicitudes por estado
app.get('/api/reportes/solicitudes/estado', (req, res) => {
  const data = loadData();
  const result = {};
  data.solicitudes.forEach(pr => {
    result[pr.estado] = (result[pr.estado] || 0) + 1;
  });
  res.json(result);
});

// Reporte por área
app.get('/api/reportes/solicitudes/area', (req, res) => {
  const data = loadData();
  const result = {};
  data.solicitudes.forEach(pr => {
    result[pr.area] = (result[pr.area] || 0) + 1;
  });
  res.json(result);
});

// Reporte por proveedor adjudicado
app.get('/api/reportes/solicitudes/proveedor', (req, res) => {
  const data = loadData();
  const result = {};
  data.solicitudes.forEach(pr => {
    if (pr.proveedorSeleccionadoId) {
      result[pr.proveedorSeleccionadoId] = (result[pr.proveedorSeleccionadoId] || 0) + 1;
    }
  });
  res.json(result);
});

// --- Punto de integración con BC ---
/**
 * Esta función es un stub que simula la sincronización con Dynamics 365 Business Central.
 * En una integración real, aquí realizarías llamadas OData a BC para crear/actualizar entidades.
 * @param {string} entity Tipo de entidad (PR, PO, INV, PAY).
 * @param {object} payload Datos a sincronizar.
 */
function syncWithBC(entity, payload) {
  // Ejemplo: enviar datos a BC. Por ahora no hace nada.
  console.log(`Simulación de sincronización con BC: entidad ${entity}`, payload);
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
/*
 * Aplicación cliente para el Sistema de Compras con backend.
 * Se conecta a un servidor REST (por defecto http://localhost:3000) para
 * obtener y actualizar datos. Las vistas y flujos se basan en la demo
 * original, pero ahora las operaciones se delegan al servidor.
 */
(function () {
  // Base de la API. Puedes sobreescribir window.API_BASE_URL antes de cargar este script.
  const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
  let appData = {};
  let currentUser = null;
  let currentModule = '';
  let currentParams = {};

  /**
   * Carga todas las entidades desde el backend en memoria local.
   */
  async function loadAppData() {
    try {
      const [usuarios, solicitudes, proveedores, cotizaciones, ordenes, facturas, pagos, presupuestos, matriz] = await Promise.all([
        fetch(`${API_BASE}/api/users`).then(res => res.json()),
        fetch(`${API_BASE}/api/solicitudes`).then(res => res.json()),
        fetch(`${API_BASE}/api/proveedores`).then(res => res.json()),
        fetch(`${API_BASE}/api/cotizaciones`).then(res => res.json()),
        fetch(`${API_BASE}/api/ordenes`).then(res => res.json()),
        fetch(`${API_BASE}/api/facturas`).then(res => res.json()),
        fetch(`${API_BASE}/api/pagos`).then(res => res.json()),
        fetch(`${API_BASE}/api/presupuestos`).then(res => res.json()),
        fetch(`${API_BASE}/api/matriz`).then(res => res.json())
      ]);
      appData = {
        usuarios,
        solicitudes,
        proveedores,
        cotizaciones,
        ordenesCompra: ordenes,
        facturas,
        pagos,
        presupuestos,
        matrizAprobaciones: matriz
      };
    } catch (err) {
      console.error('Error cargando datos del backend', err);
      alert('No se pudieron cargar los datos desde el servidor. Revisa la conexión.');
    }
  }

  /**
   * Obtiene un usuario por ID.
   */
  function getUserById(id) {
    return appData.usuarios.find(u => u.id === id);
  }

  /**
   * Obtiene un proveedor por ID.
   */
  function getSupplierById(id) {
    return appData.proveedores.find(p => p.id === id);
  }

  /**
   * Obtiene una solicitud por ID.
   */
  function getSolicitudById(id) {
    return appData.solicitudes.find(s => s.id === id);
  }

  /**
   * Formatea fecha ISO a formato local.
   */
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-EC');
  }

  /**
   * Formatea valor numérico a moneda.
   */
  function formatCurrency(value) {
    const moneda = 'USD';
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: moneda, minimumFractionDigits: 2 }).format(value);
  }

  /**
   * Recupera tareas pendientes para el usuario actual.
   */
  function getPendingTasks() {
    const tasks = [];
    if (!currentUser) return tasks;
    const rol = currentUser.rol;
    if (rol === 'Solicitante') {
      appData.solicitudes.forEach(pr => {
        if (pr.solicitanteId === currentUser.id) {
          if (pr.estado === 'borrador') {
            tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Completa y envía la solicitud ${pr.id}` });
          } else if (pr.estado === 'rechazado') {
            tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Tu solicitud ${pr.id} fue rechazada` });
          }
        }
      });
    } else if (rol === 'Jefatura') {
      appData.solicitudes.forEach(pr => {
        if (pr.area === currentUser.area && pr.estado === 'enviado') {
          tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Revisar y aprobar solicitud ${pr.id}` });
        }
      });
    } else if (rol === 'Compras') {
      appData.solicitudes.forEach(pr => {
        if (pr.estado === 'aprobadoJefatura' || pr.estado === 'enCotizacion') {
          tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Gestionar cotizaciones de ${pr.id}` });
        }
        if (pr.estado === 'enCotizacion' && pr.cotizaciones && pr.cotizaciones.length > 0 && !pr.ordenCompraId) {
          tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Seleccionar proveedor y generar OC (${pr.id})` });
        }
      });
    } else if (rol === 'Contabilidad') {
      appData.solicitudes.forEach(pr => {
        if (pr.estado === 'ordenCompraGenerada') {
          tasks.push({ entidad: 'PR', id: pr.id, descripcion: `Aprobar presupuesto y registrar factura (${pr.id})` });
        }
        if (pr.estado === 'aprobadoContabilidad' && pr.facturaId && !pr.pagoId) {
          tasks.push({ entidad: 'INV', id: pr.facturaId, descripcion: `Registrar pago para ${pr.id}` });
        }
      });
    }
    return tasks;
  }

  /**
   * Renderiza la pantalla de login.
   */
  function renderLogin() {
    const appEl = document.getElementById('app');
    let html = '<h2>Selecciona tu usuario</h2>';
    html += '<p>Este modo requiere seleccionar un usuario. No hay autenticación real.</p>';
    html += '<div class="user-list">';
    appData.usuarios.forEach(u => {
      html += `<button class="btn btn-primary" data-login="${u.id}">${u.nombre} (${u.rol}${u.area ? ' - ' + u.area : ''})</button><br>`;
    });
    html += '</div>';
    appEl.innerHTML = html;
    appEl.querySelectorAll('button[data-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        loginAs(btn.dataset.login);
      });
    });
  }

  /**
   * Renderiza el menú principal basado en el rol.
   */
  function renderMenu() {
    const nav = document.getElementById('nav');
    const headerInfo = document.getElementById('header-user-info');
    if (!currentUser) {
      nav.innerHTML = '';
      headerInfo.innerHTML = '';
      return;
    }
    const modules = [];
    modules.push({ id: 'dashboard', label: 'Inicio' });
    modules.push({ id: 'solicitudes', label: 'Solicitudes' });
    if (currentUser.rol === 'Compras' || currentUser.rol === 'Admin') {
      modules.push({ id: 'compras', label: 'Compras' });
      modules.push({ id: 'proveedores', label: 'Proveedores' });
    }
    if (currentUser.rol === 'Contabilidad' || currentUser.rol === 'Admin') {
      modules.push({ id: 'contabilidad', label: 'Contabilidad' });
    }
    modules.push({ id: 'reportes', label: 'Reportes' });
    if (currentUser.rol === 'Admin') {
      modules.push({ id: 'admin', label: 'Admin' });
    }
    let html = '';
    modules.forEach(m => {
      html += `<button class="${currentModule === m.id ? 'active' : ''}" data-mod="${m.id}">${m.label}</button>`;
    });
    html += `<button class="btn btn-danger" id="btnLogout">Salir</button>`;
    nav.innerHTML = html;
    headerInfo.innerHTML = `<strong>${currentUser.nombre}</strong> (${currentUser.rol}${currentUser.area ? ' - ' + currentUser.area : ''})`;
    modules.forEach(m => {
      const btn = nav.querySelector(`button[data-mod="${m.id}"]`);
      btn.addEventListener('click', () => setCurrentModule(m.id));
    });
    document.getElementById('btnLogout').addEventListener('click', logout);
  }

  /**
   * Cambia el módulo actual y renderiza.
   */
  function setCurrentModule(mod) {
    currentModule = mod;
    currentParams = {};
    renderMenu();
    renderCurrentView();
  }

  /**
   * Renderiza la vista según el módulo actual.
   */
  function renderCurrentView() {
    if (!currentUser) {
      renderLogin();
      return;
    }
    switch (currentModule) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'solicitudes':
        renderSolicitudesList();
        break;
      case 'compras':
        renderComprasModule();
        break;
      case 'proveedores':
        renderProveedoresModule();
        break;
      case 'contabilidad':
        renderContabilidadModule();
        break;
      case 'reportes':
        renderReportesModule();
        break;
      case 'admin':
        renderAdminModule();
        break;
      default:
        renderDashboard();
    }
  }

  /**
   * Inicia sesión como un usuario específico y carga datos si es necesario.
   */
  async function loginAs(id) {
    const u = getUserById(id);
    if (u) {
      currentUser = u;
      localStorage.setItem('currentUserId', id);
      currentModule = 'dashboard';
      await loadAppData();
      renderMenu();
      renderCurrentView();
    }
  }

  /**
   * Cierra la sesión.
   */
  function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserId');
    renderMenu();
    renderLogin();
  }

  /**
   * Renderiza el dashboard con tareas y KPIs.
   */
  function renderDashboard() {
    const appEl = document.getElementById('app');
    let html = '<h2>Inicio</h2>';
    const tasks = getPendingTasks();
    html += '<h3>Tareas pendientes</h3>';
    if (tasks.length === 0) {
      html += '<p>No tienes tareas pendientes por ahora.</p>';
    } else {
      html += '<ul>';
      tasks.forEach(t => {
        html += `<li><a href="#" data-task="${t.entidad}|${t.id}">${t.descripcion}</a></li>`;
      });
      html += '</ul>';
    }
    // KPI: solicitudes por estado
    const estados = {};
    appData.solicitudes.forEach(pr => {
      estados[pr.estado] = (estados[pr.estado] || 0) + 1;
    });
    html += '<h3>Solicitudes por estado</h3>';
    html += '<div class="kpi-container">';
    Object.keys(estados).forEach(est => {
      html += `<span class="status-badge status-${est.toLowerCase()}">${est}: ${estados[est]}</span> `;
    });
    html += '</div>';
    // Presupuesto
    if (currentUser.area) {
      const budget = appData.presupuestos.find(p => p.area === currentUser.area);
      if (budget) {
        html += `<h3>Presupuesto (${budget.area})</h3>`;
        html += `<p>Disponible: ${formatCurrency(budget.montoDisponible)} / Total anual: ${formatCurrency(budget.montoAnual)}</p>`;
      }
    }
    appEl.innerHTML = html;
    // Event listeners for tasks
    appEl.querySelectorAll('a[data-task]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const [entidad, id] = a.dataset.task.split('|');
        if (entidad === 'PR') {
          viewSolicitudDetail(id);
        } else if (entidad === 'INV') {
          const pr = appData.solicitudes.find(pr => pr.facturaId === id);
          if (pr) viewSolicitudDetail(pr.id);
        }
      });
    });
  }

  /**
   * Renderiza la lista de solicitudes para el usuario actual.
   */
  function renderSolicitudesList() {
    const appEl = document.getElementById('app');
    let html = '<h2>Solicitudes</h2>';
    if (currentUser.rol === 'Solicitante' || currentUser.rol === 'Admin') {
      html += '<button class="btn btn-primary" id="btnNuevaSolicitud">Nueva solicitud</button>';
    }
    // Filtrado según rol
    let solicitudesMostradas = [];
    if (currentUser.rol === 'Admin') {
      solicitudesMostradas = appData.solicitudes;
    } else if (currentUser.rol === 'Solicitante') {
      solicitudesMostradas = appData.solicitudes.filter(pr => pr.solicitanteId === currentUser.id);
    } else if (currentUser.rol === 'Jefatura') {
      solicitudesMostradas = appData.solicitudes.filter(pr => pr.area === currentUser.area);
    } else if (currentUser.rol === 'Compras') {
      solicitudesMostradas = appData.solicitudes.filter(pr => ['aprobadoJefatura', 'enCotizacion', 'ordenCompraGenerada', 'aprobadoContabilidad', 'facturado', 'pagado', 'cotizado'].includes(pr.estado));
    } else if (currentUser.rol === 'Contabilidad') {
      solicitudesMostradas = appData.solicitudes.filter(pr => ['ordenCompraGenerada', 'aprobadoContabilidad', 'facturado', 'pagado'].includes(pr.estado));
    }
    html += '<table class="table"><thead><tr>' +
      '<th>ID</th><th>Fecha</th><th>Área</th><th>Descripción</th><th>Solicitante</th><th>Monto estimado</th><th>Estado</th><th>Urgencia</th><th>Acciones</th>' +
      '</tr></thead><tbody>';
    solicitudesMostradas.forEach(pr => {
      const solicitante = getUserById(pr.solicitanteId);
      html += `<tr>` +
        `<td>${pr.id}</td>` +
        `<td>${formatDate(pr.fecha)}</td>` +
        `<td>${pr.area}</td>` +
        `<td>${pr.descripcion}</td>` +
        `<td>${solicitante ? solicitante.nombre : pr.solicitanteId}</td>` +
        `<td>${formatCurrency(pr.montoEstimado || 0)}</td>` +
        `<td><span class="status-badge status-${pr.estado.toLowerCase()}">${pr.estado}</span></td>` +
        `<td>${pr.urgencia ? 'Sí' : 'No'}</td>` +
        `<td><button class="btn btn-secondary" data-view-pr="${pr.id}">Detalle</button></td>` +
        `</tr>`;
    });
    html += '</tbody></table>';
    appEl.innerHTML = html;
    if (currentUser.rol === 'Solicitante' || currentUser.rol === 'Admin') {
      const btnNew = document.getElementById('btnNuevaSolicitud');
      if (btnNew) {
        btnNew.addEventListener('click', () => {
          renderSolicitudForm();
        });
      }
    }
    appEl.querySelectorAll('button[data-view-pr]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.viewPr;
        viewSolicitudDetail(id);
      });
    });
  }

  /**
   * Renderiza el formulario para crear o editar una solicitud.
   * Si solicitudId es null, crea una nueva.
   */
  function renderSolicitudForm(solicitudId) {
    const appEl = document.getElementById('app');
    const solicitud = solicitudId ? getSolicitudById(solicitudId) : null;
    const editing = Boolean(solicitud);
    // Restricciones: solo solicitante y admin pueden editar
    if (!editing && !(currentUser.rol === 'Solicitante' || currentUser.rol === 'Admin')) {
      renderSolicitudesList();
      return;
    }
    // Copiar items
    let items = solicitud && solicitud.items ? JSON.parse(JSON.stringify(solicitud.items)) : [];
    if (items.length === 0) items.push({ descripcion: '', cantidad: 1, precioUnitario: 0 });
    function updateItemsList() {
      const tbody = document.getElementById('itemsBody');
      tbody.innerHTML = '';
      items.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="text" value="${it.descripcion}" data-field="descripcion" data-index="${idx}"/></td>
          <td><input type="number" min="1" value="${it.cantidad}" data-field="cantidad" data-index="${idx}" style="width:80px"/></td>
          <td><input type="number" min="0" step="0.01" value="${it.precioUnitario}" data-field="precio" data-index="${idx}" style="width:100px"/></td>
          <td>${formatCurrency(it.cantidad * it.precioUnitario)}</td>
          <td><button class="btn btn-danger" data-remove-index="${idx}">×</button></td>`;
        tbody.appendChild(tr);
      });
      const total = items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
      document.getElementById('totalEstimado').textContent = formatCurrency(total);
    }
    let html = `<h2>${editing ? 'Editar solicitud' : 'Nueva solicitud'}</h2>`;
    html += '<form id="formSolicitud">';
    html += '<div class="form-group"><label>Área/centro de costo</label>';
    html += '<select name="area" required>';
    appData.presupuestos.forEach(p => {
      html += `<option value="${p.area}" ${solicitud && solicitud.area === p.area ? 'selected' : ''}>${p.area}</option>`;
    });
    html += '</select></div>';
    html += '<div class="form-group"><label>Descripción</label><textarea name="descripcion" required>' + (solicitud ? solicitud.descripcion : '') + '</textarea></div>';
    html += '<div class="form-group"><label>Urgencia</label><input type="checkbox" name="urgencia" ' + (solicitud && solicitud.urgencia ? 'checked' : '') + '/> ¿Requiere tratamiento urgente?</div>';
    html += '<div class="form-group"><label>Justificación de urgencia</label><textarea name="justificacion">' + (solicitud && solicitud.justificacionUrgencia ? solicitud.justificacionUrgencia : '') + '</textarea></div>';
    html += '<h3>Items</h3>';
    html += '<table class="table"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody id="itemsBody"></tbody></table>';
    html += '<button type="button" class="btn btn-secondary" id="btnAgregarItem">Agregar ítem</button>';
    html += `<p>Total estimado: <strong id="totalEstimado">0</strong></p>`;
    html += '<div class="form-group">';
    html += editing ? '<button type="submit" class="btn btn-primary">Guardar cambios</button>' : '<button type="submit" class="btn btn-primary">Guardar borrador</button>';
    html += '<button type="button" class="btn btn-success" id="btnEnviarSolicitud">Enviar solicitud</button>';
    html += '<button type="button" class="btn btn-secondary" id="btnCancelar">Cancelar</button>';
    html += '</div>';
    html += '</form>';
    appEl.innerHTML = html;
    // Render items
    updateItemsList();
    // Events for items
    document.getElementById('itemsBody').addEventListener('change', e => {
      const field = e.target.dataset.field;
      const idx = parseInt(e.target.dataset.index);
      if (field && idx >= 0) {
        if (field === 'descripcion') items[idx].descripcion = e.target.value;
        if (field === 'cantidad') items[idx].cantidad = parseFloat(e.target.value);
        if (field === 'precio') items[idx].precioUnitario = parseFloat(e.target.value);
        updateItemsList();
      }
    });
    document.getElementById('itemsBody').addEventListener('click', e => {
      const idx = e.target.dataset.removeIndex;
      if (idx !== undefined) {
        items.splice(parseInt(idx), 1);
        if (items.length === 0) items.push({ descripcion: '', cantidad: 1, precioUnitario: 0 });
        updateItemsList();
      }
    });
    document.getElementById('btnAgregarItem').addEventListener('click', () => {
      items.push({ descripcion: '', cantidad: 1, precioUnitario: 0 });
      updateItemsList();
    });
    // Submit: guardar borrador o cambios
    document.getElementById('formSolicitud').addEventListener('submit', async e => {
      e.preventDefault();
      await handleSolicitudSave(solicitud, items);
    });
    // Cancelar
    document.getElementById('btnCancelar').addEventListener('click', () => {
      renderSolicitudesList();
    });
    // Enviar
    document.getElementById('btnEnviarSolicitud').addEventListener('click', async () => {
      await handleSolicitudSend(solicitud, items);
    });
  }

  /**
   * Guarda una solicitud en borrador o actualiza una existente.
   */
  async function handleSolicitudSave(solicitud, items) {
    const form = document.getElementById('formSolicitud');
    const formData = new FormData(form);
    const area = formData.get('area');
    const descripcion = formData.get('descripcion').trim();
    const urgencia = formData.get('urgencia') === 'on';
    const justificacion = formData.get('justificacion').trim();
    const total = items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
    if (!descripcion) {
      alert('La descripción es obligatoria.');
      return;
    }
    const payload = {
      solicitanteId: currentUser.id,
      area,
      descripcion,
      urgencia,
      justificacionUrgencia: justificacion,
      items,
      montoEstimado: total,
      estado: 'borrador'
    };
    try {
      if (solicitud) {
        // actualizar
        const resp = await fetch(`${API_BASE}/api/solicitudes/${solicitud.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, estado: solicitud.estado })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Error al actualizar');
        }
      } else {
        const resp = await fetch(`${API_BASE}/api/solicitudes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Error al crear');
        }
      }
      await loadAppData();
      renderSolicitudesList();
    } catch (err) {
      alert('Error guardando solicitud: ' + err.message);
    }
  }

  /**
   * Envía la solicitud para aprobación de jefatura.
   */
  async function handleSolicitudSend(solicitud, items) {
    const form = document.getElementById('formSolicitud');
    const formData = new FormData(form);
    const area = formData.get('area');
    const descripcion = formData.get('descripcion').trim();
    const urgencia = formData.get('urgencia') === 'on';
    const justificacion = formData.get('justificacion').trim();
    const total = items.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
    if (!descripcion) {
      alert('La descripción es obligatoria.');
      return;
    }
    try {
      let prId;
      if (solicitud) {
        // actualizar y enviar
        await handleSolicitudSave(solicitud, items);
        prId = solicitud.id;
      } else {
        // crear
        const respCreate = await fetch(`${API_BASE}/api/solicitudes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            solicitanteId: currentUser.id,
            area,
            descripcion,
            urgencia,
            justificacionUrgencia: justificacion,
            items,
            montoEstimado: total
          })
        });
        const newPr = await respCreate.json();
        prId = newPr.id;
      }
      const resp = await fetch(`${API_BASE}/api/solicitudes/${prId}/enviar`, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al enviar');
      }
      await loadAppData();
      renderSolicitudesList();
    } catch (err) {
      alert('Error al enviar solicitud: ' + err.message);
    }
  }

  /**
   * Aprueba solicitud como jefatura.
   */
  async function handleSolicitudApprove(pr) {
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/aprobar`, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al aprobar');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al aprobar solicitud: ' + err.message);
    }
  }

  /**
   * Rechaza solicitud como jefatura.
   */
  async function handleSolicitudReject(pr) {
    const motivo = prompt('Motivo de rechazo:');
    if (motivo === null) return;
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al rechazar');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al rechazar: ' + err.message);
    }
  }

  /**
   * Agrega una cotización a una solicitud. Solo compras.
   */
  async function handleQuotationAdd(pr) {
    const proveedorId = prompt('ID del proveedor (solo proveedores no bloqueados):\n' + appData.proveedores.filter(p => p.estado !== 'bloqueado').map(p => `${p.id}: ${p.nombre}`).join('\n'));
    if (!proveedorId) return;
    const proveedor = getSupplierById(proveedorId.trim());
    if (!proveedor) {
      alert('Proveedor no encontrado');
      return;
    }
    const montoStr = prompt('Monto ofertado (numérico):');
    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto <= 0) {
      alert('Monto inválido');
      return;
    }
    const detalle = prompt('Detalle u observaciones de la cotización (opcional):') || '';
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedorId: proveedor.id, monto, detalle })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al agregar cotización');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error agregando cotización: ' + err.message);
    }
  }

  /**
   * Selecciona cotización ganadora y genera OC.
   */
  async function handleSelectQuotation(pr) {
    // obtener cotización seleccionada del radio
    const radios = document.querySelectorAll('input[name="cotSelect"]');
    let selectedId = null;
    radios.forEach(r => { if (r.checked) selectedId = r.value; });
    if (!selectedId) {
      alert('Seleccione una cotización para continuar');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/orden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: selectedId })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al generar OC');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al generar OC: ' + err.message);
    }
  }

  /**
   * Contabilidad aprueba presupuesto.
   */
  async function handleAprobacionPresupuesto(pr) {
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/aprobar-presupuesto`, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al aprobar presupuesto');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al aprobar presupuesto: ' + err.message);
    }
  }

  /**
   * Contabilidad registra factura.
   */
  async function handleRegistrarFactura(pr) {
    const referencia = prompt('Número de factura:');
    if (!referencia) return;
    const fecha = prompt('Fecha de factura (AAAA-MM-DD):');
    if (!fecha) return;
    const montoStr = prompt('Monto de la factura (dejar en blanco para usar el monto de la OC):');
    let payload = { referencia, fecha };
    if (montoStr) {
      const m = parseFloat(montoStr);
      if (!isNaN(m) && m > 0) payload.monto = m;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al registrar factura');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al registrar factura: ' + err.message);
    }
  }

  /**
   * Contabilidad registra pago.
   */
  async function handleRegistrarPago(pr) {
    const fechaPago = prompt('Fecha de pago (AAAA-MM-DD):');
    if (!fechaPago) return;
    const metodo = prompt('Método de pago (por ejemplo: transferencia, cheque, etc.):');
    try {
      const resp = await fetch(`${API_BASE}/api/solicitudes/${pr.id}/pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaPago, metodo })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al registrar pago');
      }
      await loadAppData();
      viewSolicitudDetail(pr.id);
    } catch (err) {
      alert('Error al registrar pago: ' + err.message);
    }
  }

  /**
   * Muestra el detalle de una solicitud.
   */
  function viewSolicitudDetail(id) {
    renderSolicitudDetail(id);
  }

  /**
   * Renderiza detalle de solicitud, cotizaciones, OC, factura, pago y acciones.
   */
  function renderSolicitudDetail(id) {
    const pr = getSolicitudById(id);
    if (!pr) {
      alert('Solicitud no encontrada');
      renderSolicitudesList();
      return;
    }
    const appEl = document.getElementById('app');
    const solicitante = getUserById(pr.solicitanteId);
    let html = `<h2>Detalle solicitud ${pr.id}</h2>`;
    html += `<p><strong>Fecha:</strong> ${formatDate(pr.fecha)}</p>`;
    html += `<p><strong>Área:</strong> ${pr.area}</p>`;
    html += `<p><strong>Solicitante:</strong> ${solicitante ? solicitante.nombre : pr.solicitanteId}</p>`;
    html += `<p><strong>Descripción:</strong> ${pr.descripcion}</p>`;
    html += `<p><strong>Urgencia:</strong> ${pr.urgencia ? 'Sí' : 'No'}`;
    if (pr.urgencia) {
      html += ` | <strong>Justificación:</strong> ${pr.justificacionUrgencia || '(sin justificación)'}`;
    }
    html += '</p>';
    // Items
    html += '<h3>Items</h3>';
    html += '<table class="table"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>';
    pr.items.forEach(it => {
      html += `<tr><td>${it.descripcion}</td><td>${it.cantidad}</td><td>${formatCurrency(it.precioUnitario)}</td><td>${formatCurrency(it.cantidad * it.precioUnitario)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<p><strong>Monto estimado:</strong> ${formatCurrency(pr.montoEstimado)}</p>`;
    // Cotizaciones
    html += '<h3>Cotizaciones</h3>';
    if (!pr.cotizaciones || pr.cotizaciones.length === 0) {
      html += '<p>No hay cotizaciones registradas.</p>';
    } else {
      html += '<table class="table"><thead><tr><th>ID</th><th>Proveedor</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>';
      pr.cotizaciones.forEach(cid => {
        const cot = appData.cotizaciones.find(c => c.id === cid);
        const proveedor = getSupplierById(cot.proveedorId);
        html += `<tr>` +
          `<td>${cot.id}</td>` +
          `<td>${proveedor ? proveedor.nombre : cot.proveedorId}</td>` +
          `<td>${formatCurrency(cot.monto)}</td>` +
          `<td>${cot.estado}</td>` +
          `<td>${(currentUser.rol === 'Compras' && pr.estado === 'enCotizacion' && !pr.ordenCompraId) ? `<input type="radio" name="cotSelect" value="${cot.id}" ${pr.proveedorSeleccionadoId === cot.proveedorId ? 'checked' : ''}/>` : ''}</td>` +
          `</tr>`;
      });
      html += '</tbody></table>';
    }
    // Orden de compra
    if (pr.ordenCompraId) {
      const po = appData.ordenesCompra.find(o => o.id === pr.ordenCompraId);
      if (po) {
        html += `<h3>Orden de compra</h3><p>ID OC: ${po.id}, Fecha: ${formatDate(po.fecha)}, Monto: ${formatCurrency(po.monto)}</p>`;
      }
    }
    // Factura
    if (pr.facturaId) {
      const inv = appData.facturas.find(inv => inv.id === pr.facturaId);
      if (inv) {
        html += `<h3>Factura</h3><p>ID Factura: ${inv.id}, Fecha: ${formatDate(inv.fecha)}, Monto: ${formatCurrency(inv.monto)}</p>`;
      }
    }
    // Pago
    if (pr.pagoId) {
      const pay = appData.pagos.find(p => p.id === pr.pagoId);
      if (pay) {
        html += `<h3>Pago</h3><p>ID Pago: ${pay.id}, Fecha de pago: ${formatDate(pay.fechaPago)}, Monto: ${formatCurrency(pay.monto)}</p>`;
      }
    }
    // Acciones
    html += '<h3>Acciones</h3>';
    html += '<div id="acciones"></div>';
    html += '<button class="btn btn-secondary" id="btnVolver">Volver</button>';
    appEl.innerHTML = html;
    document.getElementById('btnVolver').addEventListener('click', () => {
      renderSolicitudesList();
    });
    renderAccionesDetalle(pr);
  }

  /**
   * Determina y renderiza los botones de acción según rol y estado.
   */
  function renderAccionesDetalle(pr) {
    const container = document.getElementById('acciones');
    let html = '';
    // Solicitante: editar borrador o enviar
    if ((currentUser.rol === 'Solicitante' || currentUser.rol === 'Admin') && pr.solicitanteId === currentUser.id && pr.estado === 'borrador') {
      html += `<button class="btn btn-primary" id="btnEditar">Editar</button>`;
      html += `<button class="btn btn-success" id="btnEnviar">Enviar para aprobación</button>`;
    }
    // Jefatura: aprobar/rechazar
    if (currentUser.rol === 'Jefatura' && pr.area === currentUser.area && pr.estado === 'enviado') {
      html += `<button class="btn btn-success" id="btnAprobar">Aprobar</button>`;
      html += `<button class="btn btn-danger" id="btnRechazar">Rechazar</button>`;
    }
    // Compras: agregar cotización
    if (currentUser.rol === 'Compras' && pr.estado === 'aprobadoJefatura') {
      html += `<button class="btn btn-primary" id="btnAddCot">Agregar cotización</button>`;
    }
    // Compras: seleccionar proveedor
    if (currentUser.rol === 'Compras' && pr.estado === 'enCotizacion' && !pr.ordenCompraId) {
      html += `<button class="btn btn-success" id="btnSelectProveedor">Seleccionar proveedor</button>`;
    }
    // Contabilidad: aprobar presupuesto
    if (currentUser.rol === 'Contabilidad' && pr.estado === 'ordenCompraGenerada') {
      html += `<button class="btn btn-success" id="btnAprobarPresupuesto">Aprobar presupuesto</button>`;
    }
    // Contabilidad: registrar factura
    if (currentUser.rol === 'Contabilidad' && pr.estado === 'aprobadoContabilidad' && !pr.facturaId) {
      html += `<button class="btn btn-primary" id="btnRegistrarFactura">Registrar factura</button>`;
    }
    // Contabilidad: registrar pago
    if (currentUser.rol === 'Contabilidad' && pr.estado === 'facturado' && !pr.pagoId) {
      html += `<button class="btn btn-success" id="btnRegistrarPago">Registrar pago</button>`;
    }
    container.innerHTML = html;
    // assign events
    if (document.getElementById('btnEditar')) {
      document.getElementById('btnEditar').addEventListener('click', () => {
        renderSolicitudForm(pr.id);
      });
    }
    if (document.getElementById('btnEnviar')) {
      document.getElementById('btnEnviar').addEventListener('click', async () => {
        await handleSolicitudSend(pr, pr.items);
      });
    }
    if (document.getElementById('btnAprobar')) {
      document.getElementById('btnAprobar').addEventListener('click', async () => {
        await handleSolicitudApprove(pr);
      });
    }
    if (document.getElementById('btnRechazar')) {
      document.getElementById('btnRechazar').addEventListener('click', async () => {
        await handleSolicitudReject(pr);
      });
    }
    if (document.getElementById('btnAddCot')) {
      document.getElementById('btnAddCot').addEventListener('click', async () => {
        await handleQuotationAdd(pr);
      });
    }
    if (document.getElementById('btnSelectProveedor')) {
      document.getElementById('btnSelectProveedor').addEventListener('click', async () => {
        await handleSelectQuotation(pr);
      });
    }
    if (document.getElementById('btnAprobarPresupuesto')) {
      document.getElementById('btnAprobarPresupuesto').addEventListener('click', async () => {
        await handleAprobacionPresupuesto(pr);
      });
    }
    if (document.getElementById('btnRegistrarFactura')) {
      document.getElementById('btnRegistrarFactura').addEventListener('click', async () => {
        await handleRegistrarFactura(pr);
      });
    }
    if (document.getElementById('btnRegistrarPago')) {
      document.getElementById('btnRegistrarPago').addEventListener('click', async () => {
        await handleRegistrarPago(pr);
      });
    }
  }

  /**
   * Renderiza el módulo de compras: solicitudes en proceso y OC.
   */
  function renderComprasModule() {
    const appEl = document.getElementById('app');
    let html = '<h2>Módulo de compras</h2>';
    const pendientes = appData.solicitudes.filter(pr => pr.estado === 'aprobadoJefatura' || pr.estado === 'enCotizacion');
    html += '<h3>Solicitudes para gestionar</h3>';
    if (pendientes.length === 0) {
      html += '<p>No hay solicitudes pendientes.</p>';
    } else {
      html += '<ul>';
      pendientes.forEach(pr => {
        html += `<li>${pr.id} - ${pr.descripcion} (<a href="#" data-pr="${pr.id}">ver detalle</a>)</li>`;
      });
      html += '</ul>';
    }
    const pos = appData.ordenesCompra;
    html += '<h3>Órdenes de compra</h3>';
    if (pos.length === 0) {
      html += '<p>No hay órdenes de compra.</p>';
    } else {
      html += '<table class="table"><thead><tr><th>ID OC</th><th>Solicitud</th><th>Proveedor</th><th>Monto</th><th>Estado</th></tr></thead><tbody>';
      pos.forEach(po => {
        const proveedor = getSupplierById(po.proveedorId);
        html += `<tr><td>${po.id}</td><td>${po.solicitudId}</td><td>${proveedor ? proveedor.nombre : po.proveedorId}</td><td>${formatCurrency(po.monto)}</td><td>${po.estado}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    appEl.innerHTML = html;
    appEl.querySelectorAll('a[data-pr]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        viewSolicitudDetail(a.dataset.pr);
      });
    });
  }

  /**
   * Renderiza el módulo de proveedores. Alta y edición.
   */
  function renderProveedoresModule() {
    const appEl = document.getElementById('app');
    let html = '<h2>Proveedores</h2>';
    html += '<button class="btn btn-primary" id="btnNuevoProveedor">Nuevo proveedor</button>';
    html += '<table class="table"><thead><tr><th>ID</th><th>Nombre</th><th>Estado</th><th>Rating</th><th>Acción</th></tr></thead><tbody>';
    appData.proveedores.forEach(p => {
      html += `<tr><td>${p.id}</td><td>${p.nombre}</td><td>${p.estado}</td><td>${p.rating || ''}</td><td><button class="btn btn-secondary" data-edit-prov="${p.id}">Editar</button></td></tr>`;
    });
    html += '</tbody></table>';
    appEl.innerHTML = html;
    document.getElementById('btnNuevoProveedor').addEventListener('click', () => {
      renderProveedorForm();
    });
    appEl.querySelectorAll('button[data-edit-prov]').forEach(btn => {
      btn.addEventListener('click', () => {
        renderProveedorForm(btn.dataset.editProv);
      });
    });
  }

  /**
   * Formulario de proveedor. Crear o editar.
   */
  function renderProveedorForm(id) {
    const proveedor = id ? getSupplierById(id) : null;
    const appEl = document.getElementById('app');
    let html = `<h2>${proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>`;
    html += '<form id="formProveedor">';
    html += '<div class="form-group"><label>Nombre</label><input type="text" name="nombre" required value="' + (proveedor ? proveedor.nombre : '') + '"/></div>';
    html += '<div class="form-group"><label>Estado</label><select name="estado">' +
      `<option value="aprobado" ${proveedor && proveedor.estado === 'aprobado' ? 'selected' : ''}>aprobado</option>` +
      `<option value="condicional" ${proveedor && proveedor.estado === 'condicional' ? 'selected' : ''}>condicional</option>` +
      `<option value="bloqueado" ${proveedor && proveedor.estado === 'bloqueado' ? 'selected' : ''}>bloqueado</option>` +
      '</select></div>';
    html += '<div class="form-group"><label>Rating (1-5)</label><input type="number" name="rating" min="1" max="5" step="0.1" value="' + (proveedor ? proveedor.rating : '') + '"/></div>';
    html += '<div class="form-group">';
    html += '<button type="submit" class="btn btn-primary">Guardar</button>';
    html += '<button type="button" class="btn btn-secondary" id="btnCancelarProv">Cancelar</button>';
    html += '</div>';
    html += '</form>';
    appEl.innerHTML = html;
    document.getElementById('btnCancelarProv').addEventListener('click', () => {
      renderProveedoresModule();
    });
    document.getElementById('formProveedor').addEventListener('submit', async e => {
      e.preventDefault();
      const data = new FormData(e.target);
      const nombre = data.get('nombre').trim();
      const estado = data.get('estado');
      const rating = parseFloat(data.get('rating')) || null;
      if (!nombre) {
        alert('El nombre es obligatorio');
        return;
      }
      try {
        if (proveedor) {
          // actualizar
          const resp = await fetch(`${API_BASE}/api/proveedores/${proveedor.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, estado, rating })
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Error al actualizar proveedor');
          }
        } else {
          const resp = await fetch(`${API_BASE}/api/proveedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, estado, rating })
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Error al crear proveedor');
          }
        }
        await loadAppData();
        renderProveedoresModule();
      } catch (err) {
        alert('Error guardando proveedor: ' + err.message);
      }
    });
  }

  /**
   * Módulo de contabilidad: solicitudes pendientes, facturas, pagos.
   */
  function renderContabilidadModule() {
    const appEl = document.getElementById('app');
    let html = '<h2>Módulo de contabilidad</h2>';
    const pendientes = appData.solicitudes.filter(pr => pr.estado === 'ordenCompraGenerada');
    html += '<h3>Solicitudes pendientes de aprobación presupuestaria</h3>';
    if (pendientes.length === 0) {
      html += '<p>No hay solicitudes pendientes.</p>';
    } else {
      html += '<ul>';
      pendientes.forEach(pr => {
        html += `<li>${pr.id} - ${pr.descripcion} (<a href="#" data-pr="${pr.id}">ver</a>)</li>`;
      });
      html += '</ul>';
    }
    const facturas = appData.facturas;
    html += '<h3>Facturas</h3>';
    if (facturas.length === 0) {
      html += '<p>No hay facturas registradas.</p>';
    } else {
      html += '<table class="table"><thead><tr><th>ID</th><th>PO</th><th>Proveedor</th><th>Monto</th><th>Estado</th></tr></thead><tbody>';
      facturas.forEach(inv => {
        const prov = getSupplierById(inv.proveedorId);
        html += `<tr><td>${inv.id}</td><td>${inv.poId}</td><td>${prov ? prov.nombre : inv.proveedorId}</td><td>${formatCurrency(inv.monto)}</td><td>${inv.estado}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    const pagos = appData.pagos;
    html += '<h3>Pagos</h3>';
    if (pagos.length === 0) {
      html += '<p>No hay pagos registrados.</p>';
    } else {
      html += '<table class="table"><thead><tr><th>ID</th><th>Factura</th><th>Monto</th><th>Método</th><th>Fecha de pago</th></tr></thead><tbody>';
      pagos.forEach(p => {
        html += `<tr><td>${p.id}</td><td>${p.facturaId}</td><td>${formatCurrency(p.monto)}</td><td>${p.metodo}</td><td>${formatDate(p.fechaPago)}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    appEl.innerHTML = html;
    appEl.querySelectorAll('a[data-pr]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        viewSolicitudDetail(a.dataset.pr);
      });
    });
  }

  /**
   * Renderiza reportes (estado, área, proveedor, SLA básico).
   */
  function renderReportesModule() {
    const appEl = document.getElementById('app');
    let html = '<h2>Reportes</h2>';
    // Por estado
    const porEstado = {};
    appData.solicitudes.forEach(pr => {
      porEstado[pr.estado] = (porEstado[pr.estado] || 0) + 1;
    });
    html += '<h3>Solicitudes por estado</h3><ul>';
    Object.keys(porEstado).forEach(est => {
      html += `<li>${est}: ${porEstado[est]}</li>`;
    });
    html += '</ul>';
    // Por área
    const porArea = {};
    appData.solicitudes.forEach(pr => {
      porArea[pr.area] = (porArea[pr.area] || 0) + 1;
    });
    html += '<h3>Solicitudes por área</h3><ul>';
    Object.keys(porArea).forEach(area => {
      html += `<li>${area}: ${porArea[area]}</li>`;
    });
    html += '</ul>';
    // Por proveedor adjudicado
    const porProveedor = {};
    appData.solicitudes.forEach(pr => {
      if (pr.proveedorSeleccionadoId) {
        porProveedor[pr.proveedorSeleccionadoId] = (porProveedor[pr.proveedorSeleccionadoId] || 0) + 1;
      }
    });
    html += '<h3>Solicitudes adjudicadas por proveedor</h3>';
    if (Object.keys(porProveedor).length === 0) {
      html += '<p>No hay adjudicaciones.</p>';
    } else {
      html += '<ul>';
      Object.keys(porProveedor).forEach(pid => {
        const prov = getSupplierById(pid);
        html += `<li>${prov ? prov.nombre : pid}: ${porProveedor[pid]}</li>`;
      });
      html += '</ul>';
    }
    // SLA simple: no se implementa detallado (requiere auditoría)
    html += '<h3>SLA (tiempo en cada etapa)</h3>';
    html += '<p>Esta demo no calcula SLA detallado porque no registra el historial completo de eventos.</p>';
    appEl.innerHTML = html;
  }

  /**
   * Renderiza módulo admin: muestra matriz y presupuestos (solo lectura en esta versión).
   */
  function renderAdminModule() {
    const appEl = document.getElementById('app');
    let html = '<h2>Módulo de administración</h2>';
    html += '<h3>Matriz de aprobaciones por monto</h3>';
    html += '<table class="table"><thead><tr><th>Mínimo</th><th>Máximo</th><th>Roles</th></tr></thead><tbody>';
    appData.matrizAprobaciones.forEach(mat => {
      html += `<tr><td>${mat.min}</td><td>${mat.max === Infinity ? '∞' : mat.max}</td><td>${mat.roles.join(', ')}</td></tr>`;
    });
    html += '</tbody></table>';
    html += '<h3>Presupuestos</h3>';
    html += '<table class="table"><thead><tr><th>Área</th><th>Monto anual</th><th>Disponible</th></tr></thead><tbody>';
    appData.presupuestos.forEach(p => {
      html += `<tr><td>${p.area}</td><td>${formatCurrency(p.montoAnual)}</td><td>${formatCurrency(p.montoDisponible)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += '<p>Nota: esta versión demo no permite modificar la matriz ni presupuestos desde la interfaz. Ajustes deben realizarse directamente en el servidor.</p>';
    html += '<h3>Exportar e importar</h3>';
    html += '<p>Para exportar o importar datos, utiliza las herramientas disponibles en el backend.</p>';
    appEl.innerHTML = html;
  }

  /**
   * Inicializa la aplicación.
   */
  async function init() {
    await loadAppData();
    // Restaurar usuario si hay uno en localStorage
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      currentUser = getUserById(userId);
    }
    if (currentUser) {
      currentModule = 'dashboard';
      renderMenu();
      renderCurrentView();
    } else {
      renderMenu();
      renderLogin();
    }
  }
  window.addEventListener('load', init);
})();
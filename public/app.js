/**
 * ELECTRONICAT - DIRECCIÓN EJECUTIVA & RUDY GREYRAT (CEO)
 * Frontend Client Controller
 */

// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
const state = {
  data: null,
  currentUser: 'Ale',
  voiceEnabled: true,
  isRecording: false,
  recognition: null,
  activeFilterCategory: 'all',
  activeFilterPriority: 'all',
  searchQuery: ''
};

// ==========================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModals();
  initFilters();
  initChatbot();
  initVoiceRecognition();
  loadSystemData();

  // Escuchar cambio de usuario
  const userSelect = document.getElementById('user-select');
  if (userSelect) {
    userSelect.addEventListener('change', (e) => {
      state.currentUser = e.target.value;
      addSystemToast(`Usuario cambiado a ${state.currentUser}`);
    });
  }
});

// ==========================================
// NAVEGACIÓN ENTRE VISTAS
// ==========================================
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.view-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');

      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      tab.classList.add('active');
      const targetEl = document.getElementById(targetView);
      if (targetEl) targetEl.classList.add('active');

      // Si entra a gráficos o kanban, refrescar renders
      if (targetView === 'view-graficos' && state.data) {
        renderCharts(state.data);
      }
    });
  });

  // Botón directo desde resumen a kanban
  const btnGoKanban = document.getElementById('btn-go-kanban');
  if (btnGoKanban) {
    btnGoKanban.addEventListener('click', () => {
      const kanbanTab = document.querySelector('.nav-tab[data-view="view-kanban"]');
      if (kanbanTab) kanbanTab.click();
    });
  }
}

// ==========================================
// CARGA DE DATOS DEL SISTEMA (/api/status)
// ==========================================
async function loadSystemData() {
  try {
    const res = await fetch('/api/status');
    const result = await res.json();
    if (result.ok && result.data) {
      state.data = result.data;
      renderAll(state.data);
    }
  } catch (err) {
    console.error('Error cargando datos del sistema:', err);
  }
}

function renderAll(data) {
  renderResumen(data);
  renderKanban(data);
  renderCharts(data);
  renderAreaAudits(data);
  renderAnteproyectos(data);
}

// ==========================================
// RENDER: VISTA 1 - RESUMEN EJECUTIVO & KPIS
// ==========================================
function renderResumen(data) {
  const kpis = data.kpis || {};
  const jobs = data.jobs || [];

  // KPIs
  document.getElementById('kpi-active-jobs').textContent = kpis.activeJobs || jobs.filter(j => j.status !== 'completado').length;
  document.getElementById('kpi-pipeline').textContent = `$${(kpis.totalPipelineValue || 0).toLocaleString('es-AR')} ARS`;
  document.getElementById('kpi-bottleneck').textContent = kpis.criticalBottleneck || 'Ensamble de Tableros';
  document.getElementById('kpi-completion-rate').textContent = `${kpis.completionRate || 94}%`;

  // Banner
  document.getElementById('banner-speed-index').textContent = `${kpis.speedIndex || 88}%`;
  document.getElementById('banner-pipeline-val').textContent = `$${((kpis.totalPipelineValue || 3860000) / 1000000).toFixed(2)}M`;

  // Trabajos compactos prioritarios
  const summaryJobsList = document.getElementById('summary-jobs-list');
  summaryJobsList.innerHTML = '';
  const criticalJobs = jobs.filter(j => j.status !== 'completado').slice(0, 4);

  if (criticalJobs.length === 0) {
    summaryJobsList.innerHTML = '<p class="text-dim">No hay trabajos en curso actualmente.</p>';
  } else {
    criticalJobs.forEach(job => {
      const item = document.createElement('div');
      item.className = 'job-compact-item';
      item.innerHTML = `
        <div class="job-compact-top">
          <div>
            <div class="job-compact-title">${escapeHTML(job.title)}</div>
            <div class="job-compact-client">${escapeHTML(job.client)} &bull; ${escapeHTML(job.category)}</div>
          </div>
          <span class="priority-badge ${job.priority}">${job.priority}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
        </div>
        <div class="job-compact-bottom">
          <span>Avance: <strong>${job.progress || 0}%</strong></span>
          <span>$${Number(job.budget || 0).toLocaleString('es-AR')} ARS</span>
          <span>Asignado: <strong>${job.assignedAgent.replace('ag_', '')}</strong></span>
        </div>
      `;
      summaryJobsList.appendChild(item);
    });
  }

  // Directivas del CEO
  const directivesList = document.getElementById('summary-directives-list');
  directivesList.innerHTML = '';
  const directives = data.recentDirectives || [];

  if (directives.length === 0) {
    directivesList.innerHTML = '<p class="text-dim">Sin directivas emitidas hoy.</p>';
  } else {
    directives.slice(0, 3).forEach(dir => {
      const item = document.createElement('div');
      item.className = 'directive-item';
      item.innerHTML = `
        <div class="dir-meta">
          <span class="dir-target">➔ Destino: ${escapeHTML(dir.targetAgent.replace('ag_', '').toUpperCase())}</span>
          <span>${dir.date ? new Date(dir.date).toLocaleDateString('es-AR') : 'Reciente'}</span>
        </div>
        <div class="dir-text">${escapeHTML(dir.directive)}</div>
      `;
      directivesList.appendChild(item);
    });
  }

  // Semáforo de departamentos
  const radarContainer = document.getElementById('summary-radar-badges');
  radarContainer.innerHTML = '';
  (data.areaAudits || []).slice(0, 6).forEach(area => {
    const isOptimal = area.health === 'optimal';
    const badge = document.createElement('div');
    badge.className = `radar-badge ${isOptimal ? 'optimal' : 'warning'}`;
    badge.innerHTML = `
      <span>${escapeHTML(area.name.split('&')[0].trim())}</span>
      <span class="radar-status-dot ${isOptimal ? 'green' : 'yellow'}"></span>
    `;
    radarContainer.appendChild(badge);
  });
}

// ==========================================
// RENDER: VISTA 2 - COMANDO DE TRABAJOS (KANBAN)
// ==========================================
function renderKanban(data) {
  const jobs = data.jobs || [];
  const cols = {
    cola: document.getElementById('kanban-cards-cola'),
    en_progreso: document.getElementById('kanban-cards-en_progreso'),
    bloqueado: document.getElementById('kanban-cards-bloqueado'),
    completado: document.getElementById('kanban-cards-completado')
  };

  // Contadores
  const counts = { cola: 0, en_progreso: 0, bloqueado: 0, completado: 0 };

  // Limpiar columnas
  Object.values(cols).forEach(col => { if (col) col.innerHTML = ''; });

  // Filtrado
  const filteredJobs = jobs.filter(j => {
    // Filtro categoría
    if (state.activeFilterCategory !== 'all' && j.category !== state.activeFilterCategory) {
      return false;
    }
    // Filtro prioridad
    if (state.activeFilterPriority !== 'all' && j.priority !== state.activeFilterPriority) {
      return false;
    }
    // Filtro búsqueda
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const match = (j.title || '').toLowerCase().includes(q) ||
                    (j.client || '').toLowerCase().includes(q) ||
                    (j.assignedAgent || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  filteredJobs.forEach(job => {
    const status = job.status || 'cola';
    if (counts[status] !== undefined) counts[status]++;

    const targetCol = cols[status] || cols.cola;
    const card = createKanbanCard(job);
    targetCol.appendChild(card);
  });

  // Actualizar badges
  document.getElementById('count-cola').textContent = counts.cola;
  document.getElementById('count-en_progreso').textContent = counts.en_progreso;
  document.getElementById('count-bloqueado').textContent = counts.bloqueado;
  document.getElementById('count-completado').textContent = counts.completado;
}

function createKanbanCard(job) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.setAttribute('data-id', job.id);

  // Render checklist
  let checklistHtml = '';
  if (job.checklist && job.checklist.length > 0) {
    const items = job.checklist.slice(0, 3).map(chk => `
      <div class="checklist-item ${chk.done ? 'done' : ''}" data-chk-id="${chk.id || ''}">
        <input type="checkbox" ${chk.done ? 'checked' : ''} onchange="toggleChecklist('${job.id}', '${chk.id}')">
        <span>${escapeHTML(chk.task)}</span>
      </div>
    `).join('');
    checklistHtml = `<div class="card-checklist">${items}</div>`;
  }

  card.innerHTML = `
    <div class="card-tag-row">
      <span class="category-tag">${escapeHTML(job.category)}</span>
      <span class="priority-badge ${job.priority}">${job.priority}</span>
    </div>
    <div class="card-title">${escapeHTML(job.title)}</div>
    <div class="card-client">👤 ${escapeHTML(job.client)}</div>
    <div class="card-budget-row">
      <span class="budget-val">$${Number(job.budget || 0).toLocaleString('es-AR')} ARS</span>
      <span>${job.progress || 0}% avance</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
    </div>
    ${checklistHtml}
    <div class="card-agent-row">
      <span>Resp: <strong class="agent-pill">${job.assignedAgent.replace('ag_', '').toUpperCase()}</strong></span>
      <span>📅 ${job.deadline || 'S/D'}</span>
    </div>
    <div class="card-actions-row">
      ${job.status !== 'en_progreso' ? `<button class="btn-card-act" onclick="updateJobStatus('${job.id}', 'en_progreso')">⚡ Taller</button>` : ''}
      ${job.status !== 'bloqueado' ? `<button class="btn-card-act" onclick="updateJobStatus('${job.id}', 'bloqueado')">🛑 Bloquear</button>` : ''}
      ${job.status !== 'completado' ? `<button class="btn-card-act" onclick="updateJobStatus('${job.id}', 'completado')">✓ Listo</button>` : ''}
      <button class="btn-card-act danger" onclick="deleteJob('${job.id}')" title="Eliminar trabajo">🗑️</button>
    </div>
  `;

  return card;
}

// Acciones de Trabajos
async function updateJobStatus(jobId, newStatus) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (result.ok) {
      addSystemToast(`Trabajo movido a ${newStatus}`);
      loadSystemData();
    }
  } catch (err) {
    console.error('Error actualizando trabajo:', err);
  }
}

async function toggleChecklist(jobId, chkId) {
  if (!state.data) return;
  const job = state.data.jobs.find(j => j.id === jobId);
  if (!job || !job.checklist) return;

  const item = job.checklist.find(c => c.id === chkId);
  if (item) {
    item.done = !item.done;
    const completedCount = job.checklist.filter(c => c.done).length;
    const newProgress = Math.round((completedCount / job.checklist.length) * 100);

    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: job.checklist, progress: newProgress })
      });
      loadSystemData();
    } catch (e) {
      console.error(e);
    }
  }
}

async function deleteJob(jobId) {
  if (!confirm('¿Estás seguro de eliminar este trabajo de producción?')) return;
  try {
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.ok) {
      addSystemToast('Trabajo eliminado');
      loadSystemData();
    }
  } catch (err) {
    console.error('Error eliminando trabajo:', err);
  }
}

// Filtros Kanban
function initFilters() {
  const searchInput = document.getElementById('kanban-search');
  const catFilter = document.getElementById('filter-category');
  const prioFilter = document.getElementById('filter-priority');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (state.data) renderKanban(state.data);
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      state.activeFilterCategory = e.target.value;
      if (state.data) renderKanban(state.data);
    });
  }

  if (prioFilter) {
    prioFilter.addEventListener('change', (e) => {
      state.activeFilterPriority = e.target.value;
      if (state.data) renderKanban(state.data);
    });
  }
}

// ==========================================
// RENDER: VISTA 3 - GRÁFICOS & MÉTRICAS
// ==========================================
function renderCharts(data) {
  const jobs = data.jobs || [];

  // 1. Gráfico de Carga por Área (Bar Chart)
  const areaTotals = {};
  jobs.forEach(j => {
    const cat = j.category || 'Otros';
    areaTotals[cat] = (areaTotals[cat] || 0) + (Number(j.budget) || 1);
  });

  const maxVal = Math.max(...Object.values(areaTotals), 1);
  const barsContainer = document.getElementById('chart-area-bars');
  barsContainer.innerHTML = '';

  Object.entries(areaTotals).forEach(([area, val]) => {
    const pct = Math.round((val / maxVal) * 100);
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-label" title="${escapeHTML(area)}">${escapeHTML(area)}</div>
      <div class="bar-outer">
        <div class="bar-inner" style="width: ${pct}%"></div>
      </div>
      <div class="bar-value">$${(val / 1000).toFixed(0)}k</div>
    `;
    barsContainer.appendChild(row);
  });

  // 2. Gráfico Donut de Prioridades (SVG interactivo)
  const prioCounts = { critica: 0, alta: 0, media: 0, baja: 0 };
  jobs.forEach(j => {
    if (prioCounts[j.priority] !== undefined) prioCounts[j.priority]++;
  });

  const totalPrio = jobs.length || 1;
  const pCrit = (prioCounts.critica / totalPrio) * 100;
  const pAlta = (prioCounts.alta / totalPrio) * 100;
  const pMed = (prioCounts.media / totalPrio) * 100;
  const pBaja = (prioCounts.baja / totalPrio) * 100;

  const donutContainer = document.getElementById('donut-priority-chart');
  donutContainer.innerHTML = `
    <svg viewBox="0 0 36 36" class="donut-svg" style="transform: rotate(-90deg); width: 100%; height: 100%;">
      <circle cx="18" cy="18" r="14" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="5"></circle>
      <!-- Crítica (Rose) -->
      <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f43f5e" stroke-width="5"
        stroke-dasharray="${pCrit} ${100 - pCrit}" stroke-dashoffset="0"></circle>
      <!-- Alta (Gold) -->
      <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f59e0b" stroke-width="5"
        stroke-dasharray="${pAlta} ${100 - pAlta}" stroke-dashoffset="-${pCrit}"></circle>
      <!-- Media (Cyan) -->
      <circle cx="18" cy="18" r="14" fill="transparent" stroke="#06b6d4" stroke-width="5"
        stroke-dasharray="${pMed} ${100 - pMed}" stroke-dashoffset="-${pCrit + pAlta}"></circle>
    </svg>
  `;

  const legendContainer = document.getElementById('donut-priority-legend');
  legendContainer.innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="background: #f43f5e;"></span> Crítica (${prioCounts.critica})</div>
    <div class="legend-item"><span class="legend-dot" style="background: #f59e0b;"></span> Alta (${prioCounts.alta})</div>
    <div class="legend-item"><span class="legend-dot" style="background: #06b6d4;"></span> Media (${prioCounts.media})</div>
    <div class="legend-item"><span class="legend-dot" style="background: #64748b;"></span> Baja (${prioCounts.baja})</div>
  `;

  // 3. Roadmap Hitos Serie 10 Tableros FIBA
  const roadmapContainer = document.getElementById('roadmap-timeline-container');
  const milestones = [
    { step: '01', title: 'Diseño CAD & Corte Láser', desc: 'Matrices estandarizadas en chapa plegada.', status: 'completed' },
    { step: '02', title: 'PCB Modular de Dígitos', desc: 'Placas SMD unificadas con LEDs de alta luminosidad.', status: 'completed' },
    { step: '03', title: 'Firmware ESP32 + RF', desc: 'Pruebas de latencia cero en Montmartre.', status: 'active' },
    { step: '04', title: 'Preventa Regional & Entrega', desc: '10 unidades distribuidas en clubes del NOA.', status: 'pending' }
  ];

  roadmapContainer.innerHTML = milestones.map(m => `
    <div class="roadmap-step ${m.status}">
      <div class="step-num">FASE ${m.step}</div>
      <div class="step-title">${m.title}</div>
      <div class="step-desc">${m.desc}</div>
    </div>
  `).join('');
}

// ==========================================
// RENDER: VISTA 4 - SUGERENCIAS POR ÁREA
// ==========================================
function renderAreaAudits(data) {
  const container = document.getElementById('area-audits-container');
  container.innerHTML = '';
  const audits = data.areaAudits || [];

  audits.forEach(area => {
    const card = document.createElement('div');
    card.className = 'area-audit-card';
    const isOptimal = area.health === 'optimal';

    card.innerHTML = `
      <div>
        <div class="area-card-top">
          <div>
            <h3 class="area-card-name">${escapeHTML(area.name)}</h3>
            <span class="area-card-lead">Líder: ${escapeHTML(area.leadAgent)}</span>
          </div>
          <span class="area-score-badge ${isOptimal ? 'optimal' : 'warning'}">${area.score}/100</span>
        </div>

        <div class="area-bottleneck-box">
          <div class="bottleneck-lbl">Cuello de Botella Detectado:</div>
          <div class="bottleneck-txt">${escapeHTML(area.bottleneck)}</div>
        </div>

        <div class="area-advice-box">
          <div class="advice-lbl">💡 Consejo del CEO Rudy (TOC / Lean):</div>
          <p class="advice-txt">${escapeHTML(area.ceoAdvice)}</p>
          <span class="action-plan-pill">🎯 Plan Inmediato: ${escapeHTML(area.actionPlan)}</span>
        </div>
      </div>

      <div class="area-card-bottom">
        <button class="btn-audit-live" onclick="requestAreaAudit('${area.id}', this)">
          <span>🔍</span> Auditar con Rudy IA
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function requestAreaAudit(areaId, btn) {
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Analizando...';

  try {
    const res = await fetch('/api/audit-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId })
    });
    const result = await res.json();
    if (result.ok) {
      addSystemToast('Auditoría estratégica actualizada por Rudy');
      loadSystemData();
    }
  } catch (err) {
    console.error('Error al solicitar auditoría:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ==========================================
// RENDER: VISTA 5 - ANTEPROYECTOS (3 FASES)
// ==========================================
function renderAnteproyectos(data) {
  const ante = data.anteproyectos || {};

  // Fase 3 Hero
  const f3 = ante.fase3_proyecto_definitivo || {};
  const f3Container = document.getElementById('fase3-hero-container');
  f3Container.innerHTML = `
    <span class="fase-badge-hero">Fase 3 &bull; Proyecto Definitivo en Ejecución</span>
    <h2 class="fase3-title">${escapeHTML(f3.title || 'Tableros Deportivos FIBA 24s')}</h2>
    <div class="fase3-metrics-grid">
      <div class="fase3-metric">
        <div class="fase3-metric-val">${f3.investmentRequired || '$650.000'}</div>
        <div class="fase3-metric-lbl">Inversión en Insumos</div>
      </div>
      <div class="fase3-metric">
        <div class="fase3-metric-val">${f3.expectedGross || '$2.500.000'}</div>
        <div class="fase3-metric-lbl">Facturación Bruta</div>
      </div>
      <div class="fase3-metric">
        <div class="fase3-metric-val" style="color: #34d399;">${f3.expectedNet || '$1.550.000'}</div>
        <div class="fase3-metric-lbl">Ganancia Neta Estimada</div>
      </div>
      <div class="fase3-metric">
        <div class="fase3-metric-val" style="color: var(--cyan-light);">${f3.status || 'En Ejecución'}</div>
        <div class="fase3-metric-lbl">Estado Operativo</div>
      </div>
    </div>
    <div class="fase3-footer-note">
      🔑 <strong>Factor Clave de Éxito:</strong> ${escapeHTML(f3.keySuccessFactor || '')}
    </div>
  `;

  // Fase 2 Cards
  const f2List = ante.fase2_anteproyectos || [];
  const f2Container = document.getElementById('fase2-anteproyectos-container');
  f2Container.innerHTML = f2List.map(a => `
    <div class="anteproyecto-card">
      <div class="ante-card-title">${escapeHTML(a.title)}</div>
      <div class="ante-card-gateway">💳 Pasarela: ${escapeHTML(a.paymentGateway)}</div>
      <div class="ante-metrics-row">
        <span>Margen: <strong style="color: #34d399;">${a.profitMargin}</strong></span>
        <span>Plazo: <strong>${a.leadTime}</strong></span>
        <span>${a.unitPrice ? `Precio: <strong>${a.unitPrice}</strong>` : `Abono: <strong>${a.monthlyFee}</strong>`}</span>
      </div>
      <ul class="ante-milestones-list">
        ${(a.milestones || []).map(m => `<li>${escapeHTML(m)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  // Fase 1 Ideas Table
  const f1List = ante.fase1_ideas || [];
  const f1Body = document.getElementById('ideas-table-body');
  f1Body.innerHTML = f1List.map(idea => `
    <tr>
      <td><strong>${escapeHTML(idea.title)}</strong><br><small style="color: var(--text-dim);">${escapeHTML(idea.desc)}</small></td>
      <td><span class="category-tag">${escapeHTML(idea.category)}</span></td>
      <td><strong style="color: var(--gold-light);">${idea.score}/10</strong></td>
      <td>${escapeHTML(idea.estimatedRevenue)}</td>
      <td>${idea.selected ? '<span style="color: #34d399; font-weight: 700;">✓ Seleccionada Fase 2</span>' : '<span style="color: var(--text-dim);">En Evaluación</span>'}</td>
    </tr>
  `).join('');
}

// ==========================================
// MODALES & FORMULARIOS
// ==========================================
function initModals() {
  // Modal Nuevo Trabajo
  const modalJob = document.getElementById('modal-job');
  const btnOpenJob = document.getElementById('btn-open-modal-job');
  const btnKanbanNew = document.getElementById('btn-kanban-new-job');
  const btnCloseJob = document.getElementById('btn-close-modal-job');
  const btnCancelJob = document.getElementById('btn-cancel-job');
  const formJob = document.getElementById('form-new-job');

  const openJobModal = () => { modalJob.style.display = 'flex'; };
  const closeJobModal = () => { modalJob.style.display = 'none'; };

  if (btnOpenJob) btnOpenJob.addEventListener('click', openJobModal);
  if (btnKanbanNew) btnKanbanNew.addEventListener('click', openJobModal);
  if (btnCloseJob) btnCloseJob.addEventListener('click', closeJobModal);
  if (btnCancelJob) btnCancelJob.addEventListener('click', closeJobModal);

  if (formJob) {
    formJob.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('job-title').value,
        client: document.getElementById('job-client').value,
        category: document.getElementById('job-category').value,
        assignedAgent: document.getElementById('job-agent').value,
        priority: document.getElementById('job-priority').value,
        budget: document.getElementById('job-budget').value,
        deadline: document.getElementById('job-deadline').value,
        notes: document.getElementById('job-notes').value
      };

      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.ok) {
          addSystemToast('¡Nuevo trabajo creado exitosamente!');
          formJob.reset();
          closeJobModal();
          loadSystemData();
        }
      } catch (err) {
        console.error('Error creando trabajo:', err);
      }
    });
  }

  // Modal Nueva Idea Anteproyecto
  const modalAnte = document.getElementById('modal-anteproyecto');
  const btnOpenAnte = document.getElementById('btn-open-modal-anteproyecto');
  const btnAddIdea = document.getElementById('btn-add-idea-modal');
  const btnCloseAnte = document.getElementById('btn-close-modal-anteproyecto');
  const btnCancelAnte = document.getElementById('btn-cancel-anteproyecto');
  const formAnte = document.getElementById('form-new-anteproyecto');

  const openAnteModal = () => { modalAnte.style.display = 'flex'; };
  const closeAnteModal = () => { modalAnte.style.display = 'none'; };

  if (btnOpenAnte) btnOpenAnte.addEventListener('click', openAnteModal);
  if (btnAddIdea) btnAddIdea.addEventListener('click', openAnteModal);
  if (btnCloseAnte) btnCloseAnte.addEventListener('click', closeAnteModal);
  if (btnCancelAnte) btnCancelAnte.addEventListener('click', closeAnteModal);

  if (formAnte) {
    formAnte.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('ante-title').value,
        category: document.getElementById('ante-category').value,
        estimatedRevenue: document.getElementById('ante-revenue').value,
        desc: document.getElementById('ante-desc').value
      };

      try {
        const res = await fetch('/api/anteproyectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.ok) {
          addSystemToast('Idea estratégica registrada en Fase 1');
          formAnte.reset();
          closeAnteModal();
          loadSystemData();
        }
      } catch (err) {
        console.error('Error creando idea:', err);
      }
    });
  }

  // Modal Emitir Directiva
  const modalDir = document.getElementById('modal-directive');
  const btnOpenDir = document.getElementById('btn-open-modal-directive');
  const btnCloseDir = document.getElementById('btn-close-modal-directive');
  const btnCancelDir = document.getElementById('btn-cancel-directive');
  const formDir = document.getElementById('form-new-directive');

  const openDirModal = () => { modalDir.style.display = 'flex'; };
  const closeDirModal = () => { modalDir.style.display = 'none'; };

  if (btnOpenDir) btnOpenDir.addEventListener('click', openDirModal);
  if (btnCloseDir) btnCloseDir.addEventListener('click', closeDirModal);
  if (btnCancelDir) btnCancelDir.addEventListener('click', closeDirModal);

  if (formDir) {
    formDir.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetAgent = document.getElementById('dir-agent').value;
      const directiveText = document.getElementById('dir-text').value;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Rudy, emití esta directiva formal a ${targetAgent}: "${directiveText}"`,
            userName: state.currentUser
          })
        });
        const result = await res.json();
        if (result.ok) {
          addSystemToast('Directiva emitida correctamente');
          formDir.reset();
          closeDirModal();
          loadSystemData();
        }
      } catch (err) {
        console.error('Error emitiendo directiva:', err);
      }
    });
  }
}

// ==========================================
// CHATBOT FLOTANTE ESTILO MESSENGER (RUDY CEO)
// ==========================================
function initChatbot() {
  const bubbleBtn = document.getElementById('rudy-bubble-btn');
  const chatWin = document.getElementById('rudy-chat-window');
  const btnClose = document.getElementById('btn-close-chat');
  const btnMin = document.getElementById('btn-minimize-chat');
  const btnClear = document.getElementById('btn-clear-chat');
  const btnToggleVoice = document.getElementById('btn-toggle-voice');
  const voiceIcon = document.getElementById('voice-icon');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatThread = document.getElementById('chat-thread');
  const previewToast = document.getElementById('rudy-preview-toast');
  const btnCloseToast = document.getElementById('btn-close-toast');

  // Toggle Ventana
  const toggleChat = () => {
    const isHidden = chatWin.style.display === 'none' || !chatWin.style.display;
    chatWin.style.display = isHidden ? 'flex' : 'none';
    if (previewToast) previewToast.style.display = 'none';
    if (isHidden) {
      chatInput.focus();
      scrollChatToBottom();
      document.getElementById('rudy-unread-badge').style.display = 'none';
    }
  };

  if (bubbleBtn) bubbleBtn.addEventListener('click', toggleChat);
  if (btnClose) btnClose.addEventListener('click', () => { chatWin.style.display = 'none'; });
  if (btnMin) btnMin.addEventListener('click', () => { chatWin.style.display = 'none'; });
  if (btnCloseToast) btnCloseToast.addEventListener('click', () => { previewToast.style.display = 'none'; });

  // Voz Toggle
  if (btnToggleVoice) {
    btnToggleVoice.addEventListener('click', () => {
      state.voiceEnabled = !state.voiceEnabled;
      voiceIcon.textContent = state.voiceEnabled ? '🔊' : '🔇';
      addSystemToast(state.voiceEnabled ? 'Voz activada' : 'Voz silenciada');
    });
  }

  // Limpiar Chat
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (!confirm('¿Deseas limpiar el historial de la conversación con Rudy?')) return;
      try {
        await fetch('/api/chat-history', { method: 'DELETE' });
        chatThread.innerHTML = `
          <div class="welcome-box">
            <p>Historial reiniciado. Soy Rudeus (Rudy) Greyrat. Contame cualquier idea o prioridad operativa para el taller.</p>
          </div>
        `;
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Chips Rápidos
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('win-chip')) {
      const prompt = e.target.getAttribute('data-prompt');
      if (prompt) {
        chatInput.value = prompt;
        chatForm.dispatchEvent(new Event('submit'));
      }
    }
  });

  // Ajuste automático de textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
  });

  // Enviar con Enter (sin Shift)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Enviar Mensaje
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Agregar mensaje del usuario en pantalla
    const timeNow = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    appendMessageToThread({
      sender: state.currentUser,
      text,
      type: 'user',
      time: timeNow
    });

    // Indicador de escritura
    const typingIndicator = showTypingIndicator();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userName: state.currentUser })
      });
      const data = await res.json();
      removeTypingIndicator(typingIndicator);

      if (data.ok) {
        appendMessageToThread({
          sender: 'Rudy Greyrat (CEO)',
          text: data.reply,
          type: 'agent',
          time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          executedActions: data.executedActions
        });

        // Síntesis de voz
        if (state.voiceEnabled) {
          speakText(data.reply);
        }

        // Si se ejecutaron acciones, refrescar datos
        if (data.executedActions && data.executedActions.length > 0) {
          addSystemToast(`Acciones aplicadas: ${data.executedActions.join(', ')}`);
          loadSystemData();
        }
      }
    } catch (err) {
      removeTypingIndicator(typingIndicator);
      appendMessageToThread({
        sender: 'Sistema',
        text: 'Error comunicando con Rudy. Verifica la conexión del servidor.',
        type: 'agent',
        time: timeNow
      });
    }
  });

  // Cargar historial previo
  loadChatHistory();
}

async function loadChatHistory() {
  try {
    const res = await fetch('/api/chat-history');
    const result = await res.json();
    if (result.ok && result.history && result.history.length > 0) {
      result.history.forEach(msg => appendMessageToThread(msg, false));
      scrollChatToBottom();
    }
  } catch (e) {
    console.warn('Error cargando historial:', e);
  }
}

function appendMessageToThread(msg, scroll = true) {
  const chatThread = document.getElementById('chat-thread');
  const wrap = document.createElement('div');
  wrap.className = `msg-bubble-wrap ${msg.type}`;

  let actionsHtml = '';
  if (msg.executedActions && msg.executedActions.length > 0) {
    actionsHtml = `<div class="msg-action-badge">⚡ ${msg.executedActions.map(escapeHTML).join('<br>⚡ ')}</div>`;
  }

  wrap.innerHTML = `
    <div class="msg-bubble">${escapeHTML(msg.text)}</div>
    ${actionsHtml}
    <span class="msg-time">${escapeHTML(msg.sender || '')} &bull; ${msg.time || ''}</span>
  `;

  chatThread.appendChild(wrap);
  if (scroll) scrollChatToBottom();
}

function showTypingIndicator() {
  const chatThread = document.getElementById('chat-thread');
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  chatThread.appendChild(indicator);
  scrollChatToBottom();
  return indicator;
}

function removeTypingIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

function scrollChatToBottom() {
  const chatThread = document.getElementById('chat-thread');
  chatThread.scrollTop = chatThread.scrollHeight;
}

// ==========================================
// RECONOCIMIENTO & SÍNTESIS DE VOZ
// ==========================================
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btnMic = document.getElementById('btn-mic');
  const chatInput = document.getElementById('chat-input');

  if (!SpeechRecognition) {
    if (btnMic) btnMic.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-AR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.isRecording = true;
    btnMic.classList.add('listening');
  };

  recognition.onend = () => {
    state.isRecording = false;
    btnMic.classList.remove('listening');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') + transcript;
      chatInput.focus();
    }
  };

  btnMic.addEventListener('click', () => {
    if (state.isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  // Limpiar texto de caracteres especiales para lectura
  const clean = text.replace(/[*_#`~]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'es-AR';
  utterance.rate = 1.05;
  utterance.pitch = 0.95;

  const voices = window.speechSynthesis.getVoices();
  const maleSpanish = voices.find(v => v.lang.includes('es') && (v.name.includes('Male') || v.name.includes('Jorge') || v.name.includes('Diego') || v.name.includes('Pablo')));
  if (maleSpanish) utterance.voice = maleSpanish;

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// TOASTS DE NOTIFICACIÓN
// ==========================================
function addSystemToast(msg) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.top = '75px';
  toast.style.right = '28px';
  toast.style.background = 'rgba(13, 19, 31, 0.95)';
  toast.style.border = '1px solid var(--gold)';
  toast.style.color = '#fff';
  toast.style.padding = '10px 18px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '0.82rem';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
  toast.style.zIndex = '9999';
  toast.style.transition = 'all 0.3s ease';
  toast.textContent = msg;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3200);
}

// Helper XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
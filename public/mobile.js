/**
 * RUDY CEO MÓVIL - CONTROLLER
 */
const API_BASE = window.location.pathname.startsWith('/rudy') ? '/rudy/api' : '/api';

const mState = {
  data: null,
  user: 'Ale',
  jobFilter: 'all',
  voiceEnabled: true,
  isRecording: false
};

document.addEventListener('DOMContentLoaded', () => {
  initMobTabs();
  initMobModals();
  initMobChat();
  initMobMic();
  loadMobData();

  const userSel = document.getElementById('mob-user-select');
  if (userSel) {
    userSel.addEventListener('change', (e) => {
      mState.user = e.target.value;
      showMobToast(`Sesión activa: ${mState.user}`);
    });
  }

  // Filtros de trabajos
  const filterStrip = document.getElementById('mob-job-filters');
  if (filterStrip) {
    filterStrip.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-chip')) {
        filterStrip.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        mState.jobFilter = e.target.getAttribute('data-status');
        if (mState.data) renderMobJobs(mState.data);
      }
    });
  }
});

// Navegación Inferior
function initMobTabs() {
  const btns = document.querySelectorAll('.mob-bottom-nav .nav-btn');
  const views = document.querySelectorAll('.mob-view');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      btns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const el = document.getElementById(target);
      if (el) el.classList.add('active');

      if (target === 'tab-chat') {
        scrollMobChat();
      }
    });
  });
}

// Cargar Datos
async function loadMobData() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    const result = await res.json();
    if (result.ok && result.data) {
      mState.data = result.data;
      renderMobAll(mState.data);
    }
  } catch (err) {
    console.error('Error cargando estado móvil:', err);
  }
}

function renderMobAll(data) {
  renderMobHoy(data);
  renderMobJobs(data);
  renderMobOpsp(data);
  renderMobAreas(data);
}

// TAB 1: HOY
function renderMobHoy(data) {
  const kpis = data.kpis || {};
  const jobs = data.jobs || [];

  document.getElementById('mob-bottleneck-text').textContent = kpis.criticalBottleneck || 'Sin cuellos de botella críticos.';
  document.getElementById('mob-kpi-active').textContent = kpis.activeJobs ?? jobs.filter(j => j.status !== 'completado').length;
  document.getElementById('mob-kpi-pipeline').textContent = `$${((kpis.totalPipelineValue || 0) / 1000000).toFixed(2)}M`;
  document.getElementById('mob-kpi-rate').textContent = `${kpis.completionRate || 92}%`;
  document.getElementById('mob-kpi-speed').textContent = `${kpis.speedIndex || 88}%`;

  // Directivas
  const dirList = document.getElementById('mob-directives-list');
  dirList.innerHTML = (data.recentDirectives || []).slice(0, 3).map(d => `
    <div class="mob-dir-card">
      <div class="dir-head">
        <span>➔ ${esc(d.targetAgent.replace('ag_', '').toUpperCase())}</span>
        <span>${d.date ? new Date(d.date).toLocaleDateString('es-AR') : ''}</span>
      </div>
      <div class="dir-body">${esc(d.directive)}</div>
    </div>
  `).join('') || '<p style="color:var(--dim);font-size:0.8rem;">Sin directivas recientes.</p>';

  // Radar
  const radarList = document.getElementById('mob-radar-list');
  radarList.innerHTML = (data.areaAudits || []).map(a => {
    const ok = a.health === 'optimal';
    return `
      <div class="mob-radar-pill">
        <span>${esc(a.name.split('&')[0].trim())}</span>
        <span class="dot-status ${ok ? 'green' : 'yellow'}"></span>
      </div>
    `;
  }).join('');
}

// TAB 2: TRABAJOS
function renderMobJobs(data) {
  const container = document.getElementById('mob-jobs-container');
  const jobs = (data.jobs || []).filter(j => mState.jobFilter === 'all' || j.status === mState.jobFilter);

  if (jobs.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--dim);margin-top:20px;">No hay trabajos en esta categoría.</p>';
    return;
  }

  container.innerHTML = jobs.map(job => {
    const chks = (job.checklist || []).map(c => `
      <label class="mob-chk-item ${c.done ? 'done' : ''}">
        <input type="checkbox" ${c.done ? 'checked' : ''} onchange="mobToggleChk('${job.id}', '${c.id}')">
        <span>${esc(c.task)}</span>
      </label>
    `).join('');

    return `
      <div class="mob-job-card">
        <div class="job-top-badges">
          <span class="job-cat">${esc(job.category)}</span>
          <span class="job-prio ${job.priority}">${job.priority}</span>
        </div>
        <div class="mob-job-title">${esc(job.title)}</div>
        <div class="mob-job-meta">👤 ${esc(job.client)} &bull; $${Number(job.budget || 0).toLocaleString('es-AR')} &bull; <strong>${job.assignedAgent.replace('ag_', '').toUpperCase()}</strong></div>
        <div class="mob-prog-bar"><div class="mob-prog-fill" style="width:${job.progress || 0}%"></div></div>
        ${chks ? `<div class="mob-checklist">${chks}</div>` : ''}
        <div class="mob-job-actions">
          <button class="mob-act-btn ${job.status === 'en_progreso' ? 'active-state' : ''}" onclick="mobSetStatus('${job.id}', 'en_progreso')">⚡ Taller</button>
          <button class="mob-act-btn ${job.status === 'bloqueado' ? 'active-state' : ''}" onclick="mobSetStatus('${job.id}', 'bloqueado')">🛑 Bloqueo</button>
          <button class="mob-act-btn ${job.status === 'completado' ? 'active-state' : ''}" onclick="mobSetStatus('${job.id}', 'completado')">✓ Listo</button>
        </div>
      </div>
    `;
  }).join('');
}

async function mobSetStatus(jobId, status) {
  try {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const r = await res.json();
    if (r.ok) {
      showMobToast(`Estado actualizado a ${status}`);
      loadMobData();
    }
  } catch (e) { console.error(e); }
}

async function mobToggleChk(jobId, chkId) {
  const job = (mState.data?.jobs || []).find(j => j.id === jobId);
  if (!job || !job.checklist) return;
  const item = job.checklist.find(c => c.id === chkId);
  if (!item) return;
  item.done = !item.done;
  const doneCount = job.checklist.filter(c => c.done).length;
  const progress = Math.round((doneCount / job.checklist.length) * 100);

  await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist: job.checklist, progress })
  });
  loadMobData();
}

// TAB 3: OPSP & HÁBITOS DE ROCKEFELLER
function renderMobOpsp(data) {
  const opsp = data.opsp || {};
  document.getElementById('mob-opsp-purpose').textContent = opsp.corePurpose || '';
  document.getElementById('mob-opsp-bhag').textContent = opsp.bhag || '';
  document.getElementById('mob-opsp-profit').textContent = opsp.profitPerX || '';

  const rocksList = document.getElementById('mob-rocks-list');
  rocksList.innerHTML = (opsp.quarterlyRocks || []).map(r => `
    <div class="rock-card">
      <div class="rock-top">
        <span>${esc(r.title)}</span>
        <span style="color:var(--gold-light);font-family:var(--mono);">${r.progress}%</span>
      </div>
      <div class="mob-prog-bar" style="margin-bottom:0;"><div class="mob-prog-fill" style="width:${r.progress}%"></div></div>
    </div>
  `).join('');

  const habits = data.rockefellerHabits || [];
  const doneHabits = habits.filter(h => h.done).length;
  document.getElementById('mob-habits-score').textContent = `${doneHabits}/${habits.length}`;

  const habitsList = document.getElementById('mob-habits-list');
  habitsList.innerHTML = habits.map(h => `
    <label class="habit-item ${h.done ? 'done' : ''}">
      <input type="checkbox" ${h.done ? 'checked' : ''} onchange="mobToggleHabit('${h.id}')">
      <span><strong>#${h.num}</strong> ${esc(h.title)}</span>
    </label>
  `).join('');
}

async function mobToggleHabit(habitId) {
  try {
    const res = await fetch(`${API_BASE}/habits/${habitId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const r = await res.json();
    if (r.ok) {
      loadMobData();
    }
  } catch (e) { console.error(e); }
}

// TAB 4: ÁREAS & GRÁFICOS
function renderMobAreas(data) {
  const jobs = data.jobs || [];
  const areaTotals = {};
  jobs.forEach(j => {
    const cat = j.category || 'Otros';
    areaTotals[cat] = (areaTotals[cat] || 0) + (Number(j.budget) || 1);
  });
  const maxVal = Math.max(...Object.values(areaTotals), 1);

  document.getElementById('mob-chart-bars').innerHTML = Object.entries(areaTotals).map(([area, val]) => {
    const pct = Math.round((val / maxVal) * 100);
    return `
      <div class="mob-bar-row">
        <div class="mob-bar-lbls">
          <span>${esc(area)}</span>
          <strong style="color:var(--gold-light);font-family:var(--mono);">$${(val/1000).toFixed(0)}k</strong>
        </div>
        <div class="mob-prog-bar" style="margin:0;"><div class="mob-prog-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');

  document.getElementById('mob-audits-list').innerHTML = (data.areaAudits || []).map(a => `
    <div class="mob-audit-card">
      <div class="audit-head">
        <strong>${esc(a.name)}</strong>
        <span class="audit-score">${a.score}/100</span>
      </div>
      <p class="audit-advice">💡 ${esc(a.ceoAdvice)}</p>
      <button class="btn-mob-audit" onclick="mobAuditArea('${a.id}', this)">🔍 Auditar con Rudy IA</button>
    </div>
  `).join('');

  const f3 = data.anteproyectos?.fase3_proyecto_definitivo || {};
  document.getElementById('mob-fase3-card').innerHTML = `
    <div class="panel-tag">FASE 3 &bull; PROYECTO DEFINITIVO</div>
    <h3 class="panel-h3">${esc(f3.title || '')}</h3>
    <p style="font-size:0.82rem;color:var(--muted);margin-bottom:8px;">Inversión: <strong>${f3.investmentRequired || '-'}</strong> &bull; Ganancia Neta: <strong style="color:var(--emerald);">${f3.expectedNet || '-'}</strong></p>
    <p style="font-size:0.78rem;color:var(--gold-light);">🔑 ${esc(f3.keySuccessFactor || '')}</p>
  `;
}

async function mobAuditArea(areaId, btn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Analizando...';
  try {
    const res = await fetch(`${API_BASE}/audit-area`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId })
    });
    const r = await res.json();
    if (r.ok) {
      showMobToast('Auditoría actualizada');
      loadMobData();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// MODALES MÓVIL
function initMobModals() {
  const mJob = document.getElementById('mob-modal-job');
  const mDir = document.getElementById('mob-modal-dir');

  document.getElementById('mob-btn-new-job').addEventListener('click', () => mJob.style.display = 'flex');
  document.getElementById('mob-close-job').addEventListener('click', () => mJob.style.display = 'none');
  document.getElementById('mob-btn-new-dir').addEventListener('click', () => mDir.style.display = 'flex');
  document.getElementById('mob-close-dir').addEventListener('click', () => mDir.style.display = 'none');

  document.getElementById('mob-form-job').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('m-job-title').value,
      client: document.getElementById('m-job-client').value,
      assignedAgent: document.getElementById('m-job-agent').value,
      priority: document.getElementById('m-job-priority').value,
      budget: document.getElementById('m-job-budget').value,
      notes: document.getElementById('m-job-notes').value
    };
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if ((await res.json()).ok) {
      showMobToast('Trabajo creado');
      e.target.reset();
      mJob.style.display = 'none';
      loadMobData();
    }
  });

  document.getElementById('mob-form-dir').addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = document.getElementById('m-dir-agent').value;
    const text = document.getElementById('m-dir-text').value;
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Rudy, emití esta directiva formal a ${target}: "${text}"`, userName: mState.user })
    });
    if ((await res.json()).ok) {
      showMobToast('Directiva emitida');
      e.target.reset();
      mDir.style.display = 'none';
      loadMobData();
    }
  });
}

// CHAT FULL SCREEN MÓVIL
function initMobChat() {
  const form = document.getElementById('mob-chat-form');
  const input = document.getElementById('mob-chat-input');
  const btnVoice = document.getElementById('mob-btn-voice');
  const btnClear = document.getElementById('mob-btn-clear');

  btnVoice.addEventListener('click', () => {
    mState.voiceEnabled = !mState.voiceEnabled;
    btnVoice.textContent = mState.voiceEnabled ? '🔊' : '🔇';
    showMobToast(mState.voiceEnabled ? 'Voz activada' : 'Voz silenciada');
  });

  btnClear.addEventListener('click', async () => {
    if (!confirm('¿Borrar historial del chat?')) return;
    await fetch(`${API_BASE}/chat-history`, { method: 'DELETE' });
    document.getElementById('mob-chat-thread').innerHTML = '<div class="mob-welcome-msg">Historial reiniciado. Contame tu idea.</div>';
  });

  document.querySelectorAll('.mob-chip').forEach(ch => {
    ch.addEventListener('click', () => {
      input.value = ch.getAttribute('data-prompt');
      input.focus();
    });
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;

    input.value = '';
    input.style.height = 'auto';
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    appendMobMsg({ sender: mState.user, text: txt, type: 'user', time });

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt, userName: mState.user })
      });
      const data = await res.json();
      if (data.ok) {
        appendMobMsg({
          sender: 'Rudy CEO',
          text: data.reply,
          type: 'agent',
          time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        });
        if (mState.voiceEnabled) speakMob(data.reply);
        if (data.executedActions && data.executedActions.length > 0) {
          showMobToast('Acción ejecutada en base de datos');
          loadMobData();
        }
      }
    } catch (err) {
      appendMobMsg({ sender: 'Sistema', text: 'Sin conexión al servidor.', type: 'agent', time });
    }
  });

  loadMobChatHistory();
}

async function loadMobChatHistory() {
  try {
    const res = await fetch(`${API_BASE}/chat-history`);
    const r = await res.json();
    if (r.ok && r.history) {
      r.history.forEach(m => appendMobMsg(m, false));
      scrollMobChat();
    }
  } catch (e) {}
}

function appendMobMsg(msg, scroll = true) {
  const thread = document.getElementById('mob-chat-thread');
  const wrap = document.createElement('div');
  wrap.className = `m-msg-wrap ${msg.type}`;
  wrap.innerHTML = `
    <div class="m-msg-bubble">${esc(msg.text).replace(/\n/g, '<br>')}</div>
    <span class="m-msg-time">${esc(msg.sender)} &bull; ${msg.time || ''}</span>
  `;
  thread.appendChild(wrap);
  if (scroll) scrollMobChat();
}

function scrollMobChat() {
  const t = document.getElementById('mob-chat-thread');
  if (t) t.scrollTop = t.scrollHeight;
}

// Micrófono Móvil
function initMobMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById('mob-btn-mic');
  const input = document.getElementById('mob-chat-input');
  if (!SR) { btn.style.display = 'none'; return; }

  const rec = new SR();
  rec.lang = 'es-AR';
  rec.onstart = () => { mState.isRecording = true; btn.classList.add('recording'); };
  rec.onend = () => { mState.isRecording = false; btn.classList.remove('recording'); };
  rec.onresult = (e) => {
    const txt = e.results[0][0].transcript;
    if (txt) input.value = (input.value ? input.value + ' ' : '') + txt;
  };

  btn.addEventListener('click', () => mState.isRecording ? rec.stop() : rec.start());
}

function speakMob(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#`~]/g, ''));
  u.lang = 'es-AR';
  window.speechSynthesis.speak(u);
}

function showMobToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:68px;left:50%;transform:translateX(-50%);background:#131c2e;border:1px solid #f59e0b;color:#fff;padding:8px 16px;border-radius:99px;font-size:0.78rem;z-index:999;box-shadow:0 4px 15px rgba(0,0,0,0.5);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
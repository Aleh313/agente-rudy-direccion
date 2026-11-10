const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno (soporta ejecución directa o desde raíz)
const rootEnv = path.join(__dirname, '..', '..', '.env');
const localEnv = path.join(__dirname, '.env');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT_RUDY || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de archivos de datos
const DB_PATH = path.join(__dirname, 'db.json');
const PROMPT_PATH = path.join(__dirname, 'PROMPT_ENTRENAMIENTO.md');
const MEMORIA_PATH = path.join(__dirname, 'memoria', 'MEMORIA_ACTIVIDAD.md');
const CHAT_HISTORY_PATH = path.join(__dirname, 'memoria', 'chat_history.json');
const ROOT_DB_PATH = path.join(__dirname, '..', '..', 'database.json');

// Cliente Gemini AI
let aiClient = null;
let geminiAvailable = false;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey.trim().length > 10) {
  try {
    const { GoogleGenAI } = require('@google/genai');
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    geminiAvailable = true;
    console.log('✨ [Rudy CEO AI] Conexión establecida con Gemini API.');
  } catch (err) {
    console.warn('⚠️ [Rudy CEO AI] Error inicializando Gemini:', err.message);
  }
}

// Helpers de lectura y escritura
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {
      _agent: "01_rudy_jefe",
      systemInfo: {},
      kpis: {},
      jobs: [],
      anteproyectos: {},
      areaAudits: [],
      recentDirectives: []
    };
  }
}

function saveDB(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function loadMemory() {
  try {
    return fs.readFileSync(MEMORIA_PATH, 'utf8');
  } catch (e) {
    return '';
  }
}

function appendMemory(note) {
  try {
    const time = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Catamarca' });
    const entry = `\n- **[${time}] Directiva CEO:** ${note}`;
    fs.appendFileSync(MEMORIA_PATH, entry, 'utf8');
  } catch (e) {
    console.error('Error guardando en memoria:', e);
  }
}

function loadPrompt() {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8');
  } catch (e) {
    return 'Sos Rudeus (Rudy) Greyrat, CEO y Estratega de Rescate de Electronicat en Catamarca.';
  }
}

// Historial persistente del Chatbot
function loadChatHistory() {
  try {
    if (fs.existsSync(CHAT_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('Error leyendo chat_history.json:', err.message);
  }
  return [];
}

function saveChatHistory(history) {
  try {
    fs.writeFileSync(CHAT_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.warn('Error guardando chat_history.json:', err.message);
  }
}

function appendToChatHistory(messageObj) {
  const history = loadChatHistory();
  history.push(messageObj);
  if (history.length > 150) history.splice(0, history.length - 150);
  saveChatHistory(history);
}

// Recalcular KPIs automáticamente
function recalculateKPIs(dbData) {
  dbData.jobs = dbData.jobs || [];
  const activeJobs = dbData.jobs.filter(j => j.status !== 'completado').length;
  const completedJobs = dbData.jobs.filter(j => j.status === 'completado').length;
  const totalPipelineValue = dbData.jobs
    .filter(j => j.status !== 'completado')
    .reduce((sum, j) => sum + (Number(j.budget) || 0), 0);
  
  const blockedJobs = dbData.jobs.filter(j => j.status === 'bloqueado');
  let criticalBottleneck = "Operación fluida sin cuellos de botella críticos.";
  if (blockedJobs.length > 0) {
    criticalBottleneck = `Bloqueo en: ${blockedJobs[0].title} (${blockedJobs[0].client})`;
  } else {
    const criticalJob = dbData.jobs.find(j => j.priority === 'critica' && j.status !== 'completado');
    if (criticalJob) {
      criticalBottleneck = `Enfocando recursos en: ${criticalJob.title}`;
    }
  }

  const completionRate = dbData.jobs.length > 0 
    ? Math.round((completedJobs / dbData.jobs.length) * 100) 
    : 100;

  dbData.kpis = {
    ...dbData.kpis,
    activeJobs,
    criticalBottleneck,
    totalPipelineValue,
    completionRate: Math.max(70, Math.min(100, completionRate || 92)),
    teamThroughput: (dbData.kpis?.teamThroughput || 10)
  };
}

// ==========================================
// RUTAS Y ENDPOINTS DE LA API
// ==========================================

// 1. Estado completo del sistema ejecutivo de Rudy
app.get('/api/status', (req, res) => {
  const dbData = loadDB();
  recalculateKPIs(dbData);
  const memory = loadMemory();
  res.json({
    ok: true,
    data: dbData,
    memorySnippet: memory.slice(-1500)
  });
});

// 2. Gestión de Trabajos / Órdenes (CEO Kanban)
app.post('/api/jobs', (req, res) => {
  const dbData = loadDB();
  const { title, client, category, assignedAgent, supportAgents, priority, budget, deadline, notes, checklist } = req.body;

  if (!title || !client) {
    return res.status(400).json({ ok: false, error: 'Título y cliente son obligatorios' });
  }

  const newJob = {
    id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title: title.trim(),
    client: client.trim(),
    category: category || 'Hardware & Domótica',
    assignedAgent: assignedAgent || 'ag_roxy',
    supportAgents: Array.isArray(supportAgents) ? supportAgents : [],
    priority: priority || 'media',
    status: 'en_progreso',
    progress: 0,
    budget: Number(budget) || 0,
    deadline: deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: notes || '',
    checklist: Array.isArray(checklist) ? checklist : [
      { id: `chk_${Date.now()}_1`, task: 'Revisión y diagnóstico inicial', done: false },
      { id: `chk_${Date.now()}_2`, task: 'Ensamble / Desarrollo técnico', done: false },
      { id: `chk_${Date.now()}_3`, task: 'Control de calidad y entrega', done: false }
    ]
  };

  dbData.jobs.unshift(newJob);
  recalculateKPIs(dbData);
  saveDB(dbData);
  appendMemory(`Nuevo trabajo creado: "${newJob.title}" para ${newJob.client} ($${newJob.budget.toLocaleString('es-AR')}) asignado a ${newJob.assignedAgent}.`);

  res.json({ ok: true, job: newJob });
});

app.patch('/api/jobs/:id', (req, res) => {
  const dbData = loadDB();
  const job = dbData.jobs.find(j => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'Trabajo no encontrado' });
  }

  const { status, progress, notes, checklist, priority, assignedAgent } = req.body;
  if (status !== undefined) job.status = status;
  if (progress !== undefined) job.progress = Math.max(0, Math.min(100, Number(progress)));
  if (notes !== undefined) job.notes = notes;
  if (checklist !== undefined) job.checklist = checklist;
  if (priority !== undefined) job.priority = priority;
  if (assignedAgent !== undefined) job.assignedAgent = assignedAgent;

  // Si se marcó como completado, asegurar 100% de progreso
  if (job.status === 'completado') {
    job.progress = 100;
  }

  recalculateKPIs(dbData);
  saveDB(dbData);
  appendMemory(`Trabajo actualizado: "${job.title}" -> Estado: ${job.status}, Progreso: ${job.progress}%.`);

  res.json({ ok: true, job });
});

app.delete('/api/jobs/:id', (req, res) => {
  const dbData = loadDB();
  const initialLen = dbData.jobs.length;
  dbData.jobs = dbData.jobs.filter(j => j.id !== req.params.id);
  if (dbData.jobs.length === initialLen) {
    return res.status(404).json({ ok: false, error: 'Trabajo no encontrado' });
  }

  recalculateKPIs(dbData);
  saveDB(dbData);
  res.json({ ok: true, message: 'Trabajo eliminado correctamente' });
});

// 3. Planes de Acción & Anteproyectos (3 Fases)
app.post('/api/anteproyectos', (req, res) => {
  const dbData = loadDB();
  dbData.anteproyectos = dbData.anteproyectos || { fase1_ideas: [], fase2_anteproyectos: [], fase3_proyecto_definitivo: {} };

  const { title, category, desc, estimatedRevenue, gateway, unitPrice, profitMargin } = req.body;
  if (!title) {
    return res.status(400).json({ ok: false, error: 'Título requerido' });
  }

  const newIdea = {
    id: `idea_${Date.now()}`,
    title: title.trim(),
    category: category || 'Hardware & Deporte',
    selected: false,
    score: 8.5,
    desc: desc || '',
    estimatedRevenue: estimatedRevenue || '$500.000 ARS'
  };

  dbData.anteproyectos.fase1_ideas.push(newIdea);
  saveDB(dbData);
  appendMemory(`Nueva idea estratégica registrada en Fase 1: "${newIdea.title}".`);

  res.json({ ok: true, idea: newIdea });
});

// 4. Auditoría de Áreas y Solicitud de Consejo de Rudy (CEO)
app.post('/api/audit-area', async (req, res) => {
  const { areaId } = req.body;
  const dbData = loadDB();
  const area = (dbData.areaAudits || []).find(a => a.id === areaId);

  if (!area) {
    return res.status(404).json({ ok: false, error: 'Área no encontrada' });
  }

  let advice = '';
  let actionPlan = '';

  if (geminiAvailable && aiClient) {
    try {
      const prompt = `Sos Rudeus (Rudy) Greyrat, CEO y Estratega de Electrónicat en Catamarca.
Aplicando la Teoría de Restricciones (TOC) y Lean Startup, analiza el área "${area.name}" (Líder: ${area.leadAgent}).
Cuello de botella reportado: "${area.bottleneck}".
Dame un consejo de CEO directo y accionable (máximo 2 párrafos) y un Plan de Acción concreto en 1 sola frase.
Devuelve tu respuesta en este formato exacto:
CONSEJO: <texto>
PLAN_ACCION: <texto>`;

      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: prompt
      });

      const reply = response.text || '';
      const cMatch = reply.match(/CONSEJO:\s*([\s\S]*?)(?=PLAN_ACCION:|$)/i);
      const aMatch = reply.match(/PLAN_ACCION:\s*([\s\S]*)/i);
      if (cMatch) advice = cMatch[1].trim();
      if (aMatch) actionPlan = aMatch[1].trim();
    } catch (e) {
      console.warn('Fallo de Gemini al auditar área, usando heurística:', e.message);
    }
  }

  if (!advice) {
    advice = `Revisión estratégica para ${area.name}: debemos enfocar los esfuerzos en eliminar la fricción técnica y proteger la liquidez. Si una tarea no acelera el cobro de trabajos o la entrega del tanteador, queda en segundo plano.`;
    actionPlan = `Establecer un protocolo de entrega rápida y control de calidad antes del fin de semana.`;
  }

  area.ceoAdvice = advice;
  if (actionPlan) area.actionPlan = actionPlan;
  area.lastAudited = new Date().toISOString();

  saveDB(dbData);
  res.json({ ok: true, area });
});

// 5. Historial persistente del Chatbot
app.get('/api/chat-history', (req, res) => {
  const history = loadChatHistory();
  res.json({ ok: true, history });
});

app.delete('/api/chat-history', (req, res) => {
  saveChatHistory([]);
  res.json({ ok: true, message: 'Historial de chat borrado.' });
});

// 6. Chat con Rudy Greyrat (CEO Conversacional + Ejecución de Acciones)
app.post('/api/chat', async (req, res) => {
  const { message, userName = 'Ale' } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  const userTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Guardar mensaje del usuario
  appendToChatHistory({
    id: `msg_u_${Date.now()}`,
    sender: userName,
    text: message.trim(),
    type: 'user',
    time: userTime
  });

  const dbData = loadDB();
  const systemPrompt = loadPrompt();
  const memory = loadMemory();

  // Contexto vivo de los trabajos y estado de Electronicat
  const activeJobsText = (dbData.jobs || [])
    .slice(0, 6)
    .map(j => `  - [${j.priority.toUpperCase()}] "${j.title}" (${j.client}) | Estado: ${j.status} | Avance: ${j.progress}% | Asignado: ${j.assignedAgent}`)
    .join('\n');

  const contextData = `
ESTADO EJECUTIVO DE ELECTRONICAT (Catamarca):
- CEO: Rudeus (Rudy) Greyrat
- Modo: ${dbData.systemInfo?.mode || 'Modo Rescate & Escalamiento'}
- Cuello de botella crítico: ${dbData.kpis?.criticalBottleneck || 'Tableros 24s Montmartre'}
- Trabajos en curso:
${activeJobsText || '  (Sin trabajos activos)'}
- Últimas directivas: ${(dbData.recentDirectives || []).slice(0, 3).map(d => `${d.author} -> ${d.targetAgent}: "${d.directive}"`).join(' | ')}
`;

  const instruction = `
${systemPrompt}

MEMORIA HISTÓRICA RECIENTE:
${memory.slice(-1200)}

${contextData}

INSTRUCCIÓN DE INTERACCIÓN:
- Estás conversando 1 a 1 con ${userName} (Director y Fundador de Electronicat junto con Lucas).
- Sos Rudeus (Rudy) Greyrat: líder sereno, extremadamente analítico, estratégico, motivador y protector de la moral y la caja de la empresa.
- Tenés mentalidad de "Wartime CEO": valorás la velocidad, el foco quirúrgico en el cuello de botella (terminar Montmartre y lanzar la serie de 10 tableros), y la subordinación de tareas secundarias.
- Hablá con un tono cercano, profesional, apasionado por la ingeniería y el crecimiento del taller de Catamarca. Tratás a ${userName} de igual a igual, con admiración por su trabajo técnico.
- Si ${userName} te propone una nueva idea de proyecto, negocio o directiva para el equipo, analízala con la metodología Lean Startup y Teoría de Restricciones.
- Si detectás que ${userName} te pide crear un nuevo trabajo, cambiar el estado de un trabajo existente o emitir una directiva formal al equipo, agrega AL FINAL de tu respuesta un bloque JSON con la etiqueta exacta \`\`\`ceo_action ... \`\`\` para que el sistema actualice el dashboard y la base de datos de manera inmediata:
\`\`\`ceo_action
{
  "detected": true,
  "summary": "Resumen ejecutivo de la acción",
  "actions": [
    {
      "type": "create_job",
      "title": "Título del trabajo",
      "client": "Nombre del cliente",
      "category": "Hardware & Domótica" | "Software & Firmware" | "Servicio Técnico" | "Marketing & Ventas" | "Instalaciones & Campo",
      "assignedAgent": "ag_roxy" | "ag_nanahoshi" | "ag_ruijerd" | "ag_silphy" | "ag_eris" | "ag_linia_pursena" | "ag_norn",
      "priority": "critica" | "alta" | "media" | "baja",
      "budget": 0,
      "notes": "Detalles"
    },
    {
      "type": "update_job_status",
      "jobId": "id del trabajo si aplica",
      "clientMatch": "Nombre del cliente para buscar",
      "newStatus": "cola" | "en_progreso" | "bloqueado" | "completado"
    },
    {
      "type": "emit_directive",
      "targetAgent": "ag_roxy" | "ag_nanahoshi" | "ag_silphy" | "ag_eris" | "ag_ruijerd" | "ag_linia_pursena",
      "directive": "Texto claro de la directiva"
    }
  ]
}
\`\`\`
Si es una charla estratégica normal sin modificaciones directas en la base, NO agregues ese bloque, solo responde con naturalidad y visión de líder.
`;

  let replyText = '';
  let detectedAction = null;

  if (geminiAvailable && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: `${instruction}\n\nMENSAJE DE ${userName.toUpperCase()}:\n"${message.trim()}"`
      });
      replyText = response.text || '';
    } catch (e) {
      console.warn('⚠️ [Rudy Gemini Fallback]:', e.message);
    }
  }

  // Fallback heurístico si Gemini no está disponible o falla
  if (!replyText) {
    const lower = message.toLowerCase();
    if (lower.includes('idea') || lower.includes('negocio') || lower.includes('proyecto')) {
      replyText = `Excelente idea, ${userName}. Desde la dirección estratégica tenemos que evaluarla bajo el filtro Lean: ¿cuánto tiempo de taller nos insume y qué tan rápido valida tracción de caja? Cuidemos que no desvíe el foco de los Tableros de Montmartre y la serie de 10 unidades, que es nuestro mayor apalancamiento ahora mismo.`;
    } else if (lower.includes('cuello de botella') || lower.includes('freno') || lower.includes('bloqueo')) {
      replyText = `El cuello de botella principal ahora mismo es el ensamble y calibración de la antena RF de los 24 segundos de Montmartre. Silphy necesita que ese equipo se entregue para cobrar los $750.000. Subordinemos cualquier otra tarea secundaria en el banco de pruebas hasta tenerlo listo.`;
    } else if (lower.includes('directiva') || lower.includes('roxy') || lower.includes('nanahoshi')) {
      replyText = `Comprendido, ${userName}. Ya mismo coordino con el equipo para que alineen sus prioridades al objetivo central de esta semana.`;
    } else {
      replyText = `Hola ${userName}. Acá estoy monitoreando todo el pulso operativo de Electronicat. Contame qué estuviste evaluando o qué dirección querés que tomemos hoy.`;
    }
  }

  // Extraer bloque ceo_action si existe
  const actionMatch = replyText.match(/```ceo_action\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      detectedAction = JSON.parse(actionMatch[1]);
      replyText = replyText.replace(/```ceo_action[\s\S]*?```/, '').trim();
    } catch (err) {
      console.warn('Error parseando ceo_action:', err.message);
    }
  }

  // Ejecución de acciones automáticas en la base de datos
  const executedActions = [];
  if (detectedAction && detectedAction.actions && detectedAction.actions.length > 0) {
    detectedAction.actions.forEach(act => {
      if (act.type === 'create_job') {
        const newJ = {
          id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          title: act.title || 'Nuevo Trabajo Estratégico',
          client: act.client || 'Cliente General',
          category: act.category || 'Hardware & Domótica',
          assignedAgent: act.assignedAgent || 'ag_roxy',
          supportAgents: [],
          priority: act.priority || 'alta',
          status: 'en_progreso',
          progress: 0,
          budget: Number(act.budget) || 0,
          deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          notes: act.notes || 'Creado automáticamente por directiva en chat con Rudy CEO.',
          checklist: [
            { id: `chk_${Date.now()}_1`, task: 'Revisión y puesta en marcha inicial', done: false },
            { id: `chk_${Date.now()}_2`, task: 'Entrega final', done: false }
          ]
        };
        dbData.jobs.unshift(newJ);
        executedActions.push(`Trabajo creado: "${newJ.title}" para ${newJ.client}`);
      } else if (act.type === 'update_job_status') {
        const target = dbData.jobs.find(j => 
          (act.jobId && j.id === act.jobId) ||
          (act.clientMatch && j.client.toLowerCase().includes(act.clientMatch.toLowerCase()))
        );
        if (target && act.newStatus) {
          target.status = act.newStatus;
          if (act.newStatus === 'completado') target.progress = 100;
          executedActions.push(`Estado de "${target.title}" cambiado a ${target.newStatus}`);
        }
      } else if (act.type === 'emit_directive') {
        const newDir = {
          id: `dir_${Date.now()}`,
          date: new Date().toISOString(),
          author: `Rudy Greyrat (CEO) & ${userName}`,
          targetAgent: act.targetAgent || 'ag_roxy',
          directive: act.directive,
          status: 'activa'
        };
        dbData.recentDirectives = dbData.recentDirectives || [];
        dbData.recentDirectives.unshift(newDir);
        executedActions.push(`Directiva emitida a ${newDir.targetAgent}`);
      }
    });

    recalculateKPIs(dbData);
    saveDB(dbData);
    if (executedActions.length > 0) {
      appendMemory(`Acciones ejecutivas aplicadas desde el chat: ${executedActions.join(' | ')}`);
    }
  }

  // Guardar respuesta del bot en historial persistente
  const botTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  appendToChatHistory({
    id: `msg_r_${Date.now()}`,
    sender: 'Rudy Greyrat (CEO)',
    text: replyText,
    type: 'agent',
    time: botTime,
    executedActions: executedActions.length > 0 ? executedActions : undefined
  });

  res.json({
    ok: true,
    reply: replyText,
    detectedAction,
    executedActions,
    updatedData: dbData
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`⚡ MICRO-AGENTE 01: RUDY GREYRAT (DIRECTOR GENERAL & CEO)`);
  console.log(`🏢 Electronicat - Oficina Virtual y Taller Central`);
  console.log(`🌐 Servidor Web & Panel de Control: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
'use strict';

/*
 * ronda-13.test.js
 * ORDEN-RONDA-13 (correcciones del ciclo 12 + H14 reuso de base + H19
 * sugerencias del piloto):
 *
 *  1. CSV: los cinco prefijos de fórmula (=, +, -, @, tab) se neutralizan
 *     byte a byte; la coma se sigue escapando entre comillas
 *  2. pliego-bases-condiciones.js ya no existe ni es entregable de un estado
 *  3. YAML: el byte nulo (0x00) se emite escapado y sobrevive el roundtrip
 *  4. EETT: la ficha del anexo no imprime "Cantidad"
 *  5. Vista de sugerencias: modo piloto apagado = sin botón en el DOM
 *  6. Vistas: pantallaActual desde las secciones visibles
 *  7. Vistas: recogerContexto deja pasar solo los campos declarados
 *  8. Jefe: aMarkdown cita cada línea del reporte con "> "
 *  9. Archivo: el botón "Usar como base" solo aparece en un perfeccionado
 * 10. config/aplicacion.json: por defecto el modo piloto está apagado
 * 11. H19 servidor: validación de contenido (hasta 4000) y email
 * 12. H19 servidor: sugerencias.jsonl es append-only; marcar agrega una línea
 *     y cruza el estado de la original sin tocarla
 * 13. H19 servidor: con 4000 sucesos la siguiente sugerencia se rechaza
 * 14. H14 servidor: un perfeccionado archivado es base; lista blanca estricta,
 *     código dado de baja bloquea el POST, basadoEn y evento reuso_base
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const os = require('node:os');

const RAIZ = path.join(__dirname, '..');

// --- Núcleo (vía el andamiaje de transiciones, que ya carga las piezas) ---
const ti = require('./helpers/transiciones-servidor-util.js');
const { pedir } = ti;

// --- Módulos extra de la app que ronda-13 prueba ---
require(path.join(RAIZ, 'app', 'js', 'export', 'pliego-yaml.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'exploracion.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'archivo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'sugerencias.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'sugerencias-jefe.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'usar-base.js'));

const SGC = globalThis.SGC;
const yaml = SGC.descargas.pliegoYaml;
const exploracion = SGC.views.exploracion;
const sugerencias = SGC.views.sugerencias;
const sugerenciasJefe = SGC.views.sugerenciasJefe;

const eventos = require(path.join(RAIZ, 'server', 'eventos.js'));
const dom = require('./helpers/dom-stub.js');
const { Nodo, documento, registrar, obtenerConteoInnerHTML } = dom;

function esperar() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Ruta del datos.json de un expediente (el original, en el espacio de trabajo).
function rutaDatos(datosDir, id) {
  return path.join(datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente', 'datos.json');
}

// --- Roundtrip YAML contra PyYAML (misma receta que ronda-12) ---
const YAML_SCRIPT = path.join(__dirname, 'helpers', 'yaml_roundtrip.py');

function roundtripYaml(datos) {
  const contenido = yaml.emitir(datos);
  const tmpFile = path.join(os.tmpdir(), 'sgc_rt13_' + process.pid + '.yaml');
  fs.writeFileSync(tmpFile, contenido, 'utf8');
  try {
    const buf = execSync('python "' + YAML_SCRIPT + '" "' + tmpFile + '"', { timeout: 10000 });
    return JSON.parse(buf.toString('utf8'));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (ignorado) {}
  }
}

// ======================================================================
// 1. CSV: neutralización de fórmulas byte a byte (ADR-031)
// ======================================================================
test('CSV: los prefijos de fórmula se neutralizan byte a byte', () => {
  const prefijos = ['=', '+', '-', '@', '\t'];
  for (const prefijo of prefijos) {
    const valor = prefijo + 'contenido';
    const salida = exploracion.neutralizarFormulas(valor);
    assert.strictEqual(salida.charAt(0), "'",
      'prefijo ' + JSON.stringify(prefijo) + ' queda con apóstrofo delante');
    assert.strictEqual(salida.charCodeAt(0), 0x27, 'es ASCII 0x27 literal');
    assert.strictEqual(salida.slice(1), valor, 'el dato se conserva después del apóstrofo');
  }
  assert.strictEqual(exploracion.neutralizarFormulas('hola'), 'hola',
    'el texto común no se toca');
  assert.strictEqual(exploracion.neutralizarFormulas(''), '', 'vacío intacto');
  assert.strictEqual(exploracion.neutralizarFormulas('42'), '42', 'números intactos');

  // línea completa: la fórmula va con apóstrofo y la coma se escapa.
  const lineas = exploracion.lineasCSV([
    { motivo: '=1+1', detalle: 'a, b', normal: 'hola' }
  ]);
  assert.strictEqual(lineas[0], 'motivo,detalle,normal', 'cabecera en orden de aparición');
  assert.ok(lineas[1].startsWith("'=1+1"), 'la fórmula va con apóstrofo');
  assert.ok(lineas[1].includes('"a, b"'), 'la coma se escapa entre comillas');
});

// ======================================================================
// 2. pliego-bases-condiciones.js ya no existe (§2.2)
// ======================================================================
test('pliego-bases-condiciones.js no existe ni ningún estado lo exige (§2.2)', () => {
  assert.strictEqual(
    fs.existsSync(path.join(RAIZ, 'app', 'js', 'renders', 'pliego-bases-condiciones.js')),
    false,
    'el render fue eliminado');
  for (const e of ti.config.ESTADOS) {
    for (const en of (e.entregables || [])) {
      assert.notStrictEqual(en.id, 'pliego-bases-condiciones',
        e.id + ' no debe exigir pliego-bases-condiciones');
    }
  }
});

// ======================================================================
// 3. YAML: byte nulo (§2.3)
// ======================================================================
test('YAML: el byte nulo se emite escapado y sobrevive el roundtrip', () => {
  const emitido = yaml.emitir({ titulo: 'campos\u0000crudos' });
  assert.ok(!emitido.includes('\u0000'), 'no hay ningún byte nulo literal');
  assert.ok(emitido.includes('\\u0000'), 'se emite la secuencia escapada \\u0000');
  const vuelta = roundtripYaml({ titulo: 'campos\u0000crudos' });
  assert.strictEqual(vuelta.titulo, 'campos\u0000crudos', 'el roundtrip devuelve el byte');
});

// ======================================================================
// 4. EETT: la ficha del anexo no imprime cantidades
// ======================================================================
test('EETT: la ficha del anexo no imprime "Cantidad"', () => {
  const ae = SGC.core.anexoEett;
  const exp = {
    id: '2026-ET-1',
    titulo: 'EETT sin cantidades',
    datos: {
      titulo: 'EETT sin cantidades',
      renglones: [
        { codigo: '2.1.1-439.102', descripcion: 'Resma A4', cantidad: 99, unidad: 'UN',
          aclaracion: 'x'.repeat(300) },
        { codigo: '2.1.1-439.102', descripcion: 'Resma A3', cantidad: 5, unidad: 'UN',
          aclaracion: 'y'.repeat(280) }
      ],
      requerimiento: { condicionesParticulares: 'Entrega en boca' }
    }
  };
  const plan = ae.planificar(exp);
  assert.ok(plan.anexos.length > 0, 'hay anexos por desborde de aclaración');
  const html = SGC.renders.anexoEett.componer(exp, plan.anexos[0].nombre);
  assert.ok(html.includes('Renglón 1 — texto completo'), 'es la ficha del renglón');
  assert.ok(html.includes('Descripción ONC'), 'cabecera nueva presente');
  assert.ok(!/Cantidad/i.test(html), 'la EETT no menciona la cantidad en ningún punto');
});

// ======================================================================
// 5. Vista de sugerencias: sin modo piloto no hay nada en el DOM
// ======================================================================
test('sugerencias: con modo piloto apagado no existe ni botón ni panel', () => {
  globalThis.document = documento;
  documento.porId = {};
  const raiz = new Nodo('div');
  sugerencias.fijarConfig({ modoPiloto: false, version: '1.0.0' });
  sugerencias.montar(raiz);
  assert.strictEqual(sugerencias.paneles(), 0, 'no hay FAB');
  assert.strictEqual(raiz.children.length, 0, 'el DOM queda vacío');
  assert.strictEqual(documento.porId['sgc-fab-sugerencia'], undefined, 'botón no registrado');
  assert.strictEqual(obtenerConteoInnerHTML(), 0, 'sin innerHTML');
});

test('sugerencias: con modo piloto activo el FAB y el panel se arman con textContent', () => {
  globalThis.document = documento;
  documento.porId = {};
  const raiz = new Nodo('div');
  sugerencias.fijarConfig({ modoPiloto: true, version: '1.0.0' });
  sugerencias.montar(raiz);
  assert.strictEqual(sugerencias.paneles(), 1, 'FAB creado');
  assert.strictEqual(raiz.children.length, 2, 'botón + panel');
  assert.strictEqual(raiz.children[0].id, 'sgc-fab-sugerencia');
  assert.strictEqual(raiz.children[0].textContent, '?');
  assert.strictEqual(raiz.children[1].id, 'sgc-panel-sugerencia');
  assert.strictEqual(raiz.children[1].hidden, true, 'el panel nace cerrado');
  assert.strictEqual(obtenerConteoInnerHTML(), 0, 'cero innerHTML (ADR-011)');
  sugerencias.fijarConfig(null);
});

// ======================================================================
// 6. pantallaActual: fuente de verdad de la navegación
// ======================================================================
test('pantallaActual: se deduce de las secciones visibles', () => {
  globalThis.document = documento;
  documento.porId = {};
  const ids = ['sgc-sugerencias-jefe', 'sgc-base-revision', 'sgc-expediente',
    'sgc-kanban', 'sgc-archivo'];
  for (const id of ids) {
    const nodo = registrar(new Nodo('section', id));
    nodo.hidden = true;
  }
  const visibles = {
    'sgc-sugerencias-jefe': 'sugerencias-jefe',
    'sgc-base-revision': 'base-revision',
    'sgc-expediente': 'expediente',
    'sgc-kanban': 'tablero',
    'sgc-archivo': 'archivo'
  };
  assert.strictEqual(sugerencias.pantallaActual(), 'alta',
    'sin ninguna sección visible el contexto es alta');
  for (const id of ids) {
    documento.porId[id].hidden = false;
    assert.strictEqual(sugerencias.pantallaActual(), visibles[id],
      'al encender ' + id + ' la pantalla es ' + visibles[id]);
    documento.porId[id].hidden = true;
  }
});

// ======================================================================
// 7. recogerContexto: solo pasan los campos declarados
// ======================================================================
test('recogerContexto: solo pasan los campos declarados y el contenido', () => {
  const r = sugerencias.recogerContexto({
    contenido: 'no anda el detalle',
    pantalla: 'expediente',
    expediente: '2026-001',
    paso: 'SOLICITUD_CONTRATACION',
    appVersion: '1.0.0',
    catalogoVersion: '98201747',
    navegador: 'ua-de-prueba',
    email: 'op@faa.mil.ar',
    rol: 'generador',
    equipo: 'PC-1',
    extra: 'no debe entrar'
  });
  assert.deepStrictEqual(r.datos, {
    contenido: 'no anda el detalle',
    pantalla: 'expediente',
    expediente: '2026-001',
    paso: 'SOLICITUD_CONTRATACION',
    appVersion: '1.0.0',
    catalogoVersion: '98201747',
    navegador: 'ua-de-prueba'
  });
  assert.deepStrictEqual(r.contexto, {
    email: 'op@faa.mil.ar',
    rol: 'generador',
    equipo: 'PC-1'
  });
  const vacio = sugerencias.recogerContexto({ contenido: '', email: 'x' });
  assert.deepStrictEqual(vacio.datos, { contenido: '' }, 'los vacíos no entran');
});

// ======================================================================
// 8. Jefe: aMarkdown cita cada línea del reporte
// ======================================================================
test('jefe: aMarkdown cita cada línea y distingue pendiente/atendida', () => {
  const md = sugerenciasJefe.aMarkdown([
    {
      id: 's-abc', timestamp: '2026-08-27T10:00:00.000Z',
      email: 'op@faa.mil.ar', pantalla: 'expediente', expediente: '2026-001',
      paso: 'SOLICITUD_CONTRATACION',
      contenido: 'Falló el guardado\nen el paso 3', atendido: false
    },
    {
      id: 's-def', timestamp: '2026-08-27T09:00:00.000Z',
      email: 'op2@faa.mil.ar', pantalla: 'base-revision',
      contenido: 'Faltó un renglón', atendido: true,
      atendidaPor: 'jc@faa.mil.ar', atendidaEn: '2026-08-27T11:00:00.000Z'
    }
  ]);
  assert.ok(md.includes('## s-abc'), 'una sección por sugerencia');
  assert.ok(md.includes('> Falló el guardado'), 'primera línea citada');
  assert.ok(md.includes('> en el paso 3'), 'segunda línea citada');
  assert.ok(md.includes('- Estado: Pendiente'), 'estado pendiente');
  assert.ok(md.includes('- Estado: Atendida'), 'estado atendida');
  assert.strictEqual(md.includes('Atendida por'), false,
    'la nota de quién atendió es de la vista DOM, no del Markdown');
  assert.ok(!md.includes('<'), 'nada del contenido se interpreta como HTML');
});

// ======================================================================
// 9. Archivo: botón "Usar como base" solo en el perfeccionado
// ======================================================================
test('archivo: "Usar como base" aparece solo para el perfeccionado', async () => {
  globalThis.document = documento;
  documento.porId = {};
  const raiz = new Nodo('section');
  const lista = new Nodo('ul'); lista.id = 'sgc-archivo-lista';
  const conteo = new Nodo('p'); conteo.id = 'sgc-archivo-conteo';
  const error = new Nodo('p'); error.id = 'sgc-archivo-error';
  const refrescarBtn = new Nodo('button'); refrescarBtn.id = 'sgc-archivo-refrescar';
  raiz.appendChild(lista);
  raiz.appendChild(conteo);
  raiz.appendChild(error);
  raiz.appendChild(refrescarBtn);

  let usadas = [];
  SGC.views.archivo.fijarRepo({
    listarArchivoHistorico: () => Promise.resolve([
      { id: '2026-001', titulo: 'Resmas', estado: ti.config.ESTADO_FINAL,
        archivadoEn: '2026-08-18T10:00:00.000Z', ultimoOperador: 'x@faa.mil.ar' },
      { id: '2026-002', titulo: 'En trámite', estado: 'SOLICITUD_CONTRATACION',
        archivadoEn: null, ultimoOperador: null }
    ])
  });
  SGC.views.archivo.onUsarBase((id) => usadas.push(id));
  SGC.views.archivo.montar(raiz);
  SGC.views.archivo.refrescar();
  await esperar();
  await esperar();

  assert.strictEqual(lista.children.length, 2, 'dos entradas');
  const primero = lista.children[0];
  assert.strictEqual(primero.children.length, 3, 'título + botón base + detalle');
  assert.strictEqual(primero.children[1].textContent, 'Usar como base');
  const segundo = lista.children[1];
  assert.strictEqual(segundo.children.length, 2, 'título + detalle, sin botón');
  assert.ok(!segundo.children.some((h) => h.textContent === 'Usar como base'));
  primero.children[1].click();
  assert.deepStrictEqual(usadas, ['2026-001'], 'onUsarBase recibe el id del perfeccionado');
  assert.strictEqual(obtenerConteoInnerHTML(), 0, 'sin innerHTML');
});

// ======================================================================
// 10. Config: el modo piloto arranca apagado
// ======================================================================
test('config/aplicacion.json: el modo piloto por defecto está apagado', () => {
  const cfg = JSON.parse(
    fs.readFileSync(path.join(RAIZ, 'config', 'aplicacion.json'), 'utf8'));
  assert.strictEqual(cfg.modoPiloto, false, 'modoPiloto false');
  assert.strictEqual(cfg.schemaVersion, 1);
  assert.ok(typeof cfg.version === 'string' && cfg.version.length > 0);
});

// ======================================================================
// 11-13. H19 servidor: sugerencias (JSONL append-only con tope)
// ======================================================================
test('H19: POST /api/sugerencias valida email y contenido (hasta 4000)', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    let r = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: 'hola', contexto: {}
    });
    assert.equal(r.status, 400, 'sin email se rechaza');

    r = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: '', contexto: ti.contexto('generador')
    });
    assert.equal(r.status, 400, 'sin contenido se rechaza');

    r = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: 'x'.repeat(4001), contexto: ti.contexto('generador')
    });
    assert.equal(r.status, 400, 'contenido de 4001 caracteres se rechaza');

    r = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: 'Falló el envío del expediente',
      pantalla: 'expediente',
      expediente: '2026-001',
      paso: 'SOLICITUD_CONTRATACION',
      appVersion: '1.0.0',
      catalogoVersion: '98201747',
      navegador: 'ua-de-prueba',
      contexto: ti.contexto('generador')
    });
    assert.equal(r.status, 201, 'la sugerencia válida se acepta');
    assert.ok(r.body.id.startsWith('s-'), 'id con prefijo s-');

    const lista = await pedir(ent.base, 'GET', '/api/sugerencias', { contexto: ti.contexto('contrataciones_supervisor') });
    assert.equal(lista.status, 200);
    assert.strictEqual(lista.body.sucesos, 1);
    assert.strictEqual(lista.body.completo, true);
    assert.strictEqual(lista.body.sugerencias.length, 1);
    const s = lista.body.sugerencias[0];
    assert.strictEqual(s.contenido, 'Falló el envío del expediente');
    assert.strictEqual(s.pantalla, 'expediente');
    assert.strictEqual(s.expediente, '2026-001');
    assert.strictEqual(s.paso, 'SOLICITUD_CONTRATACION');
    assert.strictEqual(s.email, ti.EMAIL_POR_ROL.generador, 'el email del contexto viaja');
    assert.strictEqual(s.atendido, false);
  } finally {
    await ti.limpiarEntorno(ent);
  }
});

test('H19: el JSONL es append-only y marcar no toca las líneas anteriores', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    const envios = [];
    for (let i = 0; i < 20; i++) {
      envios.push(pedir(ent.base, 'POST', '/api/sugerencias', {
        contenido: 'reporte ' + i, contexto: ti.contexto('generador')
      }));
    }
    const resultados = await Promise.all(envios);
    for (const r of resultados) {
      assert.equal(r.status, 201, 'los 20 envíos se aceptan');
    }
    const archivo = path.join(ent.datosDir, 'sugerencias.jsonl');
    const lineas = fs.readFileSync(archivo, 'utf8')
      .split(/\r?\n/).filter((l) => l.trim() !== '');
    assert.strictEqual(lineas.length, 20, '20 líneas exactas, sin pérdidas');

    const lista = await pedir(ent.base, 'GET', '/api/sugerencias', { contexto: ti.contexto('contrataciones_supervisor') });
    assert.strictEqual(lista.body.sucesos, 20);
    const primera = lista.body.sugerencias.find((s) => s.contenido === 'reporte 0');
    assert.ok(primera, 'la primera sugerencia está entre las leídas');
    const lineaOriginal = lineas.find((l) => l.includes('reporte 0'));

    const atendido = await pedir(ent.base,
      'POST', '/api/sugerencias/' + primera.id + '/atender',
      { contexto: ti.contexto('contrataciones_supervisor') });
    assert.equal(atendido.status, 200);
    assert.strictEqual(atendido.body.sugerenciaId, primera.id);

    const despues = fs.readFileSync(archivo, 'utf8')
      .split(/\r?\n/).filter((l) => l.trim() !== '');
    assert.strictEqual(despues.length, 21, 'marcar agrega exactamente una línea');
    assert.ok(despues.includes(lineaOriginal), 'la línea original queda intacta');

    const lista2 = await pedir(ent.base, 'GET', '/api/sugerencias', { contexto: ti.contexto('contrataciones_supervisor') });
    const marcada = lista2.body.sugerencias.find((s) => s.id === primera.id);
    assert.strictEqual(marcada.atendido, true, 'se cruza el estado');
    assert.strictEqual(marcada.atendidaPor, ti.EMAIL_POR_ROL.contrataciones_supervisor);
    assert.ok(typeof marcada.atendidaEn === 'string', 'con su timestamp');
    assert.strictEqual(marcada.contenido, 'reporte 0', 'el contenido original no cambió');

    const noExiste = await pedir(ent.base,
      'POST', '/api/sugerencias/s-zzz/atender',
      { contexto: ti.contexto('contrataciones_supervisor') });
    assert.equal(noExiste.status, 404, 'id inexistente');

    const sinEmail = await pedir(ent.base,
      'POST', '/api/sugerencias/' + primera.id + '/atender',
      { contexto: {} });
    assert.equal(sinEmail.status, 400, 'el Jefe debe ir identificado');

    const otro = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: 'después', contexto: ti.contexto('generador')
    });
    assert.equal(otro.status, 201, 'el tope sigue permitiendo escribir');
  } finally {
    await ti.limpiarEntorno(ent);
  }
});

test('H19: con 4000 sucesos la sugerencia 4001 se rechaza con 400', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    const lineas = [];
    for (let i = 0; i < 4000; i++) {
      lineas.push(JSON.stringify({
        tipo: 'sugerencia', id: 's-base-' + i, contenido: 'x' + i,
        email: 'op@faa.mil.ar'
      }));
    }
    fs.writeFileSync(path.join(ent.datosDir, 'sugerencias.jsonl'),
      lineas.join('\n') + '\n', 'utf8');

    const lista = await pedir(ent.base, 'GET', '/api/sugerencias', { contexto: ti.contexto('contrataciones_supervisor') });
    assert.strictEqual(lista.body.sucesos, 4000);
    assert.strictEqual(lista.body.completo, true,
      'a 4000 sucesos exactos el diálogo está en el límite y aún avisa completo');

    const r = await pedir(ent.base, 'POST', '/api/sugerencias', {
      contenido: 'una más', contexto: ti.contexto('generador')
    });
    assert.equal(r.status, 400, 'la 4001 se rechaza');
    assert.ok(r.body.error.includes('tope'), 'con aviso de tope');

    // Defensa del flag: una línea más escrita fuera del API apaga `completo`.
    fs.appendFileSync(path.join(ent.datosDir, 'sugerencias.jsonl'),
      JSON.stringify({ tipo: 'sugerencia', id: 's-linea-4001' }) + '\n', 'utf8');
    const sobrepasado = await pedir(ent.base, 'GET', '/api/sugerencias', { contexto: ti.contexto('contrataciones_supervisor') });
    assert.strictEqual(sobrepasado.body.sucesos, 4001);
    assert.strictEqual(sobrepasado.body.completo, false,
      'al superar el tope el diálogo deja de avisar que está completo');
  } finally {
    await ti.limpiarEntorno(ent);
  }
});

// ======================================================================
// 14. H14 servidor: reuso de un perfeccionado como base (ADR-025)
// ======================================================================
test('H14: propuesta de un perfeccionado archivado, lista blanca y creación', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    const base = ent.base;

    // Camino completo hasta PERFECCIONADA: la transición final archiva.
    const origen = await ti.crearEnEstado(base, ent.datosDir, ti.config.ESTADO_FINAL, assert);
    let doc = ti.docEnDisco(ent.datosDir, origen.id);
    assert.strictEqual(doc.estado.id, ti.config.ESTADO_FINAL);
    assert.strictEqual(doc.archivado, true, 'el original queda marcado como archivado');

    // Un expediente en un estado intermedio como control negativo.
    const medio = await ti.crearEnEstado(base, ent.datosDir, 'SOLICITUD_CONTRATACION', assert);
    assert.notStrictEqual(medio.id, origen.id);

    // ---- Propuesta con un código dado de baja + requerimiento completo ----
    doc.requerimiento = {
      objeto: 'Adquisición de resmas',
      justificacionNecesidad: 'Reposición de insumos',
      condicionesParticulares: 'Entrega en boca',
      rubroCodigo: '4210',
      rubroDescripcion: 'Papelería',
      modalidadCompra: 'Orden de compra',
      procedimientoSeleccion: 'Contratación directa'
    };
    doc.renglones.push({ codigo: '777777', cantidad: 1, unidad: 'UN' });
    fs.writeFileSync(rutaDatos(ent.datosDir, origen.id), JSON.stringify(doc, null, 2), 'utf8');

    let resp = await pedir(base, 'GET', '/api/archivo/' + origen.id + '/base');
    assert.equal(resp.status, 200);
    assert.ok(resp.body.codigosInvalidos.includes('777777'),
      'el código dado de baja aparece en la propuesta');
    assert.strictEqual(resp.body.renglones[0].codigo, '2.1.1-439.102');
    assert.strictEqual(resp.body.renglones[0].cantidad, 2);
    assert.strictEqual(resp.body.renglones[0].dadoDeBaja, undefined,
      'el código vigente no se marca');
    assert.strictEqual(resp.body.renglones[1].dadoDeBaja, true,
      'el dado de baja se marca en la propuesta');
    assert.strictEqual(resp.body.titulo, 'Adquisición de resmas');
    assert.strictEqual(resp.body.modalidadCompra, 'Orden de compra');
    assert.strictEqual(resp.body.procedimientoSeleccion, 'Contratación directa');
    assert.strictEqual(resp.body.justificacion, 'Reposición de insumos');
    assert.ok(typeof resp.body.catalogoVersion === 'string' && resp.body.catalogoVersion !== '');
    assert.ok(!('presupuestos' in resp.body), 'la propuesta no expone presupuestos');

    resp = await pedir(base, 'POST', '/api/expedientes/base', {
      origenId: origen.id, indices: [0], contexto: ti.contexto('generador')
    });
    assert.equal(resp.status, 400, 'con un código de baja el POST se bloquea');
    assert.ok(resp.body.error.includes('dados de baja'), 'y lo dice');

    // ---- Propuesta limpia: se crea el nuevo expediente ----
    doc.renglones.pop();
    fs.writeFileSync(rutaDatos(ent.datosDir, origen.id), JSON.stringify(doc, null, 2), 'utf8');
    resp = await pedir(base, 'GET', '/api/archivo/' + origen.id + '/base');
    assert.equal(resp.status, 200);
    assert.deepStrictEqual(resp.body.codigosInvalidos, [], 'sin códigos dados de baja');

    resp = await pedir(base, 'POST', '/api/expedientes/base', {
      origenId: origen.id, indices: [0], contexto: ti.contexto('generador')
    });
    assert.equal(resp.status, 201, 'se crea el expediente nuevo');
    const nuevoId = resp.body.id;
    assert.ok(nuevoId.startsWith('2026-'), 'número nuevo del mismo año');
    assert.notStrictEqual(nuevoId, origen.id, 'no reutiliza el número del origen');

    const creado = await pedir(base, 'GET', '/api/expedientes/' + nuevoId);
    assert.equal(creado.status, 200);
    const nuevo = creado.body.expediente;
    assert.strictEqual(nuevo.basadoEn, origen.id, 'basadoEn se persiste');
    assert.strictEqual(nuevo.titulo, 'Adquisición de resmas');
    assert.strictEqual(nuevo.requerimiento.objeto, 'Adquisición de resmas');
    assert.strictEqual(nuevo.requerimiento.justificacionNecesidad, 'Reposición de insumos');
    assert.strictEqual(nuevo.requerimiento.condicionesParticulares, 'Entrega en boca');
    assert.strictEqual(nuevo.requerimiento.rubroCodigo, '4210');
    assert.strictEqual(nuevo.requerimiento.rubroDescripcion, 'Papelería');
    assert.strictEqual(nuevo.requerimiento.modalidadCompra, 'Orden de compra');
    assert.strictEqual(nuevo.requerimiento.procedimientoSeleccion, 'Contratación directa');
    assert.strictEqual(nuevo.renglones.length, 1, 'solo el renglón seleccionado');
    const ren = nuevo.renglones[0];
    assert.strictEqual(ren.codigo, '2.1.1-439.102');
    assert.deepStrictEqual(Object.keys(ren).sort(), ['cantidad', 'codigo', 'unidad'],
      'renglón copiado por lista blanca (sin rubro ni extras)');
    assert.ok(!('presupuestos' in nuevo), 'sin presupuestos del viejo');
    assert.ok(!('imputacion' in nuevo), 'sin imputación del viejo');
    assert.ok(!('identificacion' in nuevo), 'sin identificación del viejo');
    assert.ok(!('valoresReferencia' in nuevo), 'sin valores de referencia del viejo');

    const eventosNuevo = eventos.leerEventos(ent.datosDir, nuevoId);
    const reuso = eventosNuevo.find((e) => e.tipo === 'reuso_base');
    assert.ok(reuso, 'queda el evento reuso_base');
    assert.strictEqual(reuso.origen, origen.id, 'con el origen');
    assert.strictEqual(reuso.email, ti.EMAIL_POR_ROL.generador, 'con el operador');

    // ---- Controles negativos ----
    let rn = await pedir(base, 'GET', '/api/archivo/' + medio.id + '/base');
    assert.equal(rn.status, 400, 'un no perfeccionado no ofrece base por GET');
    assert.ok(rn.body.error.includes('perfeccionado'));

    rn = await pedir(base, 'POST', '/api/expedientes/base', {
      origenId: medio.id, indices: [0], contexto: ti.contexto('generador')
    });
    assert.equal(rn.status, 400, 'ni por POST');

    rn = await pedir(base, 'GET', '/api/archivo/2026-999/base');
    assert.equal(rn.status, 404, 'un origen inexistente da 404');

    rn = await pedir(base, 'POST', '/api/expedientes/base', {
      origenId: origen.id, indices: [], contexto: ti.contexto('generador')
    });
    assert.equal(rn.status, 400, 'sin renglones seleccionados');

    rn = await pedir(base, 'POST', '/api/expedientes/base', {
      origenId: origen.id, indices: [9], contexto: ti.contexto('generador')
    });
    assert.equal(rn.status, 400, 'índice fuera de rango');
  } finally {
    await ti.limpiarEntorno(ent);
  }
});
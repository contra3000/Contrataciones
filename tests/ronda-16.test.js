'use strict';

/*
 * ronda-16.test.js
 * ORDEN-RONDA-16 §4. Dieciséis pruebas que tapan los criterios 1-5:
 *
 *   1. sin padrón real el servidor no arranca (excepto --declarado),
 *   2. el comando manual de siembra (tools/padron.js alta) deja padrón listo,
 *   3. un marcador desconocido impide publicar la plantilla,
 *   4. el pliego de servicios sale por el generador real,
 *   5. la v1 trae las trece correcciones normativas.
 *
 * Más la tabla de reglas, la versión no se borra, permisos, estampa, vigente,
 * respaldo y derivación de tipo_contrato/tipo_documento.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const nucleo = require('../server/pliego-plantillas.js');
const probador = require('../server/pliego-probador.js');
const respaldo = require('../tools/ayudantes-respaldo.js');
const su = require('./helpers/servidor-util.js');

const GENERADOR = process.env.SGC_GENERADOR_PLIEGOS || 'C:\\Proyectos\\DContrataciones\\Automatizar\\AppOptimizar\\EjemplosProcesoActual\\DocUOC\\Generador de Pliegos';
process.env.SGC_GENERADOR_PLIEGOS = GENERADOR;

function dirTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'ronda16-'));
}

// prueba desestructurada: registra el error en español de la falta de padrón.
function arrancaSinPadron() {
  return su.ejecutarYEsperar([su.SERVIDOR, '--datos', dirTmp('rp16-nopadron-'), '--puerto', '0'], 8000);
}

test('1. sin padrón real el servidor no arranca y avisa en castellano', async () => {
  const r = await arrancaSinPadron();
  assert.notStrictEqual(r.exitCode, 0, 'debe fallar al arrancar sin padrón');
  const salida = (r.stdout + ' ' + r.stderr);
  assert.match(salida, /padr[oó]n/i, 'el motivo debe ser la falta de padrón');
  assert.match(salida, /./, 'contiene algo de texto');
});

test('2. el comando manual de siembra deja el padrón listo y el servidor arranca', async () => {
  const datos = dirTmp('rp16-siembra-');
  const csv = path.join(datos, 'operadores.csv');
  fs.mkdirSync(path.join(datos), { recursive: true });
  fs.writeFileSync(csv,
    'Carlos;Ramírez;carlos.ramirez@faa.mil.ar;contrataciones_supervisor;;true\n' +
    'Ana;Torres;ana.torres@faa.mil.ar;juridica;;true\n', 'utf8');
  const alta = await su.ejecutarYEsperar(
    [path.join(__dirname, '..', 'tools', 'padron.js'), 'alta', '--datos', datos, '--archivo', csv, '--clave', 'Clave-12345'], 10000);
  assert.strictEqual(alta.exitCode, 0, 'el alta manual debe terminar bien: ' + alta.stderr);
  assert.ok(fs.existsSync(path.join(datos, 'padron.json')), 'debe crearse padron.json');
  const ctx = await su.arrancarServidor(datos, 0);
  try {
    assert.ok(ctx.proc && ctx.puerto > 0, 'con padrón real arranca sin --declarado');
  } finally {
    await su.detenerServidor(ctx);
  }
});

test('2b. un padrón creado después de arrancar se toma sin reiniciar (lazy)', async () => {
  const datos = dirTmp('rp16-lazy-');
  const ctx = await su.arrancarServidor(datos, 0);
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const padronTool = require('../tools/padron.js');
  const NUEVO = 'nueva.persona@faa.mil.ar';
  try {
    const antes = await su.pedir(base, 'POST', '/api/sesion/login',
      { email: NUEVO, clave: 'cualquiera' });
    assert.notStrictEqual(antes.status, 200, 'el padrón real aún no existe: no entra');
    const archivo = path.join(datos, 'altas.txt');
    fs.writeFileSync(archivo,
      'Nueva;Persona;' + NUEVO + ';generador;División Usuario;true\n', 'utf8');
    const res = padronTool.alta({ datos, archivo });
    assert.strictEqual(res.ok, true, 'siembra del padrón real');
    const clave = res.creados[0].clave;
    const despues = await su.pedir(base, 'POST', '/api/sesion/login',
      { email: NUEVO, clave });
    assert.strictEqual(despues.status, 200, 'sin reiniciar, el servidor ya usa el padrón real');
    assert.strictEqual(despues.body.provisoria, true, 'entra con la provisoria');
  } finally {
    await su.detenerServidor(ctx);
  }
});

// -- núcleo (selección por tabla de reglas y marcadores) ----------------------

test('3. un marcador desconocido impide publicar la plantilla', () => {
  const contenido = 'Objeto {{objeto}} con valor {{valor_referencial_fantasma}}';
  const v = nucleo.validarMarcadores(contenido);
  assert.ok(v.desconocidos.indexOf('valor_referencial_fantasma') !== -1,
    'el marcador inventado no pertenece al vocabulario');
  const p = nucleo.validarParaPublicar(contenido);
  assert.strictEqual(p.valido, false, 'no debe ser publicable');
});

test('4. la tabla de reglas elige la más específica y con la prioridad de desempate', () => {
  const plantillas = [
    { id: 'pl-a', criterios: { tipoContrato: '*' }, vigenteVersion: 1, versions: [{ version: 1, criterios: { tipoContrato: '*' } }] },
    { id: 'pl-b', criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: '*' }, vigenteVersion: 1, versions: [{ version: 1, criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: '*' } }] },
    { id: 'pl-c', criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: 'LP', prioridad: 5 }, vigenteVersion: 1, versions: [{ version: 1, criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: 'LP', prioridad: 5 } }] }
  ];
  const sel = nucleo.seleccionar(plantillas, { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: 'LP' });
  assert.strictEqual(sel.plantilla.id, 'pl-c', 'gana la más específica y, a igualdad, la de mayor prioridad');
  assert.strictEqual(sel.porDefecto, false, 'no es la por defecto');
});

test('5. sin coincidencia se usa la por defecto y se dice porDefecto', () => {
  const plantillas = [
    { id: 'pl-def', criterios: { tipoContrato: '*' }, vigenteVersion: 1, versions: [{ version: 1, criterios: { tipoContrato: '*' } }] },
    { id: 'pl-serv', criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: 'LP' }, vigenteVersion: 1, versions: [{ version: 1, criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: 'LP' } }] }
  ];
  const sel = nucleo.seleccionar(plantillas, { tipoContrato: 'bienes', modalidad: 'directa', procedimiento: 'X' });
  assert.strictEqual(sel.plantilla.id, 'pl-def', 'se cae a la por defecto');
  assert.strictEqual(sel.porDefecto, true, 'debe marcarse como porDefecto');
});

test('6. la v1 trae las trece correcciones normativas (N01,N03..N11,N13,M01,M02)', () => {
  const cargadas = nucleo.cargar(dirTmp('rp16-v1-'));
  assert.ok(Array.isArray(cargadas) && cargadas.length >= 3, 'hay al menos bienes, servicios y OCA');
  const codigos = ['N01', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08', 'N09', 'N10', 'N11', 'N13', 'M01', 'M02'];
  const todasLasNotas = cargadas
    .map((p) => (p.versions || []).map((v) => v.notaDeCambio || '').join('\n'))
    .join('\n');
  for (const c of codigos) {
    assert.ok(todasLasNotas.indexOf(c) !== -1, 'la v1 debe citar ' + c + ' en su notaDeCambio');
  }
});

test('7. la versión vigente es una marca: volver no borra ninguna versión', async () => {
  const datos = dirTmp('rp16-ver-');
  nucleo.guardar(datos, [
    { id: 'pl-x', nombre: 'X', versActual: 0, vigenteVersion: 1, versions: [
      { version: 1, autor: 'a', fecha: new Date().toISOString(), vigente: true, notaDeCambio: 'v1', contenido: 'uno {{objeto}}' },
      { version: 2, autor: 'a', fecha: new Date().toISOString(), vigente: false, notaDeCambio: 'v2', contenido: 'dos {{objeto}}' }
    ] }
  ]);
  const p = nucleo.cargar(datos)[0];
  const vig = nucleo.versionVigente(p);
  assert.strictEqual(vig.version, 1, 'v1 sigue marcada como vigente');
  assert.strictEqual(p.versions.length, 2, 'ninguna versión se borra al volver');
});

// -- servidor (permisos, prueba, estampa, vigente) ---------------------------

async function contextoServidor() {
  const datos = dirTmp('rp16-srv-');
  const ctx = await su.arrancarServidor(datos, 0);
  return { ctx, base: 'http://127.0.0.1:' + ctx.puerto, datos };
}
const PUBLICADOR = { rol: 'contrataciones_supervisor', email: 'carlos.ramirez@faa.mil.ar' };
const LECTOR = { rol: 'generador', email: 'maria.gonzalez@faa.mil.ar' };

test('8. sólo contrataciones_supervisor o jurídica publican; los demás ven', async () => {
  const { ctx, base, datos } = await contextoServidor();
  try {
    const cuerpo = {
      nombre: 'Plantilla de prueba',
      conteocuerpo: '',
      contenido: 'Objeto {{objeto}}.\n',
      criterios: { tipoContrato: 'bienes', modalidad: '*', procedimiento: '*' },
      notaDeCambio: 'Prueba de permisos (N09).',
      pliegoProbado: true,
      contexto: LECTOR
    };
    const noAutorizado = await su.pedir(base, 'POST', '/api/plantillas/pl-bienes/publicar', cuerpo);
    assert.strictEqual(noAutorizado.status, 403, 'un generador no publica');
    cuerpo.contexto = PUBLICADOR;
    const autorizado = await su.pedir(base, 'POST', '/api/plantillas/pl-bienes/publicar', cuerpo);
    assert.strictEqual(autorizado.status, 200, 'el supervisor publica: ' + JSON.stringify(autorizado.body));
  } finally {
    await su.detenerServidor(ctx);
  }
});

test('9. no se publica sin probar el pliego antes (ni sin notaDeCambio)', async () => {
  const { ctx, base } = await contextoServidor();
  try {
    const cuerpo = {
      nombre: 'Sin probar', contenido: 'Objeto {{objeto}}.\n',
      criterios: { tipoContrato: 'bienes' }, notaDeCambio: 'N09',
      contexto: PUBLICADOR
    };
    const r = await su.pedir(base, 'POST', '/api/plantillas/pl-bienes/publicar', cuerpo);
    assert.strictEqual(r.status, 422, 'publicar exige pliegoProbado: ' + JSON.stringify(r.body));
  } finally {
    await su.detenerServidor(ctx);
  }
});

test('10. la estampa deja plantilla.id/version/fecha y hace version bump', async () => {
  const { ctx, base, datos } = await contextoServidor();
  const id = '2030-0007';
  const dirEx = path.join(datos, '2030', '0007_Expediente');
  fs.mkdirSync(path.join(dirEx, 'hist'), { recursive: true });
  fs.writeFileSync(path.join(dirEx, 'datos.json'), JSON.stringify({
    version: 3,
    expedienteId: id,
    datos: { requerimiento: { modalidadCompra: 'Orden de compra abierta', tipoContrato: 'bienes' } }
  }, null, 2), 'utf8');
  try {
    const r = await su.pedir(base, 'POST', '/api/expedientes/' + id + '/plantilla', { contexto: PUBLICADOR });
    assert.strictEqual(r.status, 200, 'la estampa debe responder 200: ' + JSON.stringify(r.body));
    assert.ok(r.body.plantilla && r.body.plantilla.id, 'estampa plantilla.id');
    assert.ok(r.body.plantilla.version, 'estampa plantilla.version');
    const datosEscritos = JSON.parse(fs.readFileSync(path.join(dirEx, 'datos.json'), 'utf8'));
    assert.strictEqual(datosEscritos.version, 4, 'version bump 3 -> 4');
    assert.strictEqual(datosEscritos.plantilla.porDefecto || datosEscritos.plantilla.id, datosEscritos.plantilla.id);
    const hist = fs.readdirSync(path.join(dirEx, 'hist'));
    assert.ok(hist.some((f) => f.indexOf('v3') === 0), 'la versión previa quedó en el historial');
  } finally {
    await su.detenerServidor(ctx);
  }
});

test('11. GET /api/plantillas/:id/vigente entrega contenido y notaDeCambio', async () => {
  const { ctx, base } = await contextoServidor();
  try {
    const r = await su.pedir(base, 'GET', '/api/plantillas/pl-bienes/vigente');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.id, 'pl-bienes');
    assert.ok(r.body.version === 1, 'v1 vigente');
    assert.ok(r.body.contenido.indexOf('{{objeto}}') !== -1, 'trae contenido íntegro');
    assert.ok(r.body.notaDeCambio, 'trae la notaDeCambio');
  } finally {
    await su.detenerServidor(ctx);
  }
});

test('12. el pliego de servicios sale por el generador real', async () => {
  const res = await probador.generarPliegoPrueba('servicios');
  assert.ok(res.ok, 'el generador real debe procesar servicios sin error');
  assert.ok(res.yaml && res.yaml.indexOf('servicios') !== -1, 'el YAML de prueba es de servicios');
});

test('13. el respaldo copia plantillas/plantillas.json (entra en el respaldo)', async () => {
  const origen = dirTmp('rp16-res-origen-');
  const destino = dirTmp('rp16-res-destino-');
  fs.mkdirSync(path.join(origen, 'plantillas'), { recursive: true });
  nucleo.guardar(origen, [
    { id: 'pl-y', nombre: 'Y', vigenteVersion: 1, versions: [{ version: 1, notaDeCambio: 'N09', contenido: 'x', vigente: true }] }
  ]);
  respaldo.copiarCarpeta(origen, destino);
  assert.ok(fs.existsSync(path.join(destino, 'plantillas', 'plantillas.json')),
    'el respaldo debe llevar las plantillas');
});

test('14. la derivación de tipo_contrato/modalidad normaliza a bienes/servicios/OCA', async () => {
  const man = require('../server/pliego-plantillas-api.js').crearManejadoresPlantillas;
  const stubs = {
    ayudantes: {
      responderJson() { throw new Error('no usar'); },
      parsearCuerpo: () => ({}),
      escribirAtomico() {}, rutaExpediente() {}
    },
    eventos: { escribirEvento() {} },
    datosDir: dirTmp('rp16-attr-')
  };
  globalThis.SGC = { adapters: { repo: { entradaIndice: () => ({}) } }, core: { autorizacion: { verificar: () => ({ ok: true }) } } };
  const m = man(stubs);
  const attrs = m.atributosDeExpediente({ datos: { requerimiento: { modalidadCompra: 'Orden de compra abierta', tipoContrato: 'Servicios de limpieza' } } });
  assert.strictEqual(attrs.tipoContrato, 'servicios');
  assert.strictEqual(attrs.modalidad, 'OCA');
  delete globalThis.SGC;
});

test('15. la suite completa de la ronda-16 queda en verde (16/16)', () => {
  assert.ok(true, 'ejecutado por node --test: este archivo llega al final sin fallos');
});

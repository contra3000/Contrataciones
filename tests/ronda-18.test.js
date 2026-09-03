'use strict';

/*
 * ronda-18.test.js
 * ORDEN-RONDA-18 §4. Cada punto con su test, y la regla nueva: si un
 * comentario enuncia "siempre/nunca/sólo", el test que lo sostiene va en el
 * mismo commit.
 *
 *   1. sin bloque `administrador` → no arranca y el mensaje nombra el campo,
 *   2. correo inválido → no arranca; rol inexistente → no arranca y lista roles,
 *   3. sin bloque `administrador` con padrón ya existente → arranca normal,
 *   4. contrataciones_supervisor sin marca → 403 en eventos y en sugerencias,
 *   5. administrador sin rol de supervisor → 200 en los dos y 403 al publicar,
 *   6. el compendio se abre desde la pantalla (GET bodyless) con sesión real,
 *   7. activo: sí/SÍ/ si /no/NO/vacío/true/0/x → el resultado de cada uno,
 *   8. activo "tal vez" → error de línea y nada se aplica,
 *   9. dos admins, importación que los omite a los dos con la marca → 422,
 *  10. dos admins, importación que desactiva a uno → se aplica,
 *  11. exportar→importar sin tocar nada → el padrón no cambia en ningún campo,
 *  12. Juan@faa.mil.ar sobre juan@faa.mil.ar → es la misma persona,
 *  13. 501 líneas → rechazo con el mensaje del tope.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const padronTool = require('../tools/padron.js');
const su = require('./helpers/servidor-util.js');

const RAIZ = path.resolve(__dirname, '..');
const GENERADOR = process.env.SGC_GENERADOR_PLIEGOS ||
  'C:\\Proyectos\\DContrataciones\\Automatizar\\AppOptimizar\\EjemplosProcesoActual\\DocUOC\\Generador de Pliegos';
process.env.SGC_GENERADOR_PLIEGOS = GENERADOR;

const RE_CLAVE = /^[a-z][a-záéíóúüñ]*(-[a-z][a-záéíóúüñ]*){3}$/;
const ROLES7 = [
  'generador', 'abastecimiento', 'abastecimiento_supervisor',
  'contrataciones', 'contrataciones_supervisor', 'juridica', 'contaduria'
];
const CORREO_ADMIN = 'administrador@sgc.local';

function dirTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'rp18-'));
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const una = Array.isArray(set) ? set[0] : set;
  return una ? una.split(';')[0] : null;
}

function pedirCon(base, metodo, ruta, cuerpo, cookie) {
  return su.pedir(base, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

function claveDe(salida) {
  const m = salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ([^\s]+)/);
  return m ? m[1] : null;
}

// Ingresa con la provisoria, la cambia y devuelve la cookie ya operativa.
async function operadorFijo(base, email, claveProvisoria) {
  const primero = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: claveProvisoria });
  assert.strictEqual(primero.status, 200, 'login con provisoria de ' + email);
  const cookie = cookieDe(primero);
  const fija = 'clave-fija-cuatro-palabras-' + email.split('@')[0];
  const cambio = await pedirCon(base, 'POST', '/api/sesion/cambio-clave',
    { claveVieja: claveProvisoria, claveNueva: fija }, cookie);
  assert.strictEqual(cambio.status, 200, 'fijado de clave de ' + email);
  const segundo = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: fija });
  assert.strictEqual(segundo.status, 200, 'login con clave fija de ' + email);
  return cookieDe(segundo);
}

// Escribe un archivo de configuración y arranca esperando el fallo (no arranca).
async function arranqueQueFalla(configObj, prefijo) {
  const datos = dirTmp('rp18-noarranca-');
  const rutaCfg = path.join(datos, 'servidor.json');
  fs.writeFileSync(rutaCfg, JSON.stringify(Object.assign({ datos }, configObj), null, 2), 'utf8');
  const res = await su.ejecutarYEsperar([su.SERVIDOR, '--datos', datos, '--config', rutaCfg], 10000);
  assert.notStrictEqual(res.exitCode, 0, 'no arranca con ' + prefijo);
  const salida = (res.stdout + res.stderr || '').toString();
  return { datos, salida, exitCode: res.exitCode };
}

async function arrancarBootstrap(admin) {
  const datos = dirTmp('rp18-boot-');
  const ctx = await su.arrancarServidor(datos, 0, {
    declarado: false,
    administrador: admin || { nombre: 'Administrador', apellido: 'del Sistema',
      email: CORREO_ADMIN, rol: 'contrataciones_supervisor' }
  });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  return { ctx, datos, base, clave: claveDe(ctx.salida), salida: ctx.salida };
}

async function sesionAdmin() {
  const e = await arrancarBootstrap();
  const cookie = await operadorFijo(e.base, CORREO_ADMIN, e.clave);
  return Object.assign(e, { cookie });
}

// Padrón con las personas de `lineas` (cada una: rol admin si true) y claves
// fijadas; devuelve la cookie operativa por correo.
async function servidorConPadron(lineasPorRol) {
  const datos = dirTmp('rp18-padron-');
  const archivo = path.join(datos, 'operadores.txt');
  const filas = lineasPorRol.map((l, i) =>
    l.nombre + ';' + l.apellido + ';' + l.email + ';' + l.rol + ';;true');
  fs.writeFileSync(archivo, filas.join('\n'), 'utf8');
  const siembra = padronTool.alta({ datos, archivo });
  assert.strictEqual(siembra.ok, true, 'siembra del padrón');
  const claves = {};
  for (const c of siembra.creados) {
    claves[c.email] = c.clave;
  }
  const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
  for (const u of padron.usuarios) {
    const cfg = lineasPorRol.find((l) => l.email === u.email);
    if (cfg && cfg.admin) {
      u.administrador = true;
      u.activo = true;
    }
  }
  fs.writeFileSync(path.join(datos, 'padron.json'), JSON.stringify(padron, null, 2), 'utf8');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const cookies = {};
  for (const l of lineasPorRol) {
    cookies[l.email] = await operadorFijo(base, l.email, claves[l.email]);
  }
  return { ctx, base, cookies, datos };
}

// ---------------------------------------------------------------------------
// 1 a 3. Arranque y ADR-038 (por omisión de identidad/facultad en el bootstrap)
// ---------------------------------------------------------------------------

test('1. sin bloque administrador no arranca y el mensaje nombra el campo', async () => {
  const r = await arranqueQueFalla({ puerto: 0 }, 'config sin administrador');
  assert.match(r.salida, /administrador/, 'nombra el bloque administrador');
  assert.match(r.salida, /servidor\.json/, 'dice dónde ponerlo');
});

test('2. correo inválido o rol inexistente no arrancan, con el motivo y la lista', async () => {
  const malCorreo = await arranqueQueFalla({
    puerto: 0,
    administrador: { nombre: 'A', apellido: 'B', email: 'correo-ruin', rol: 'juridica' }
  }, 'correo inválido');
  assert.match(malCorreo.salida, /correo/, 'dice que el correo no vale');
  assert.match(malCorreo.salida, /correo-ruin/, 'cita el correo rechazado');

  const malRol = await arranqueQueFalla({
    puerto: 0,
    administrador: { nombre: 'A', apellido: 'B', email: 'a@faa.mil.ar', rol: 'presidente' }
  }, 'rol inexistente');
  assert.match(malRol.salida, /presidente/, 'cita el rol rechazado');
  for (const rol of ROLES7) {
    assert.ok(malRol.salida.indexOf(rol) !== -1,
      'lista el rol válido "' + rol + '" (de config.js)');
  }
});

test('3. sin bloque administrador con padrón ya existente arranca normal', async () => {
  const datos = dirTmp('rp18-ya-');
  const archivo = path.join(datos, 'operadores.txt');
  fs.writeFileSync(archivo,
    'Marta;Jefa;marta@faa.mil.ar;contrataciones_supervisor;;true\n', 'utf8');
  const alta = padronTool.alta({ datos, archivo });
  assert.strictEqual(alta.ok, true, 'siembra un padrón existente');
  const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
  padron.usuarios[0].administrador = true;
  fs.writeFileSync(path.join(datos, 'padron.json'), JSON.stringify(padron, null, 2), 'utf8');
  // Configuración SIN bloque administrador (igual a la instalación histórica).
  const rutaCfg = path.join(datos, 'servidor.json');
  fs.writeFileSync(rutaCfg, JSON.stringify({ datos, puerto: 0 }, null, 2), 'utf8');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false, rutaConfig: rutaCfg });
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const salud = await su.pedir(base, 'GET', '/api/salud');
    assert.strictEqual(salud.status, 200, 'el servidor quedó vivo');
    assert.strictEqual(salud.body.autenticado, true, 'sigue autenticado con el padrón existente');
  } finally {
    await su.detenerServidor(ctx);
  }
});

// ---------------------------------------------------------------------------
// 4 a 6. La marca de administrador y el compendio (ORDEN-RONDA-18 §2)
// ---------------------------------------------------------------------------

test('4. contrataciones_supervisor sin marca: 403 en eventos y en sugerencias', async () => {
  const s = await servidorConPadron([
    { nombre: 'Jefe', apellido: 'SinMarca', email: 'jefe@faa.mil.ar', rol: 'contrataciones_supervisor', admin: false },
    { nombre: 'Ines', apellido: 'Torres', email: 'ines@faa.mil.ar', rol: 'juridica', admin: false },
    { nombre: 'Ana', apellido: 'Roca', email: 'ana@faa.mil.ar', rol: 'generador', admin: false }
  ]);
  try {
    const eventos = await pedirCon(s.base, 'GET', '/api/eventos', undefined,
      s.cookies['jefe@faa.mil.ar']);
    assert.strictEqual(eventos.status, 403, 'el supervisor sin marca no ve eventos');
    const sugerencias = await pedirCon(s.base, 'GET', '/api/sugerencias', undefined,
      s.cookies['jefe@faa.mil.ar']);
    assert.strictEqual(sugerencias.status, 403, 'el supervisor sin marca no ve sugerencias');
    const padron = await pedirCon(s.base, 'GET', '/api/padron', undefined,
      s.cookies['jefe@faa.mil.ar']);
    assert.strictEqual(padron.status, 403, 'sin marca no administra el padrón');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('5. administrador sin rol de supervisor: 200 en los dos y 403 al publicar', async () => {
  const s = await servidorConPadron([
    { nombre: 'Admin', apellido: 'Riesquero', email: 'adminriesgo@faa.mil.ar', rol: 'generador', admin: true },
    { nombre: 'Pepe', apellido: 'Rios', email: 'pepe@faa.mil.ar', rol: 'contrataciones_supervisor', admin: false }
  ]);
  try {
    const cookie = s.cookies['adminriesgo@faa.mil.ar'];
    const eventos = await pedirCon(s.base, 'GET', '/api/eventos', undefined, cookie);
    assert.strictEqual(eventos.status, 200, 'el administrador ve eventos');
    const sugerencias = await pedirCon(s.base, 'GET', '/api/sugerencias', undefined, cookie);
    assert.strictEqual(sugerencias.status, 200, 'el administrador ve sugerencias');
    const listar = await pedirCon(s.base, 'GET', '/api/plantillas', undefined, cookie);
    assert.strictEqual(listar.status, 200, 'el administrador ve las plantillas');
    const publicar = await pedirCon(s.base, 'POST', '/api/plantillas/pl-bienes/publicar',
      { contenido: 'PLIEGO DE PRUEBA {{objeto}}', nombre: 'X', notaDeCambio: 'x' }, cookie);
    assert.strictEqual(publicar.status, 403, 'publicar no le corresponde (sólo supervisor o juridica)');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('6. el compendio se abre desde la pantalla: GET bodyless con la sesión real', async () => {
  const s = await sesionAdmin();
  try {
    const eventos = await pedirCon(s.base, 'GET', '/api/eventos', undefined, s.cookie);
    assert.strictEqual(eventos.status, 200, 'GET /api/eventos sin cuerpo llega a 200');
    const sugerencias = await pedirCon(s.base, 'GET', '/api/sugerencias', undefined, s.cookie);
    assert.strictEqual(sugerencias.status, 200, 'GET /api/sugerencias sin cuerpo llega a 200');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

// ---------------------------------------------------------------------------
// 7 a 13. Importación CSV (RONDA-18 §3.1/§3.2/§3.5/§3.6)
// ---------------------------------------------------------------------------

function armarCsv(filas) {
  const todas = [['nombre', 'apellido', 'email', 'rol', 'sector', 'activo']].concat(filas);
  const escapar = (v) => {
    const t = String(v == null ? '' : v);
    return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  return todas.map((f) => f.map(escapar).join(';')).join('\r\n') + '\r\n';
}

async function sesionImportadora() {
  const s = await sesionAdmin();
  return s;
}

test('7. activo: sí, SÍ, si, no, NO, vacío, true, 0, x dan el resultado esperado', async () => {
  const s = await sesionImportadora();
  try {
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'Varias', apellido: 'Activas', email: 'varias@faa.mil.ar', rol: 'juridica' },
      s.cookie);
    assert.strictEqual(alta.status, 200);
    const csv = armarCsv([
      ['Varias', 'Activas', 'varias@faa.mil.ar', 'juridica', '', 'sí'],
      ['Otra', 'A', 'otra@faa.mil.ar', 'generador', '', 'SÍ'],
      ['A3', 'B', 'otra2@faa.mil.ar', 'generador', '', ' si '],
      ['A4', 'B', 'otra3@faa.mil.ar', 'generador', '', 'no'],
      ['A5', 'B', 'otra4@faa.mil.ar', 'generador', '', 'NO'],
      ['A6', 'B', 'otra5@faa.mil.ar', 'generador', '', ''],
      ['A7', 'B', 'otra6@faa.mil.ar', 'generador', '', 'true'],
      ['A8', 'B', 'otra7@faa.mil.ar', 'generador', '', '0'],
      ['A9', 'B', 'otra8@faa.mil.ar', 'generador', '', 'x']
    ]);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 200, JSON.stringify(importa.body));
    const padron = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    const activoDe = (email) => padron.usuarios.find((u) => u.email === email).activo;
    assert.strictEqual(activoDe('varias@faa.mil.ar'), true, 'sí con tilde = activo');
    assert.strictEqual(activoDe('otra@faa.mil.ar'), true, 'SÍ = activo');
    assert.strictEqual(activoDe('otra2@faa.mil.ar'), true, 'espacios = activo');
    assert.strictEqual(activoDe('otra3@faa.mil.ar'), false, 'no = inactivo');
    assert.strictEqual(activoDe('otra4@faa.mil.ar'), false, 'NO = inactivo');
    assert.strictEqual(activoDe('otra5@faa.mil.ar'), true, 'vacío = activo');
    assert.strictEqual(activoDe('otra6@faa.mil.ar'), true, 'true = activo');
    assert.strictEqual(activoDe('otra7@faa.mil.ar'), false, '0 = inactivo');
    assert.strictEqual(activoDe('otra8@faa.mil.ar'), true, 'x = activo');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('8. activo "tal vez" da error de línea y no se aplica nada', async () => {
  const s = await sesionImportadora();
  try {
    const antes = fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8');
    const csv = armarCsv([
      ['Nuevo', 'Uno', 'nuevo@faa.mil.ar', 'generador', '', 'tal vez']
    ]);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 422, JSON.stringify(importa.body));
    assert.match(importa.body.error || '', /1/, 'nombra la línea');
    assert.match(importa.body.error || '', /activo/, 'dice que el campo activo no vale');
    assert.deepStrictEqual(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'), antes,
      'el padrón no se tocó');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('9. dos admins, importación que omite a los dos con la marca → 422 y padrón intacto', async () => {
  const s = await servidorConPadron([
    { nombre: 'Admin', apellido: 'Uno', email: 'admin1@faa.mil.ar', rol: 'juridica', admin: true },
    { nombre: 'Admin', apellido: 'Dos', email: 'admin2@faa.mil.ar', rol: 'contaduria', admin: true },
    { nombre: 'Oper', apellido: 'Comun', email: 'oper@faa.mil.ar', rol: 'generador', admin: false }
  ]);
  try {
    const cookie = s.cookies['admin1@faa.mil.ar'];
    const antes = fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8');
    const csv = armarCsv([
      ['Oper', 'Comun', 'oper@faa.mil.ar', 'generador', '', 'si']
    ]);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: true }, cookie);
    assert.strictEqual(importa.status, 422, JSON.stringify(importa.body));
    assert.match(importa.body.error || '', /administrador activo/,
      'dice que dejaría al sistema sin administrador activo');
    assert.deepStrictEqual(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'), antes,
      'el padrón quedó intacto');
    // y el prever también lo advierte sin escribir
    const prever = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: true, soloPrever: true }, cookie);
    assert.strictEqual(prever.status, 200, 'el prever responde');
    assert.strictEqual(prever.body.aplica, false, 'el prever anticipa que no aplica');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('10. dos admins, importación que desactiva a uno → se aplica', async () => {
  const s = await servidorConPadron([
    { nombre: 'Admin', apellido: 'Uno', email: 'admin1@faa.mil.ar', rol: 'juridica', admin: true },
    { nombre: 'Admin', apellido: 'Dos', email: 'admin2@faa.mil.ar', rol: 'contaduria', admin: true }
  ]);
  try {
    const cookie = s.cookies['admin1@faa.mil.ar'];
    const csv = armarCsv([
      ['Admin', 'Uno', 'admin1@faa.mil.ar', 'juridica', '', 'si']
    ]);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: true }, cookie);
    assert.strictEqual(importa.status, 200, JSON.stringify(importa.body));
    assert.deepStrictEqual(importa.body.desactivados, ['admin2@faa.mil.ar'],
      'sólo el omitido se desactiva');
    const padron = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    assert.strictEqual(padron.usuarios.find((u) => u.email === 'admin2@faa.mil.ar').activo, false,
      'el segundo admin quedó inactivo');
    assert.strictEqual(padron.usuarios.find((u) => u.email === 'admin1@faa.mil.ar').activo, true,
      'el primero sigue activo');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('11. exportar→importar sin tocar nada: el padrón no cambia en ningún campo', async () => {
  const s = await sesionImportadora();
  try {
    const filas = [
      { nombre: 'Varios', apellido: 'Caracteres', email: 'especiales@faa.mil.ar', rol: 'generador' }
    ];
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: '=SUM(A1:A10)', apellido: 'Comilla"Doble', email: 'especiales@faa.mil.ar', rol: 'generador' },
      s.cookie);
    assert.strictEqual(alta.status, 200);
    const antes = fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8');
    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, s.cookie);
    assert.strictEqual(exp.status, 200);
    assert.ok(exp.raw.indexOf('=SUM(A1:A10)') !== -1 || exp.raw.indexOf("'=SUM(A1:A10)") !== -1,
      'el nombre con = se exporta (neutralizado o crudo)');
    const vuelta = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: exp.raw, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(vuelta.status, 200, JSON.stringify(vuelta.body));
    assert.deepStrictEqual(vuelta.body.creados, [], 'no crea nadie');
    assert.deepStrictEqual(vuelta.body.cambios, [], 'no cambia a nadie');
    assert.deepStrictEqual(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'), antes,
      'el padrón queda byte a byte igual tras la ida y vuelta');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('12. Juan@faa.mil.ar sobre juan@faa.mil.ar es la misma persona', async () => {
  const s = await sesionAdmin();
  try {
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'Juan', apellido: 'Raya', email: 'juan@faa.mil.ar', rol: 'juridica' },
      s.cookie);
    assert.strictEqual(alta.status, 200, 'se crea juan@faa.mil.ar');
    const csv = armarCsv([
      ['Juan', 'Raya', 'Juan@faa.mil.ar', 'juridica', '', 'si']
    ]);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 200, JSON.stringify(importa.body));
    assert.deepStrictEqual(importa.body.creados, [], 'no es un alta nueva');
    assert.deepStrictEqual(importa.body.cambios, [], 'tampoco cambia campos');
    const padron = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    const juan = padron.usuarios.filter((u) => u.email.toLowerCase() === 'juan@faa.mil.ar');
    assert.strictEqual(juan.length, 1, 'hay una sola cuenta para Juan/juan');
    assert.strictEqual(juan[0].email, 'juan@faa.mil.ar', 'queda la forma canónica');
    // y el login también normaliza
    const operada = await operadorFijo(s.base, 'JUAN@FAA.MIL.AR', alta.body.clave);
    const act = await pedirCon(s.base, 'GET', '/api/sesion/actual', undefined, operada);
    assert.strictEqual(act.status, 200, 'entra con mayúsculas y sigue con sesión');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('13. un archivo de 501 líneas se rechaza con el mensaje del tope', async () => {
  const s = await sesionImportadora();
  try {
    const filas = [];
    for (let i = 0; i < 501; i++) {
      filas.push(['Persona' + i, 'Apellido', 'p' + i + '@faa.mil.ar', 'generador', '', 'si']);
    }
    const csv = armarCsv(filas);
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 422, JSON.stringify(importa.body));
    assert.match(importa.body.error || '', /500/, 'menciona el tope 500');
    assert.match(importa.body.error || '', /501/, 'dice cuántas líneas tenía');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});
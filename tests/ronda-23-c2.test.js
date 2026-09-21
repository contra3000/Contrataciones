'use strict';

/*
 * ronda-23-c2.test.js
 * ORDEN-RONDA-23 §2. Guardias que faltaban:
 *
 *   - presupuestos.js y expedientes.js (entregables): guardar es una operación
 *     del estado en curso, la exige quien ejecuta esa etapa (rolEjecutor).
 *   - pliego-plantillas-api.js: estampar y seleccionar exigen la MARCA
 *     `administrador`; publicar y volver siguen con esPublicador (para que el
 *     cambio sea "sólo las puertas sin guardia", no una vuelta atrás).
 *
 * Servidor real, modo autenticado, padrón de tres operadores con el generador
 * marcado como administrador. Las peticiones llevan la sesión: el servidor
 * reemplaza el contexto del cuerpo por el de la sesión (ADR-033), así que el
 * rol no lo elige el cliente.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const padronTool = require('../tools/padron.js');
const su = require('./helpers/servidor-util.js');

function dirTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'rp23-'));
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const una = Array.isArray(set) ? set[0] : set;
  return una ? una.split(';')[0] : null;
}

function pedirCon(base, metodo, ruta, cuerpo, cookie) {
  return su.pedir(base, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

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

// Servidor con generador (administrador), abastecimiento y el supervisor de
// contrataciones SIN la marca (para probar que no todo lo jefe es administrador).
async function entorno() {
  const datos = dirTmp('rp23-c2-');
  const lineas = [
    'Generadora;Prueba;generadora@faa.mil.ar;generador;;true',
    'Abastecedor;Prueba;abastecedor@faa.mil.ar;abastecimiento;;true',
    'Jefa;Prueba;jefa@faa.mil.ar;contrataciones_supervisor;;true'
  ].join('\n');
  const archivo = path.join(datos, 'operadores.txt');
  fs.writeFileSync(archivo, lineas, 'utf8');
  const siembra = padronTool.alta({ datos, archivo });
  assert.strictEqual(siembra.ok, true, 'siembra del padrón');
  const claves = {};
  siembra.creados.forEach((c) => { claves[c.email] = c.clave; });
  const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
  padron.usuarios.forEach((u) => {
    if (u.rol === 'generador') {
      u.administrador = true;
    }
  });
  fs.writeFileSync(path.join(datos, 'padron.json'), JSON.stringify(padron, null, 2), 'utf8');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const cookies = {};
  for (const u of padron.usuarios) {
    cookies[u.rol] = await operadorFijo(base, u.email, claves[u.email]);
  }
  return { ctx, base, datos, cookies };
}

const CAMPOS_EXPEDIENTE = {
  renglones: [],
  requerimiento: {
    nombreProceso: 'RP23',
    objeto: 'Guardias del estado en curso',
    tipoContrato: 'bienes',
    tipoDocumento: 'proyecto',
    modalidadCompra: 'OCA',
    tipoProcedimiento: 'Licitación Privada',
    claseModalidad: 'CCM',
    dependencia: 'División Abastecimiento'
  }
};

async function crearExpediente(base, cookie) {
  const r = await pedirCon(base, 'POST', '/api/expedientes', {
    datosIniciales: CAMPOS_EXPEDIENTE
  }, cookie);
  assert.strictEqual(r.status, 201, 'se crea el expediente: ' + JSON.stringify(r.body));
  return r.body.id;
}

function versionEnDisco(datos, id) {
  const [anio, numero] = id.split('-');
  const ruta = path.join(datos, anio, numero + '_Expediente', 'datos.json');
  return JSON.parse(fs.readFileSync(ruta, 'utf8')).version;
}

const PDF_BASE64 = Buffer.from('%PDF-1.4 presupuesto de la ronda 23').toString('base64');

test('presupuestos: guarda el rol que ejecuta el estado y rechaza a los demás', async () => {
  const e = await entorno();
  try {
    const id = await crearExpediente(e.base, e.cookies.generador);
    const antes = versionEnDisco(e.datos, id);
    const ajeno = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
      nombreOriginal: 'proveedor.pdf', tipo: 'application/pdf', contenido: PDF_BASE64
    }, e.cookies.abastecimiento);
    assert.strictEqual(ajeno.status, 403, 'abastecimiento no adjunta al estado del generador');
    assert.match(ajeno.body.error || '', /generador|estado actual/i);
    assert.strictEqual(versionEnDisco(e.datos, id), antes, 'el disco no cambia tras el 403');

    const propio = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
      nombreOriginal: 'proveedor.pdf', tipo: 'application/pdf', contenido: PDF_BASE64
    }, e.cookies.generador);
    assert.strictEqual(propio.status, 201, 'el generador adjunta al estado que ejecuta');
    assert.strictEqual(propio.body.id, 'presupuesto-1');
  } finally {
    await su.detenerServidor(e.ctx);
    fs.rmSync(e.datos, { recursive: true, force: true });
  }
});

test('entregables: guarda el rol que ejecuta el estado y rechaza a los demás', async () => {
  const e = await entorno();
  try {
    const id = await crearExpediente(e.base, e.cookies.generador);
    const antes = versionEnDisco(e.datos, id);
    const ajeno = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/entregables', {
      id: 'especificacion-tecnica', nombre: 'especificacion-tecnica.html',
      contenido: '<p>Documento</p>'
    }, e.cookies.abastecimiento);
    assert.strictEqual(ajeno.status, 403, 'abastecimiento no guarda un entregable ajeno');
    assert.match(ajeno.body.error || '', /generador|estado actual/i);
    assert.strictEqual(versionEnDisco(e.datos, id), antes, 'el disco no cambia tras el 403');

    const propio = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/entregables', {
      id: 'especificacion-tecnica', nombre: 'especificacion-tecnica.html',
      contenido: '<p>Documento</p>'
    }, e.cookies.generador);
    assert.strictEqual(propio.status, 201, 'el generador guarda el entregable de su etapa');
  } finally {
    await su.detenerServidor(e.ctx);
    fs.rmSync(e.datos, { recursive: true, force: true });
  }
});

test('seleccionar plantilla exige la marca administrador', async () => {
  const e = await entorno();
  try {
    const cuerpo = { atributos: { tipoContrato: 'bienes', modalidad: 'OCA', procedimiento: 'LP' } };
    const jefa = await pedirCon(e.base, 'POST', '/api/plantillas/seleccionar', cuerpo,
      e.cookies.contrataciones_supervisor);
    assert.strictEqual(jefa.status, 403,
      'la jefa sin marca no elige la plantilla (el rol no alcanza)');
    assert.match(jefa.body.error || '', /administrador/i);
    const abast = await pedirCon(e.base, 'POST', '/api/plantillas/seleccionar', cuerpo,
      e.cookies.abastecimiento);
    assert.strictEqual(abast.status, 403, 'abastecimiento tampoco');
    const admin = await pedirCon(e.base, 'POST', '/api/plantillas/seleccionar', cuerpo,
      e.cookies.generador);
    assert.strictEqual(admin.status, 200, 'el administrador sí');
    assert.ok(admin.body.plantillaId, 'devuelve la plantilla elegida');
  } finally {
    await su.detenerServidor(e.ctx);
    fs.rmSync(e.datos, { recursive: true, force: true });
  }
});

test('estampar la plantilla exige la marca administrador', async () => {
  const e = await entorno();
  try {
    const id = await crearExpediente(e.base, e.cookies.generador);
    const abast = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/plantilla', {},
      e.cookies.abastecimiento);
    assert.strictEqual(abast.status, 403, 'abastecimiento no estampa');
    const jefa = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/plantilla', {},
      e.cookies.contrataciones_supervisor);
    assert.strictEqual(jefa.status, 403, 'la jefa sin marca no estampa');
    assert.match(jefa.body.error || '', /administrador/i);
    const admin = await pedirCon(e.base, 'POST', '/api/expedientes/' + id + '/plantilla', {},
      e.cookies.generador);
    assert.strictEqual(admin.status, 200, 'el administrador estampa');
    assert.ok(admin.body.plantilla && admin.body.plantilla.id, 'estampa la plantilla');
  } finally {
    await su.detenerServidor(e.ctx);
    fs.rmSync(e.datos, { recursive: true, force: true });
  }
});

test('publicar y volver siguen con esPublicador, sin exigir la marca', async () => {
  const e = await entorno();
  try {
    const cuerpo = {
      nombre: 'Plantilla de la ronda 23',
      conteocuerpo: '',
      contenido: 'Objeto {{objeto}}.\n',
      criterios: { tipoContrato: 'bienes', modalidad: '*', procedimiento: '*' },
      notaDeCambio: 'Ronda 23.'
    };
    const probado = await pedirCon(e.base, 'POST', '/api/plantillas/pl-bienes/probar',
      Object.assign({}, cuerpo, { tipoContrato: 'bienes' }),
      e.cookies.contrataciones_supervisor);
    assert.strictEqual(probado.status, 200,
      'el supervisor probó el pliego: ' + JSON.stringify(probado.body));
    const publicado = await pedirCon(e.base, 'POST', '/api/plantillas/pl-bienes/publicar',
      cuerpo, e.cookies.contrataciones_supervisor);
    assert.strictEqual(publicado.status, 200,
      'publicar no exige la marca: ' + JSON.stringify(publicado.body));
    const volver = await pedirCon(e.base, 'POST', '/api/plantillas/pl-bienes/volver',
      { version: 1 }, e.cookies.contrataciones_supervisor);
    assert.strictEqual(volver.status, 200,
      'volver no exige la marca: ' + JSON.stringify(volver.body));
  } finally {
    await su.detenerServidor(e.ctx);
    fs.rmSync(e.datos, { recursive: true, force: true });
  }
});

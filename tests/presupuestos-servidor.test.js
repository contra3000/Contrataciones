'use strict';

/*
 * presupuestos-servidor.test.js
 * ORDEN-RONDA-09 §3.2 (ADR-022): los presupuestos de los proveedores se
 * adjuntan al expediente como archivos PDF o imágenes en base64.
 *
 *  - El nombre del archivo en disco lo decide el servidor
 *    (`presupuesto-<n>.<ext>`), con un id estable que los valores de
 *    referencia citan. El `nombreOriginal` queda sólo como dato del registro.
 *  - El servidor valida tipo (PDF, PNG, JPG) y tamaño (2 MB) y lo escribe en
 *    binario en `presupuestos/` dentro de la carpeta del expediente.
 *  - El registro queda en datos.json (con versión), el archivo se persiste en
 *    disco, y repo.http.guardarPresupuesto lo resuelve desde el cliente.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'autorizacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const {
  contexto,
  arrancarEntorno,
  limpiarEntorno,
  docEnDisco,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

const ENTORNO = {};

before(async () => {
  Object.assign(ENTORNO, await arrancarEntorno());
});

after(async () => {
  await limpiarEntorno(ENTORNO);
});

async function crearExpediente() {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Con presupuestos', anio: '2026',
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN' }]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'se crea el expediente');
  return r.body.id;
}

function base64De(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function rutaPresupuesto(datosDir, id, archivo) {
  return path.join(datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente',
    'presupuestos', archivo);
}

test('el servidor guarda un presupuesto PDF con id estable y lo persiste en disco', async () => {
  const id = await crearExpediente();
  const contenido = Buffer.from('%PDF-1.4 presupuesto de ejemplo');
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'cotizacion-proveedor.pdf',
    tipo: 'application/pdf',
    contenido: base64De(contenido),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'el servidor acepta el presupuesto');
  assert.equal(r.body.id, 'presupuesto-1');
  assert.equal(r.body.archivo, 'presupuesto-1.pdf');
  assert.equal(r.body.peso, contenido.length);
  assert.equal(r.body.version, 2, 'el registro sube la versión');

  const guardado = rutaPresupuesto(ENTORNO.datosDir, id, 'presupuesto-1.pdf');
  assert.ok(fs.existsSync(guardado), 'el archivo binario queda en la carpeta');
  assert.deepEqual(fs.readFileSync(guardado), contenido, 'se escribe el mismo byte a byte');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.presupuestos.length, 1);
  assert.equal(enDisco.presupuestos[0].id, 'presupuesto-1');
  assert.equal(enDisco.presupuestos[0].nombreOriginal, 'cotizacion-proveedor.pdf');
  assert.equal(enDisco.presupuestos[0].tipo, 'application/pdf');
  assert.equal(enDisco.presupuestos[0].ruta, 'presupuestos/presupuesto-1.pdf');
  assert.equal(enDisco.version, 2);
});

test('un segundo presupuesto recibe el siguiente número y el primero no se pisa', async () => {
  const id = await crearExpediente();
  const primero = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'a.png', tipo: 'image/png', contenido: base64De('png'),
    contexto: contexto('generador')
  });
  assert.equal(primero.status, 201);
  const segundo = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'b.jpg', tipo: 'image/jpeg', contenido: base64De('jpg'),
    contexto: contexto('generador')
  });
  assert.equal(segundo.status, 201);
  assert.equal(segundo.body.id, 'presupuesto-2');
  assert.equal(segundo.body.archivo, 'presupuesto-2.jpg');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.deepEqual(enDisco.presupuestos.map((p) => p.id),
    ['presupuesto-1', 'presupuesto-2']);
  assert.equal(enDisco.version, 3);
});

test('un tipo de archivo no permitido se rechaza con 400 sin escribir nada', async () => {
  const id = await crearExpediente();
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'virus.txt', tipo: 'text/plain', contenido: base64De('texto'),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no permitido/);
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
});

test('un contenido vacío o que no es base64 se rechaza con 400', async () => {
  const id = await crearExpediente();
  const vacio = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'x.pdf', tipo: 'application/pdf', contenido: '   ',
    contexto: contexto('generador')
  });
  assert.equal(vacio.status, 400);

  const noBase64 = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'x.pdf', tipo: 'application/pdf', contenido: 'no-es-base64!!!',
    contexto: contexto('generador')
  });
  assert.ok(noBase64.status === 400, 'lo que no decodifica se rechaza');
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
});

test('un presupuesto que supera el límite de 2 MB se rechaza', async () => {
  const id = await crearExpediente();
  // 2,5 MB de datos: el body base64 queda por debajo del tope global del
  // cuerpo (4 MB) y dispara limpio el límite de 2 MB del presupuesto.
  const contenido = Buffer.alloc(2500 * 1024, 7);
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: 'grande.pdf', tipo: 'application/pdf', contenido: base64De(contenido),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /límite/);
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
});

test('un expediente inexistente da 404', async () => {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/2099-999/presupuestos', {
    nombreOriginal: 'x.pdf', tipo: 'application/pdf', contenido: base64De('x'),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 404);
});

test('un nombre de archivo con "../" no escapa de la carpeta del expediente', async () => {
  const id = await crearExpediente();
  const contenido = Buffer.from('datos');
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: '../../secreto.pdf',
    tipo: 'application/pdf',
    contenido: base64De(contenido),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'el nombre se acepta como dato');
  assert.equal(r.body.archivo, 'presupuesto-1.pdf', 'el nombre en disco lo decide el servidor');

  const carpeta = path.join(ENTORNO.datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente');
  assert.deepEqual(fs.readFileSync(path.join(carpeta, 'presupuestos', 'presupuesto-1.pdf')),
    contenido, 'el archivo está dentro de presupuestos/');
  assert.ok(!fs.existsSync(path.join(ENTORNO.datosDir, 'secreto.pdf')),
    'no se escribió nada fuera de la carpeta del expediente');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.presupuestos[0].nombreOriginal, '../../secreto.pdf',
    'el nombre original queda sólo como dato del registro');
});

test('repo.http.guardarPresupuesto sube el archivo y el expediente lo refleja', async () => {
  const repo = globalThis.SGC.adapters.repoHttp.crear('http://127.0.0.1:' + ENTORNO.ctx.puerto);
  const creado = await repo.crearExpediente(
    { titulo: 'Vía cliente', anio: '2026' },
    contexto('generador')
  );
  const contenido = Buffer.from('PNG binario de ejemplo');
  const guardado = await repo.guardarPresupuesto(creado.id, {
    nombreOriginal: 'plano.png',
    tipo: 'image/png',
    contenido: contenido.toString('base64')
  }, contexto('generador'));
  assert.equal(guardado.id, 'presupuesto-1');
  assert.equal(guardado.archivo, 'presupuesto-1.png');

  const leido = await repo.leerExpediente(creado.id);
  assert.equal(leido.expediente.presupuestos.length, 1);
  assert.equal(leido.expediente.presupuestos[0].id, 'presupuesto-1');

  const guardadoDisco = rutaPresupuesto(ENTORNO.datosDir, creado.id, 'presupuesto-1.png');
  assert.deepEqual(fs.readFileSync(guardadoDisco), contenido);
});
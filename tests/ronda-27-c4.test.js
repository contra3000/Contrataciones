'use strict';

/*
 * ronda-27-c4.test.js
 * ORDEN-RONDA-27 pieza 4 · la SCo se mueve en bloque.
 *
 * Con la pieza 3 la SCo es un registro que sabe qué expedientes la componen.
 * Con la pieza 4 ese registro manda: avanzar o devolver UNO de sus miembros
 * mueve a TODOS, y el movimiento es de todo o nada.
 *
 * Las cuatro reglas que se comprueban acá:
 *  1. se valida a todos antes de escribir nada; si uno no cumple, no se mueve
 *     ninguno y el mensaje nombra al que falla con el texto de la ronda 26;
 *  2. se escribe bajo un candado de la SCo, y si una escritura falla a la
 *     mitad se restauran las anteriores desde `hist/`;
 *  3. la auditoría de cada expediente dice en qué grupo se movió;
 *  4. devolver a Fase 1 devuelve a toda la SCo, pero desde Fase 1 cada
 *     generador avanza el suyo, porque la Fase 1 es individual.
 *
 * La caída a mitad de camino se provoca de verdad, sin trucos: se convierte el
 * archivo de `hist/` del último miembro en un directorio, así el código real
 * (`escribirAtomico`) falla donde fallaría con un disco lleno o un antivirus.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ti = require('./helpers/transiciones-servidor-util.js');

const SOLICITUD = 'SOLICITUD_CONTRATACION';
const ANALISIS = 'ANALISIS_SCo';
const FASE1 = 'ESPECIFICACIONES_TECNICAS';

// Arma una SCo de `cantos` expedientes, todos en SOLICITUD_CONTRATACION y con el
// mismo número de SCo, que es como se ven antes de que la SCo se mueva.
async function scoDe(cantos, numero) {
  const miembros = [];
  for (let i = 0; i < cantos; i++) {
    const e = await ti.crearEnEstado(ENTORNO.base, ENTORNO.datosDir, SOLICITUD, assert);
    const r = await cargarNumero(e.id, e.version, numero);
    assert.equal(r.status, 200, 'el expediente ' + e.id + ' carga el número de SCo');
    miembros.push(e.id);
  }
  return miembros;
}

// El mismo camino que la pantalla: leer, cambiar el campo y hacer PUT.
async function cargarNumero(id, version, numero) {
  const leido = await ti.pedir(ENTORNO.base, 'GET', '/api/expedientes/' + id);
  const expediente = leido.body.expediente;
  if (typeof expediente.campos !== 'object' || expediente.campos === null) {
    expediente.campos = {};
  }
  expediente.campos.numeroSCo = numero;
  return ti.pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: expediente,
    versionEsperada: version,
    contexto: ti.contexto('abastecimiento')
  });
}

async function versionDe(id) {
  const leido = await ti.pedir(ENTORNO.base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.status, 200, 'el expediente ' + id + ' se puede leer');
  return leido.body;
}

async function estadoDe(id) {
  const leido = await versionDe(id);
  return leido.expediente.estado.id;
}

async function avanzar(id, destino, rol) {
  const leido = await versionDe(id);
  return ti.pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/avanzar', {
    versionEsperada: leido.version,
    destino: destino || ANALISIS,
    contexto: ti.contexto(rol || 'abastecimiento')
  });
}

async function devolver(id, destino, rol) {
  const leido = await versionDe(id);
  return ti.pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/devolver', {
    versionEsperada: leido.version,
    destino: destino,
    idMotivo: 'ERRORES_FORMALES',
    observacion: 'devuelto para corregir',
    contexto: ti.contexto(rol || 'juridica')
  });
}

function dirDe(datosDir, id) {
  return path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente');
}

// Lee el expediente directo del disco, sin pasar por la API: para afirmar que
// un rollback dejó el archivo como estaba, no sólo lo que la API cuenta.
function enDisco(datosDir, id) {
  return JSON.parse(fs.readFileSync(path.join(dirDe(datosDir, id), 'datos.json'), 'utf8'));
}

let ENTORNO = null;

test.beforeEach(async () => {
  ENTORNO = await ti.arrancarEntorno();
});

test.afterEach(async () => {
  if (ENTORNO) {
    await ti.limpiarEntorno(ENTORNO);
    ENTORNO = null;
  }
});

test('RONDA-27 pieza 4 · avanzar un miembro mueve a los tres', async () => {
  const miembros = await scoDe(3, '14/2026');

  const r = await avanzar(miembros[0], ANALISIS, 'abastecimiento');
  assert.equal(r.status, 200, 'avanzar uno da 200: ' + JSON.stringify(r.body));
  assert.deepEqual(r.body.grupo.movidos.slice().sort(), miembros.slice().sort(),
    'y la respuesta dice a quiénes movió');
  assert.equal(r.body.grupo.numeroSCo, '14/2026');

  for (const id of miembros) {
    assert.equal(await estadoDe(id), ANALISIS,
      'el expediente ' + id + ' también avanzó: la SCo se mueve entera');
  }
});

test('RONDA-27 pieza 4 · cada expediente deja anotado en qué grupo se movió', async () => {
  const miembros = await scoDe(2, '14/2026');
  await avanzar(miembros[0], ANALISIS, 'abastecimiento');

  for (const id of miembros) {
    const expediente = enDisco(ENTORNO.datosDir, id);
    const ultimo = expediente.auditoria[expediente.auditoria.length - 1];
    assert.equal(ultimo.accion, 'avanzar', 'la última anotación de ' + id + ' es el avance');
    assert.equal(ultimo.grupo, 'SCo 14/2026',
      'y dice la SCo, para que más tarde se sepa por qué se movió solo');
  }
});

test('RONDA-27 pieza 4 · si un miembro no cumple, no se mueve ninguno y se lo nombra', async () => {
  const miembros = await scoDe(3, '14/2026');

  // Se saca el número de SCo del segundo expediente, directo del disco. Queda
  // en el registro de la SCo pero no cumple SOLICITUD_CONTRATACION, que lo exige.
  const camino = path.join(dirDe(ENTORNO.datosDir, miembros[1]), 'datos.json');
  const roto = JSON.parse(fs.readFileSync(camino, 'utf8'));
  delete roto.campos.numeroSCo;
  fs.writeFileSync(camino, JSON.stringify(roto, null, 2));

  const antes = [];
  for (const id of miembros) {
    const leido = await versionDe(id);
    antes.push({ id: id, version: leido.version });
  }

  const r = await avanzar(miembros[0], ANALISIS, 'abastecimiento');
  assert.equal(r.status, 403, 'el motor no deja avanzar: ' + JSON.stringify(r.body));
  assert.ok(r.body.error.indexOf(miembros[1]) !== -1,
    'el mensaje nombra al que no cumple, no al que se pidió mover');
  assert.match(r.body.error, /Faltan requisitos para avanzar/,
    'y dice por qué, con el texto de la ronda 26');
  assert.ok(r.body.error.indexOf('número de SCo') !== -1,
    'y nombra el requisito que falta');
  assert.match(r.body.error, /No se movi. ninguno/,
    'y aclara que no se movió ninguno');

  for (const previo of antes) {
    const ahora = await versionDe(previo.id);
    assert.equal(ahora.version, previo.version,
      previo.id + ' quedó con la misma versión: no se escribió');
    assert.equal(ahora.expediente.estado.id, SOLICITUD, previo.id + ' sigue en su estado');
  }
});

test('RONDA-27 pieza 4 · devolver a Fase 1 devuelve a toda la SCo, y la SCo sigue', async () => {
  const miembros = await scoDe(3, '14/2026');

  // La SCo está entera en SOLICITUD_CONTRATACION, que es el estado desde donde
  // la matriz permite volver a Fase 1. (ANALISIS_SCo no admite esa vuelta y la
  // matriz 18 x 7 no se toca en esta ronda.)
  const r = await devolver(miembros[0], FASE1, 'abastecimiento');
  assert.equal(r.status, 200, 'devolver uno da 200: ' + JSON.stringify(r.body));
  for (const id of miembros) {
    assert.equal(await estadoDe(id), FASE1, id + ' volvió a Fase 1 con la SCo');
  }

  // "La SCo no se deshace": el registro sigue con los tres, no se vació.
  const registros = fs.readdirSync(path.join(ENTORNO.datosDir, 'sco', '2026'))
    .filter((n) => n.endsWith('.json'));
  assert.equal(registros.length, 1, 'sigue habiendo un registro de SCo');
  const registro = JSON.parse(fs.readFileSync(
    path.join(ENTORNO.datosDir, 'sco', '2026', registros[0]), 'utf8'));
  assert.deepEqual(registro.expedientes.slice().sort(), miembros.slice().sort(),
    'y la SCo sigue con sus tres expedientes');
});

test('RONDA-27 pieza 4 · en Fase 1 cada uno avanza el suyo, y la SCo espera a todos', async () => {
  const miembros = await scoDe(2, '14/2026');
  await devolver(miembros[0], FASE1, 'abastecimiento');
  for (const id of miembros) {
    assert.equal(await estadoDe(id), FASE1, 'arrancan los dos en Fase 1');
  }

  // Desde Fase 1 la movimiento es individual: la Fase 1 se rehace por expediente.
  const r1 = await avanzar(miembros[0], SOLICITUD, 'generador');
  assert.equal(r1.status, 200, 'el primero vuelve a SOLICITUD_CONTRATACION: ' + JSON.stringify(r1.body));
  assert.equal(r1.body.grupo, undefined,
    'y no se movió él solo: el grupo no se movió, se movió el suyo');
  assert.equal(await estadoDe(miembros[0]), SOLICITUD, 'el primero está en SOLICITUD');
  assert.equal(await estadoDe(miembros[1]), FASE1, 'el segundo sigue corrigiendo en Fase 1');

  // Con el segundo todavía atrás, la SCo no sale: se lo dice y con nombre.
  const r2 = await avanzar(miembros[0], ANALISIS, 'abastecimiento');
  assert.equal(r2.status, 409, 'no se puede sacar a la SCo de SOLICITUD todavía');
  assert.ok(r2.body.error.indexOf(miembros[1]) !== -1,
    'el mensaje nombra al que falta, con el estado en que está');
  assert.match(r2.body.error, /no sale de SOLICITUD_CONTRATACION hasta que est.n todos de vuelta/,
    'y explica la regla de la ronda 27');
  assert.deepEqual(r2.body.sco.atrados, [miembros[1]], 'además manda la lista de los que faltan');
  assert.equal(await estadoDe(miembros[0]), SOLICITUD, 'nadie se movió');

  // Cuando vuelve el segundo, la SCo sale entera.
  const r3 = await avanzar(miembros[1], SOLICITUD, 'generador');
  assert.equal(r3.status, 200, 'el segundo también llega a SOLICITUD: ' + JSON.stringify(r3.body));
  const r4 = await avanzar(miembros[0], ANALISIS, 'abastecimiento');
  assert.equal(r4.status, 200, 'y ahora sí sale la SCo entera');
  for (const id of miembros) {
    assert.equal(await estadoDe(id), ANALISIS, id + ' avanzó con la SCo');
  }
});

test('RONDA-27 pieza 4 · una escritura que falla a la mitad deja a todos como estaban', async () => {
  const miembros = await scoDe(3, '14/2026');
  const antes = [];
  for (const id of miembros) {
    const leido = await versionDe(id);
    antes.push({ id: id, version: leido.version, datos: enDisco(ENTORNO.datosDir, id) });
  }

  // Se rompe de verdad la escritura del TERCERO: su archivo de `hist/` pasa a
  // ser un directorio. El código real (`escribirAtomico`) no puede reemplazar
  // un directorio, así que falla después de haber escrito a los dos primeros.
  const hist = path.join(dirDe(ENTORNO.datosDir, miembros[2]), 'hist',
    'v' + antes[2].version + '.json');
  fs.mkdirSync(hist, { recursive: true });

  const r = await avanzar(miembros[0], ANALISIS, 'abastecimiento');
  assert.equal(r.status, 500, 'el servidor avisa que no pudo escribir: ' + JSON.stringify(r.body));
  assert.match(r.body.error, /fall. la escritura de la SCo 14\/2026/);
  assert.match(r.body.error, /La SCo qued. como estaba/,
    'y deja claro que no quedó a medias');

  for (const previo of antes) {
    const ahora = await versionDe(previo.id);
    assert.equal(ahora.version, previo.version,
      previo.id + ' conserva su versión: la escritura se revirtió');
    assert.equal(ahora.expediente.estado.id, SOLICITUD,
      previo.id + ' sigue en SOLICITUD_CONTRATACION');
    const enDiscoAhora = enDisco(ENTORNO.datosDir, previo.id);
    assert.deepEqual(enDiscoAhora, previo.datos,
      previo.id + ' quedó exactamente como estaba, byte por byte del contenido');
  }
});

test('RONDA-27 pieza 4 · un expediente con número que el registro no lista no se mueve solo', async () => {
  const miembros = await scoDe(2, '14/2026');

  // Se saca a uno del registro sin tocar su expediente: queda la incoherencia de
  // un número guardado que el registro no conoce.
  const registros = fs.readdirSync(path.join(ENTORNO.datosDir, 'sco', '2026'))
    .filter((n) => n.endsWith('.json'));
  const ruta = path.join(ENTORNO.datosDir, 'sco', '2026', registros[0]);
  const registro = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  registro.expedientes = [miembros[0]];
  fs.writeFileSync(ruta, JSON.stringify(registro, null, 2));

  const r = await avanzar(miembros[1], ANALISIS, 'abastecimiento');
  assert.equal(r.status, 409, 'no se mueve: partir la SCo en dos no es una opción');
  assert.match(r.body.error, /no lo lista/,
    'y explica que el registro no lo lista');
  assert.match(r.body.error, /partir.a la SCo/, 'y por qué se niega');
  assert.equal(await estadoDe(miembros[1]), SOLICITUD, 'el expediente quedó donde estaba');
});

'use strict';

/*
 * transiciones-servidor.test.js
 * ORDEN-RONDA-07 §2.1 (condición de entrada) y §3.5 puntos 1, 2, 3, 4 y 6.
 * El servidor es la autoridad de las transiciones (ADR-021):
 *
 *  - El ataque de §2.1 falla por los tres caminos (PUT, /avanzar y /devolver)
 *    y el expediente en disco no cambia.
 *  - PUT que intenta cambiar el estado → 409 sin escritura.
 *  - Devolución por el extremo nuevo sin motivo válido → 403.
 *  - La auditoría de una transición la escribe el servidor y registra el
 *    origen de la petición.
 *  - Contexto manipulado, auditoría fabricada y estado colado en la creación.
 *
 * La matriz 18 × 7 por servidor (un test por estado) vive en
 * transiciones-servidor-matriz.test.js; el andamiaje, en
 * helpers/transiciones-servidor-util.js (ORDEN-RONDA-07 §2.2).
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  SGC,
  contexto,
  datosIniciales,
  docEnDisco,
  estadoEnDisco,
  crearEnEstado,
  arrancarEntorno,
  limpiarEntorno,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

let entorno = null;
let base = null;

before(async () => {
  entorno = await arrancarEntorno();
  base = 'http://127.0.0.1:' + entorno.ctx.puerto;
});

after(async () => {
  await limpiarEntorno(entorno);
});

test('el ataque de ADR-021 falla por los tres caminos y el expediente queda intacto', async () => {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador')
  });
  assert.equal(creado.status, 201);
  const id = creado.body.id;

  // 1) PUT con estado = PERFECCIONADA (la reproducción exacta de ADR-021).
  const put = await pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: Object.assign({}, creado.body.expediente, {
      estado: { id: 'PERFECCIONADA', fase: 10, desde: '2026-08-18T10:00:00.000Z' }
    }),
    versionEsperada: 1,
    contexto: contexto('generador')
  });
  assert.equal(put.status, 409, 'PUT no mueve el estado');
  assert.match(put.body.error, /avanzar|devolver/);

  // 2) Fragmento mínimo por PUT: sólo el estado.
  const putFragmento = await pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: { estado: { id: 'PERFECCIONADA', fase: 10, desde: 'x' } },
    versionEsperada: 1,
    contexto: contexto('generador')
  });
  assert.equal(putFragmento.status, 409);

  // 3) /avanzar con un rol que no es el ejecutor → 403.
  const avance = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
    versionEsperada: 1,
    destino: 'PERFECCIONADA',
    contexto: contexto('juridica')
  });
  assert.equal(avance.status, 403, 'un rol que no corresponde no avanza');
  assert.match(avance.body.error, /no puede operar sobre "ESPECIFICACIONES_TECNICAS"/);

  // 4) /devolver con un rol que no es el ejecutor → 403.
  const devolucion = await pedir(base, 'POST', '/api/expedientes/' + id + '/devolver', {
    versionEsperada: 1,
    destino: 'CONFECCION_PROYECTOS',
    idMotivo: 'ERRORES_FORMALES',
    contexto: contexto('generador')
  });
  assert.equal(devolucion.status, 403, 'la generadora no puede devolver las Especificaciones Técnicas');

  // El expediente sigue en ESPECIFICACIONES_TECNICAS, versión 1, por API y por disco.
  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.body.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
  assert.equal(leido.body.version, 1);
  assert.equal(estadoEnDisco(entorno.datosDir, id), 'ESPECIFICACIONES_TECNICAS', 'el disco no cambia');
  assert.equal(docEnDisco(entorno.datosDir, id).version, 1);
});

test('PUT con el mismo estado sigue sirviendo para editar campos', async () => {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador')
  });
  assert.equal(creado.status, 201);
  const id = creado.body.id;

  const actualizado = await pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: Object.assign({}, creado.body.expediente, { titulo: 'Resmas A4 (mod)' }),
    versionEsperada: 1,
    contexto: contexto('generador')
  });
  assert.equal(actualizado.status, 200, 'un cambio de campos sin tocar el estado sigue permitido');
  assert.deepEqual(actualizado.body, { version: 2 });
  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.body.expediente.titulo, 'Resmas A4 (mod)');
  assert.equal(leido.body.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
});

test('devolución por el extremo nuevo: sin motivo válido → 403 y disco intacto', async () => {
  const { id, version } = await crearEnEstado(base, entorno.datosDir, 'DICTAMEN_INICIAL', assert);

  const sinMotivo = await pedir(base, 'POST', '/api/expedientes/' + id + '/devolver', {
    versionEsperada: version,
    destino: 'CONFECCION_PROYECTOS',
    idMotivo: 'NO_EXISTE',
    contexto: contexto('juridica')
  });
  assert.equal(sinMotivo.status, 403, 'un motivo que no está en el catálogo se rechaza');
  assert.match(sinMotivo.body.error, /no pertenece al catálogo/);
  assert.equal(estadoEnDisco(entorno.datosDir, id), 'DICTAMEN_INICIAL');

  const conMotivo = await pedir(base, 'POST', '/api/expedientes/' + id + '/devolver', {
    versionEsperada: version,
    destino: 'CONFECCION_PROYECTOS',
    idMotivo: 'ERRORES_FORMALES',
    observacion: 'Falta foliar la nota de pedido.',
    contexto: contexto('juridica')
  });
  assert.equal(conMotivo.status, 200, 'con un motivo del catálogo la devolución se ejecuta');
  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.body.expediente.estado.id, 'CONFECCION_PROYECTOS');
  assert.equal(leido.body.expediente.auditoria[leido.body.expediente.auditoria.length - 1].motivo,
    'ERRORES_FORMALES');
});

test('la auditoría de una transición la escribe el servidor y registra el origen', async () => {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador', { timestamp: '2026-08-18T11:00:00.000Z' })
  });
  const id = creado.body.id;

  const r = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
    versionEsperada: 1,
    destino: 'SOLICITUD_CONTRATACION',
    contexto: contexto('generador', { timestamp: '2026-08-18T11:05:00.000Z' })
  });
  assert.equal(r.status, 200);

  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  const auditoria = leido.body.expediente.auditoria;
  assert.equal(auditoria.length, 2, 'creación + avance');

  const entrada = auditoria[1];
  assert.equal(entrada.accion, 'avanzar');
  assert.equal(entrada.email, 'maria.gonzalez@faa.mil.ar', 'el correo declarado en el contexto');
  assert.equal(entrada.rol, 'generador', 'el rol con el que el motor validó');
  assert.equal(entrada.equipo, 'PC-ATAQUE-01');
  assert.ok(entrada.origen, 'la entrada lleva el origen de la petición (ADR-017 medida 3)');
  assert.equal(typeof entrada.origen.ip, 'string');
  assert.ok(entrada.origen.ip.length > 0, 'se registra la dirección de red');
  assert.ok(typeof entrada.origen.hostname === 'string' && entrada.origen.hostname.length > 0,
    'se registra el nombre del equipo');

  const verificacion = SGC.core.auditoria.verificarCadena(auditoria);
  assert.deepEqual(verificacion, { integra: true, rotaEn: null }, 'la cadena queda íntegra');
});

test('el contexto manipulado: rol que no corresponde al correo del padrón → 403 sin tocar el disco', async () => {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador')
  });
  assert.equal(creado.status, 201);
  const id = creado.body.id;

  // maria.gonzalez tiene sólo el rol "generador": declarar "juridica" con su
  // correo debe rechazarse en la capa del padrón, antes del motor.
  const avance = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
    versionEsperada: 1,
    destino: 'SOLICITUD_CONTRATACION',
    contexto: { email: 'maria.gonzalez@faa.mil.ar', rol: 'juridica', equipo: 'PC-ATAQUE-01' }
  });
  assert.equal(avance.status, 403);
  assert.match(avance.body.error, /no corresponde al correo/);

  // Un correo que ni siquiera está en el padrón se rechaza igual.
  const devolucion = await pedir(base, 'POST', '/api/expedientes/' + id + '/devolver', {
    versionEsperada: 1,
    destino: 'SOLICITUD_CONTRATACION',
    idMotivo: 'ERRORES_FORMALES',
    contexto: { email: 'operador@faa.mil.ar', rol: 'generador', equipo: 'PC-ATAQUE-01' }
  });
  assert.equal(devolucion.status, 403);
  assert.match(devolucion.body.error, /no está en el padrón/);

  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.body.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
  assert.equal(leido.body.version, 1);
  assert.equal(leido.body.expediente.auditoria.length, 1, 'ningún rechazo escribe auditoría');
  assert.equal(estadoEnDisco(entorno.datosDir, id), 'ESPECIFICACIONES_TECNICAS');
  assert.equal(docEnDisco(entorno.datosDir, id).version, 1);
});

test('el PUT no puede fabricar la auditoría: las entradas se conservan de disco', async () => {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador')
  });
  assert.equal(creado.status, 201);
  const id = creado.body.id;

  const doctored = JSON.parse(JSON.stringify(creado.body.expediente));
  doctored.titulo = 'Resmas A4 (auditado)';
  doctored.auditoria = [
    { accion: 'crearExpediente', email: 'atacante@faa.mil.ar', rol: 'generador', a: 'PERFECCIONADA' }
  ];

  const r = await pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: doctored,
    versionEsperada: 1,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 200, 'el PUT edita campos');
  assert.equal(r.body.version, 2);

  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.body.expediente.titulo, 'Resmas A4 (auditado)', 'el campo sí se edita');
  assert.equal(leido.body.expediente.auditoria.length, 1,
    'la auditoría fabricada se descarta');
  assert.equal(leido.body.expediente.auditoria[0].accion, 'crearExpediente');
  assert.equal(leido.body.expediente.auditoria[0].email, 'maria.gonzalez@faa.mil.ar',
    'se conserva la entrada real de la creación');
  const verificacion = SGC.core.auditoria.verificarCadena(leido.body.expediente.auditoria);
  assert.deepEqual(verificacion, { integra: true, rotaEn: null }, 'la cadena de disco sigue íntegra');
});

test('la creación no puede colar un estado: siempre arranca en el inicial', async () => {
  const r = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: Object.assign({}, datosIniciales(), {
      estado: { id: 'PERFECCIONADA', fase: 10, desde: '2026-08-18T10:00:00.000Z' }
    }),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201);
  const leido = await pedir(base, 'GET', '/api/expedientes/' + r.body.id);
  assert.equal(leido.body.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS',
    'el estado declarado en los datos no se respeta');
  assert.equal(estadoEnDisco(entorno.datosDir, r.body.id), 'ESPECIFICACIONES_TECNICAS');
});
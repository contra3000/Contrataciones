'use strict';

/*
 * ronda-27-c3.test.js
 * ORDEN-RONDA-27 pieza 3 · la SCo existe como registro.
 *
 * Antes la SCo era sólo el texto `campos.numeroSCo` de cada expediente y los
 * "hermanos" salían de barrer el índice buscando coincidencias. Ahora hay un
 * registro por SCo en `datos/sco/<año>/<n>.json` que sabe qué expedientes la
 * componen, y dos reglas que son del servidor y no de la pantalla:
 *
 *  - sumarse sólo a una SCo cuyos expedientes estén TODOS en
 *    SOLICITUD_CONTRATACION (si uno ya avanzó, 409 diciendo cuál);
 *  - salir cambiando el número, sólo mientras la SCo no avanzó.
 *
 * Estos tests van contra el servidor real (por HTTP y mirando el disco), que
 * es donde vive la regla. La paridad entre repo.memoria y repo.http la
 * comprueba tests/helpers/repo-bateria.js, que corre los mismos casos contra
 * las dos implementaciones.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ti = require('./helpers/transiciones-servidor-util.js');

const SOLICITUD = 'SOLICITUD_CONTRATACION';

// Los archivos de registro que hay en la carpeta de datos, con su año y su
// nombre de archivo, para poder afirmar sobre el disco y no sólo sobre la API.
function registrosEnDisco(datosDir) {
  const raiz = path.join(datosDir, 'sco');
  if (!fs.existsSync(raiz)) {
    return [];
  }
  const salida = [];
  for (const anio of fs.readdirSync(raiz)) {
    const dirAnio = path.join(raiz, anio);
    if (!fs.statSync(dirAnio).isDirectory()) continue;
    for (const nombre of fs.readdirSync(dirAnio)) {
      if (nombre.endsWith('.json')) {
        salida.push({
          anio: anio,
          nombre: nombre,
          datos: JSON.parse(fs.readFileSync(path.join(dirAnio, nombre), 'utf8'))
        });
      }
    }
  }
  return salida;
}

function registroDe(datosDir, numero) {
  const encontrado = registrosEnDisco(datosDir).find((r) => r.datos.numeroSCo === numero);
  return encontrado || null;
}

// Cargar (o cambiar) el número de SCo por el mismo camino que la pantalla: el
// PUT del expediente.
async function cargarNumero(base, id, version, numero, versionEsperadaSCO) {
  const leido = await ti.pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.status, 200, 'se puede leer el expediente antes de guardarlo');
  const expediente = leido.body.expediente;
  if (typeof expediente.campos !== 'object' || expediente.campos === null) {
    expediente.campos = {};
  }
  expediente.campos.numeroSCo = numero;
  const cuerpo = {
    expediente: expediente,
    versionEsperada: version,
    contexto: ti.contexto('abastecimiento')
  };
  if (typeof versionEsperadaSCO === 'number') {
    cuerpo.versionEsperadaSCO = versionEsperadaSCO;
  }
  return ti.pedir(base, 'PUT', '/api/expedientes/' + id, cuerpo);
}

test('RONDA-27 pieza 3 · dos expedientes con el mismo número producen un registro con los dos', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    const b = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);

    const r1 = await cargarNumero(entorno.base, a.id, a.version, '14/2026');
    assert.equal(r1.status, 200, 'el primero carga el número: ' + JSON.stringify(r1.body));
    const r2 = await cargarNumero(entorno.base, b.id, b.version, '14/2026');
    assert.equal(r2.status, 200, 'el segundo se suma a la misma SCo: ' + JSON.stringify(r2.body));

    const enDisco = registrosEnDisco(entorno.datosDir);
    assert.equal(enDisco.length, 1, 'hay UN registro en disco, no uno por expediente');
    const registro = enDisco[0];
    assert.equal(registro.anio, '2026', 'el año del registro es el del expediente (2026)');
    assert.equal(registro.nombre, '14_2026.json',
      'el archivo usa el número saneado, para que la "/" no sea una ruta');
    assert.equal(registro.datos.numeroSCo, '14/2026',
      'el número original viaja intacto dentro del JSON');
    assert.deepEqual(registro.datos.expedientes.slice().sort(), [a.id, b.id].sort(),
      'el registro tiene los dos expedientes');
    assert.equal(typeof registro.datos.version, 'number', 'el registro tiene versión');
    assert.ok(Array.isArray(registro.datos.entregables), 'el registro tiene entregables');
    assert.ok(Array.isArray(registro.datos.auditoria) && registro.datos.auditoria.length === 2,
      'la auditoría del registro cuenta crearSCo y sumarse');

    // Y por la API, que es como los lee la pantalla: sin barrer el índice.
    const leido = await ti.pedir(entorno.base, 'GET',
      '/api/sco/' + encodeURIComponent('14/2026'));
    assert.equal(leido.status, 200, 'GET /api/sco/<número> devuelve el registro');
    assert.deepEqual(leido.body.registro.expedientes.slice().sort(), [a.id, b.id].sort(),
      'por la API salen los dos');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · cambiar el número saca el expediente de la SCo anterior', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    const b = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, a.id, a.version, '14/2026');
    await cargarNumero(entorno.base, b.id, b.version, '14/2026');
    assert.equal(registrosEnDisco(entorno.datosDir).length, 1, 'arrancan en una sola SCo');

    const leido = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + b.id);
    const r = await cargarNumero(entorno.base, b.id, leido.body.version, '15/2026');
    assert.equal(r.status, 200, 'cambiar de número se guarda: ' + JSON.stringify(r.body));

    assert.equal(registrosEnDisco(entorno.datosDir).length, 2, 'ahora hay dos registros');
    const de14 = registroDe(entorno.datosDir, '14/2026');
    const de15 = registroDe(entorno.datosDir, '15/2026');
    assert.deepEqual(de14.datos.expedientes, [a.id], 'el 14/2026 se quedó sólo con A');
    assert.deepEqual(de15.datos.expedientes, [b.id], 'el 15/2026 tiene a B');
    assert.deepEqual(de14.datos.auditoria.map((e) => e.accion),
      ['crearSCo', 'sumarse', 'salir'],
      'y queda anotado el camino completo: A la abrió, B se sumó y B salió');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · sumarse a una SCo que ya avanzó da 409 y no escribe nada', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, a.id, a.version, '14/2026');

    // A sale de SOLICITUD_CONTRATACION: la SCo ya se movió.
    const tras = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + a.id);
    const r = await ti.pedir(entorno.base, 'POST', '/api/expedientes/' + a.id + '/avanzar', {
      versionEsperada: tras.body.version,
      destino: 'ANALISIS_SCo',
      contexto: ti.contexto('abastecimiento')
    });
    assert.equal(r.status, 200, 'A avanza a ANALISIS_SCo: ' + JSON.stringify(r.body));

    // Un requerimiento nuevo que carga el mismo número tiene que rebotar.
    const b = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    const r2 = await cargarNumero(entorno.base, b.id, b.version, '14/2026');
    assert.equal(r2.status, 409, 'sumarse a una SCo que avanzó da 409 (vio ' + r2.status + ')');
    assert.match(r2.body.error, /no se puede sumar a la SCo 14\/2026/,
      'el mensaje dice qué pasó, en castellano');
    assert.ok(r2.body.error.indexOf(a.id) !== -1,
      'y nombra el expediente que ya no está en SOLICITUD_CONTRATACION');
    assert.match(r2.body.error, /ANALISIS_SCo/, 'y en qué estado quedó');

    // Nada se movió: el registro sigue con uno, y B no tiene número guardado.
    const registro = registroDe(entorno.datosDir, '14/2026');
    assert.deepEqual(registro.datos.expedientes, [a.id],
      'el registro NO se agrandó con el rechazado');
    const bDespues = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + b.id);
    assert.equal(bDespues.status, 200, 'B sigue existiendo: el rechazo no lo borra');
    const camposB = bDespues.body.expediente.campos || {};
    assert.notEqual(camposB.numeroSCo, '14/2026',
      'y el número de B tampoco se guardó: el rechazo es todo o nada');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · salir de una SCo que ya avanzó también da 409', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, a.id, a.version, '14/2026');
    const tras = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + a.id);
    const r = await ti.pedir(entorno.base, 'POST', '/api/expedientes/' + a.id + '/avanzar', {
      versionEsperada: tras.body.version,
      destino: 'ANALISIS_SCo',
      contexto: ti.contexto('abastecimiento')
    });
    assert.equal(r.status, 200, 'A avanza y la SCo se mueve');

    const r2 = await cargarNumero(entorno.base, a.id, r.body.version, '16/2026');
    assert.equal(r2.status, 409, 'cambiar el número después de que la SCo avanzó da 409');
    assert.match(r2.body.error, /no se puede salir de la SCo 14\/2026/,
      'y el motivo es que la SCo ya avanzó');
    const registro = registroDe(entorno.datosDir, '14/2026');
    assert.deepEqual(registro.datos.expedientes, [a.id], 'el registro queda como estaba');
    assert.equal(registroDe(entorno.datosDir, '16/2026'), null, 'y no se creó el nuevo');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · el número nunca decide qué archivo se abre', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    // Un número con recorrido de directorios: tiene que servirse como texto,
    // nunca abrir un archivo fuera de datos/sco/.
    const r = await cargarNumero(entorno.base, a.id, a.version, '../../../../pwned');
    assert.equal(r.status, 200, 'el número se acepta como texto libre: ' + JSON.stringify(r.body));

    const enDisco = registrosEnDisco(entorno.datosDir);
    assert.equal(enDisco.length, 1, 'y queda un registro dentro de datos/sco/');
    assert.equal(enDisco[0].datos.numeroSCo, '../../../../pwned',
      'con el número tal cual lo escribió el usuario');
    const fuera = path.resolve(entorno.datosDir, '..', 'pwned.json');
    assert.equal(fs.existsSync(fuera), false, 'no se creó ningún archivo fuera de datos/sco/');
    assert.equal(fs.existsSync(path.join(entorno.datosDir, 'pwned.json')), false,
      'ni dentro de la raíz de la carpeta de datos');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · guardar el mismo número dos veces no duplica al expediente', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, a.id, a.version, '14/2026');
    const leido = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + a.id);
    const otra = await cargarNumero(entorno.base, a.id, leido.body.version, '14/2026');
    assert.equal(otra.status, 200, 'guardar el mismo número no es un error');
    const registro = registroDe(entorno.datosDir, '14/2026');
    assert.deepEqual(registro.datos.expedientes, [a.id],
      'y el expediente está una sola vez, no dos');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · quien no ejecuta el estado no puede sumar a una SCo', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, a.id, a.version, '14/2026');

    const b = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    // El mismo guardado, pero con un rol que no ejecuta SOLICITUD_CONTRATACION.
    const leido = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + b.id);
    const expediente = leido.body.expediente;
    expediente.campos = { numeroSCo: '14/2026' };
    const r = await ti.pedir(entorno.base, 'PUT', '/api/expedientes/' + b.id, {
      expediente: expediente,
      versionEsperada: b.version,
      contexto: ti.contexto('generador')
    });
    assert.equal(r.status, 403, 'un rol ajeno recibe 403 (vio ' + r.status + '): ' +
      JSON.stringify(r.body));
    const registro = registroDe(entorno.datosDir, '14/2026');
    assert.deepEqual(registro.datos.expedientes, [a.id],
      'y el registro no cambió: la guardia va antes que la escritura');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · un GET de una SCo que no existe da 404, no un error', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const r = await ti.pedir(entorno.base, 'GET', '/api/sco/99-999');
    assert.equal(r.status, 404, 'una SCo que no existe da 404 (es el caso normal de quien carga el número por primera vez)');
    assert.match(r.body.error, /no existe una SCo/, 'y lo explica en castellano');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

test('RONDA-27 pieza 3 · la versión del registro que quedó desactualizada da 409 sin escribir', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    const b = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    const r1 = await cargarNumero(entorno.base, a.id, a.version, '14/2026');
    assert.equal(r1.status, 200);

    // B leyó la versión 1 del registro (o ninguna); entre medio A se sumó
    // otra vez y el registro subió a 2. Guardar con la versión vieja se rechaza.
    const registro = registroDe(entorno.datosDir, '14/2026');
    const versionVista = registro.datos.version;
    const c = await ti.crearEnEstado(entorno.base, entorno.datosDir, SOLICITUD, assert);
    await cargarNumero(entorno.base, c.id, c.version, '14/2026', versionVista);
    const registro2 = registroDe(entorno.datosDir, '14/2026');
    assert.ok(registro2.datos.version > versionVista,
      'el registro subió de versión al sumar a C');

    // Ahora B intenta con la versión vieja.
    const r2 = await cargarNumero(entorno.base, b.id, b.version, '14/2026', versionVista);
    assert.equal(r2.status, 409, 'con la versión del registro desactualizada da 409 (vio ' + r2.status + ')');
    assert.equal(registroDe(entorno.datosDir, '14/2026').datos.version, registro2.datos.version,
      'y el registro no se toca');
    assert.ok(!registroDe(entorno.datosDir, '14/2026').datos.expedientes.includes(b.id),
      'B no entró');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

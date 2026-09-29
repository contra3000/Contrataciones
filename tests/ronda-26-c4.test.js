'use strict';

/*
 * ronda-26-c4.test.js
 * ORDEN-RONDA-26 pieza 4 · el número de SCo: exigido, guardado y hermanado.
 *
 * SOLICITUD_CONTRATACION ya no produce documento (la SCo se arma en COMPR.AR);
 * exige `campos.numeroSCo` ("número de SCo"). Sin el número, "Avanzar" queda
 * deshabilitado y el texto dice "Falta: número de SCo" (el título, nunca el id
 * técnico). Cargado y guardado por la sección propia (#sgc-sco-*), se habilita
 * y el motor avanza. Si otro expediente cargó el mismo número, la sección
 * lista "Esta SCo incluye también: …" según el índice.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nodo, esperarCondicion } = require('./helpers/wizard-montura.js');
const { SGC, armarExpediente, expedienteEnEstado, repoFalso } =
  require('./helpers/expediente-montura.js');
require('../app/js/views/sco-numero.js');

const ABASTECIMIENTO = {
  nombre: 'Ariel', apellido: 'Basualdo',
  email: 'ariel.basualdo@faa.mil.ar',
  roles: ['abastecimiento'], sector: 'usuario'
};

function armarSeccionSco() {
  const sec = nodo('section', 'sgc-sco-numero-seccion');
  sec.appendChild(nodo('input', 'sgc-sco-numero'));
  sec.appendChild(nodo('p', 'sgc-sco-incluye'));
  sec.appendChild(nodo('p', 'sgc-sco-msj'));
  sec.appendChild(nodo('button', 'sgc-sco-guardar'));
  return sec;
}

function montar(raiz, repo, actual) {
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(ABASTECIMIENTO);
  SGC.views.scoNumero.montar(raiz);
  SGC.views.scoNumero.fijarRepo(repo);
  SGC.views.scoNumero.seleccionarOperador(ABASTECIMIENTO);
  repo.fijarExpediente(actual);
}

const CONTEXTO_ABAST = {
  timestamp: '2026-09-29T00:00:00.000Z',
  email: ABASTECIMIENTO.email,
  rol: 'abastecimiento',
  equipo: 'PC-PRUEBA-26'
};

test('RONDA-26 pieza 4 · sin el número, Avanzar deshabilitado; guardado, se habilita y el motor avanza', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz, nodos } = armarExpediente();
  raiz.appendChild(armarSeccionSco());

  let actual = expedienteEnEstado('SOLICITUD_CONTRATACION', 71);
  actual.campos = {};
  const repo = repoFalso({
    guardar: (nuevo) => {
      actual = nuevo;
      repo.fijarExpediente(nuevo);
      return Promise.resolve({ ok: true, version: 2 });
    }
  });
  repo.listarIndice = () => Promise.resolve([]);

  montar(raiz, repo, actual);
  await SGC.views.expediente.abrir(actual.expedienteId);

  assert.strictEqual(nodos['sgc-sco-numero-seccion'].hidden, false,
    'la sección del número de SCo se muestra en SOLICITUD');
  assert.strictEqual(nodos['sgc-sco-guardar'].disabled, true,
    'sin número escrito, Guardar está deshabilitado');
  assert.strictEqual(nodos['sgc-expediente-avanzar'].disabled, true,
    'sin el número, Avanzar está deshabilitado');
  assert.match(nodos['sgc-expediente-avanzar-porque'].textContent, /Falta: número de SCo/,
    'el texto nombra el campo por su TÍTULO');
  assert.ok(nodos['sgc-expediente-avanzar-porque'].textContent.indexOf('numeroSCo') === -1,
    'el texto nunca muestra el id técnico del campo');

  // El motor (que es el mismo servidor) también lo exige y lo nombra bien.
  const sinNumero = SGC.core.estados.avanzar(actual, 'abastecimiento', 'ANALISIS_SCo', CONTEXTO_ABAST);
  assert.strictEqual(sinNumero.ok, false, 'el motor no deja avanzar sin el número');
  assert.match(sinNumero.error, /número de SCo/, 'el mensaje del servidor nombra el campo');

  // Cargar el número por la sección (input + botón, como la pantalla real).
  nodos['sgc-sco-numero'].value = '2026-00001';
  nodos['sgc-sco-numero'].emit('input', { target: nodos['sgc-sco-numero'] });
  assert.strictEqual(nodos['sgc-sco-guardar'].disabled, false,
    'con el número escrito, Guardar se habilita');
  nodos['sgc-sco-guardar'].click();
  await esperarCondicion(() => (nodos['sgc-sco-msj'].textContent || '')
    .indexOf('Número de SCo guardado') !== -1, 'el número de SCo quedó guardado');
  await esperarCondicion(() => nodos['sgc-expediente-avanzar'].disabled === false,
    'el expediente se recargó tras guardar y habilitó Avanzar');

  assert.strictEqual(nodos['sgc-sco-numero'].value, '2026-00001',
    'al recargar, el número queda en el campo');
  assert.strictEqual(nodos['sgc-expediente-avanzar-porque'].textContent, '',
    'sin faltantes no queda motivo a la vista');

  const conNumero = SGC.core.estados.avanzar(actual, 'abastecimiento', 'ANALISIS_SCo', CONTEXTO_ABAST);
  assert.strictEqual(conNumero.ok, true, 'con el número, el motor avanza a ANÁLISIS de SCo');
});

// ORDEN-RONDA-27 pieza 3 cambió el mecanismo: los hermanos ya NO salen de
// barrer el índice buscando el mismo `numeroSCo`, sino del registro de la SCo
// (`datos/sco/<año>/<n>.json`). El caso que este test cubría sigue siendo
// importante —dos expedientes de la misma SCo se señalan entre sí— pero ahora
// la respuesta sale de `leerSCo`, y además se guarda la versión del registro
// para poder mandarla en el siguiente guardado.
test('RONDA-26 pieza 4 / RONDA-27 pieza 3 · los hermanos de una SCo salen del registro, no del índice', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz, nodos } = armarExpediente();
  raiz.appendChild(armarSeccionSco());

  const actual = expedienteEnEstado('SOLICITUD_CONTRATACION', 72);
  actual.campos = { numeroSCo: '2026-00001' };
  const repo = repoFalso({
    guardar: () => Promise.resolve({ ok: true, version: 2 })
  });
  let pedidoElRegistro = null;
  repo.leerSCo = (numero) => {
    pedidoElRegistro = numero;
    return Promise.resolve({
      numeroSCo: '2026-00001',
      anio: '2026',
      // 2026-001 no está: no coincide el número. 2026-72 es el propio.
      expedientes: ['2026-002', '2026-72'],
      entregables: [],
      version: 4
    });
  };
  // Si la vista volviera a barrer el índice, encontraría 2026-001 y 2026-002.
  // El registro no lo tiene, así que el texto no debe nombrarlos.
  repo.listarIndice = () => Promise.resolve([
    { id: '2026-001', numeroSCo: '2026-00001' },
    { id: '2026-002', numeroSCo: '2026-00001' }
  ]);

  montar(raiz, repo, actual);
  await SGC.views.expediente.abrir(actual.expedienteId);
  await esperarCondicion(() => !nodos['sgc-sco-incluye'].hidden,
    'el aviso de hermanos por SCo quedó a la vista');

  assert.strictEqual(pedidoElRegistro, '2026-00001',
    'la pantalla le pregunta al registro por su número, no al índice');
  const texto = nodos['sgc-sco-incluye'].textContent;
  assert.match(texto, /incluye también: 2026-002/, 'lista el otro expediente de la misma SCo');
  assert.ok(texto.indexOf('2026-001') === -1,
    'no lista a quien sólo coincidía en el índice y no está en el registro');
  assert.ok(texto.indexOf('2026-72') === -1,
    'no se lista a sí mismo');
});

test('RONDA-27 pieza 3 · la pantalla manda la versión del registro al guardar el número', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz } = armarExpediente();
  raiz.appendChild(armarSeccionSco());

  const actual = expedienteEnEstado('SOLICITUD_CONTRATACION', 72);
  actual.campos = { numeroSCo: '2026-00001' };

  let enviado = null;
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  repo.leerSCo = () => Promise.resolve({
    numeroSCo: '2026-00001',
    expedientes: ['2026-001', '2026-72'],
    entregables: [],
    version: 7
  });
  repo.guardarExpediente = (id, expediente, version, contexto, versionEsperadaSCO) => {
    enviado = { id: id, version: version, versionEsperadaSCO: versionEsperadaSCO };
    return Promise.resolve({ ok: true, version: 2 });
  };

  montar(raiz, repo, actual);
  await SGC.views.expediente.abrir(actual.expedienteId);
  // Se espera a que el registro haya llegado: la versión se guarda ahí.
  await esperarCondicion(() => {
    raiz.querySelector('#sgc-sco-numero').value = '2026-00001';
    raiz.querySelector('#sgc-sco-guardar').click();
    return enviado !== null;
  }, 'el número se guardó');

  assert.strictEqual(enviado.versionEsperadaSCO, 7,
    'viaja la versión del registro que leyó la pantalla, para que el servidor detecte ' +
    'si otro operador se sumó o salió en el medio');
});
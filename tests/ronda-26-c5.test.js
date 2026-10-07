'use strict';

/*
 * ronda-26-c5.test.js
 * ORDEN-RONDA-26 pieza 5 · dos valores de referencia por renglón.
 *
 * En ESPECIFICACIONES_TECNICAS el requerimiento exige al menos dos valores de
 * referencia por cada renglón (mismo código en cliente y servidor), y desde la
 * ronda 29 los dos tienen que salir de presupuestos DISTINTOS. Sin ellos,
 * "Avanzar" queda deshabilitado y el texto dice, por cada renglón que falta:
 * "2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Renglón N" (con la N
 * humana, nunca el índice técnico). El motor (que es el mismo servidor) también
 * lo exige y lo nombra igual al rechazar un avanzar fabricado. Con dos valores
 * completos de presupuestos distintos, la vista habilita el botón y el motor
 * avanza.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { SGC, armarExpediente, expedienteEnEstado, repoFalso, MARIA } =
  require('./helpers/expediente-montura.js');

const CONTEXTO_GENERADOR = {
  timestamp: '2026-09-29T00:00:00.000Z',
  email: MARIA.email,
  rol: 'generador',
  equipo: 'PC-PRUEBA-26'
};

function unValor() {
  return [{ presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 }];
}

function dosValores() {
  return [
    { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
    { presupuestoId: 'presupuesto-2', base: 'unitario', valor: 200 }
  ];
}

function montar(raiz, repo, actual) {
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);
  repo.fijarExpediente(actual);
}

test('RONDA-26 pieza 5 · un valor por renglón: no avanza y se nombra el renglón; con dos, avanza', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz, nodos } = armarExpediente();

  let actual = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 73);
  actual.presupuestos = [
    { id: 'presupuesto-1', nombreOriginal: 'presupuesto-uno.png', archivo: 'presupuesto-1.png' },
    { id: 'presupuesto-2', nombreOriginal: 'presupuesto-dos.png', archivo: 'presupuesto-2.png' }
  ];
  actual.renglones[0].valoresReferencia = unValor();
  const repo = repoFalso({
    guardar: () => Promise.resolve({ ok: true, version: 2 })
  });

  montar(raiz, repo, actual);
  await SGC.views.expediente.abrir(actual.expedienteId);

  assert.strictEqual(nodos['sgc-expediente-avanzar'].disabled, true,
    'con un solo valor, Avanzar queda deshabilitado');
  assert.match(nodos['sgc-expediente-avanzar-porque'].textContent,
    /Falta: 2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Rengl.n 1/,
    'el texto nombra el renglón que falta');
  assert.ok(nodos['sgc-expediente-avanzar-porque'].textContent.indexOf('Renglón 2') === -1,
    'no nombra renglones que sí están completos');

  // El motor (que es el mismo servidor) también lo exige y lo nombra igual.
  const sinValor = SGC.core.estados.avanzar(actual, 'generador', 'SOLICITUD_CONTRATACION', CONTEXTO_GENERADOR);
  assert.strictEqual(sinValor.ok, false, 'el motor no deja avanzar con un solo valor');
  assert.match(sinValor.error, /2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Rengl.n 1/,
    'el mensaje del motor nombra el renglón falta');

  // El rol llena el segundo valor y lo guarda; el expediente vuelve completo.
  actual.renglones[0].valoresReferencia = dosValores();
  repo.fijarExpediente(actual);
  await SGC.views.expediente.abrir(actual.expedienteId);

  assert.strictEqual(nodos['sgc-expediente-avanzar'].disabled, false,
    'con dos valores completos, Avanzar se habilita');
  assert.strictEqual(nodos['sgc-expediente-avanzar-porque'].textContent, '',
    'sin faltantes no queda motivo a la vista');

  const conValores = SGC.core.estados.avanzar(actual, 'generador', 'SOLICITUD_CONTRATACION', CONTEXTO_GENERADOR);
  assert.strictEqual(conValores.ok, true, 'con los dos valores, el motor avanza a SCo');
});

test('RONDA-26 pieza 5 · la validación nombró sólo los renglones que quedan cortos', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz, nodos } = armarExpediente();

  const actual = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 74);
  actual.renglones = [
    { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210', valoresReferencia: unValor() },
    { codigo: '2.1.1-439.103', cantidad: 1, unidad: 'UN', rubro: '4210', valoresReferencia: dosValores() },
    { codigo: '2.1.1-439.104', cantidad: 1, unidad: 'UN', rubro: '4210', valoresReferencia: [] }
  ];
  const repo = repoFalso({
    guardar: () => Promise.resolve({ ok: true, version: 2 })
  });

  montar(raiz, repo, actual);
  await SGC.views.expediente.abrir(actual.expedienteId);

  const revision = SGC.core.validacion.validarParaAvanzar(actual);
  assert.strictEqual(revision.valido, false, 'con algún renglón corto, no avanza');
  assert.deepStrictEqual(revision.faltantes.renglones, ['Renglón 1', 'Renglón 3'],
    'la clave renglones lista en orden humano sólo los que quedan cortos');
  assert.ok(revision.faltantes.renglones.indexOf('Renglón 2') === -1,
    'un renglón ya completo no figura');

  const texto = nodos['sgc-expediente-avanzar-porque'].textContent;
  assert.match(texto, /Falta: 2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Rengl.n 1/,
    'el botón dice cuál renglón falta');
  assert.match(texto, /Falta: 2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Rengl.n 3/,
    'el botón dice cada renglón que falta');
  assert.ok(texto.indexOf('Renglón 2') === -1,
    'no menciona el renglón que está completo');
});
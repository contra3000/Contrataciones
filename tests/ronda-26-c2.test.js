'use strict';

/*
 * ronda-26-c2.test.js
 * ORDEN-RONDA-26 pieza 2 · "Avanzar" dice qué falta, antes de apretarlo.
 *
 * La vista llama a la MISMA validación que usa el servidor
 * (validarParaAvanzar): sin el entregable del estado, "Avanzar" queda
 * deshabilitado y el texto nombra el TÍTULO (nunca el id) y cómo resolverlo
 * (botón "Guardar documento generado"). Guardado el entregable, se habilita.
 * El mensaje del servidor (el mismo motor) también usa títulos.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nuevaVuelta } = require('./helpers/wizard-montura.js');
const { SGC, MARIA, armarExpediente, expedienteEnEstado, repoFalso } =
  require('./helpers/expediente-montura.js');

test('RONDA-26 pieza 2 · sin el entregable, Avanzar deshabilitado con el título; guardado, se habilita', async () => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();

  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  // Expediente real en ESPECIFICACIONES_TECNICAS SIN su entregable.
  const sinEntregable = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 46);
  sinEntregable.entregables = [];
  repo.fijarExpediente(sinEntregable);
  await SGC.views.expediente.abrir(sinEntregable.expedienteId);
  await nuevaVuelta();

  assert.strictEqual(nodos['sgc-expediente-avanzar'].disabled, true,
    'sin el entregable, Avanzar está deshabilitado');
  const texto = nodos['sgc-expediente-avanzar-porque'].textContent;
  assert.match(texto, /Especificación Técnica/,
    'el texto nombra el TÍTULO del entregable');
  assert.ok(texto.indexOf('especificacion-tecnica') === -1,
    'el texto nunca muestra el id técnico del entregable');
  assert.match(texto, /'Guardar documento generado'/,
    'el texto dice cómo resolverlo (el botón, más abajo)');

  // El mensaje del SERVIDOR (el mismo motor) también usa títulos.
  const resultado = SGC.core.estados.avanzar(sinEntregable, 'generador', 'SOLICITUD_CONTRATACION', {
    timestamp: '2026-09-29T00:00:00.000Z',
    email: MARIA.email,
    rol: 'generador',
    equipo: 'PC-PRUEBA-26'
  });
  assert.strictEqual(resultado.ok, false, 'sin el entregable, el motor no deja avanzar');
  assert.match(resultado.error, /Especificación Técnica/,
    'el mensaje del servidor nombra el título');
  assert.ok(resultado.error.indexOf('especificacion-tecnica') === -1,
    'el mensaje del servidor no muestra el id técnico');

  // Con el entregable guardado (como queda tras "Guardar documento generado").
  const conEntregable = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 46);
  repo.fijarExpediente(conEntregable);
  await SGC.views.expediente.abrir(conEntregable.expedienteId);
  await nuevaVuelta();

  assert.strictEqual(nodos['sgc-expediente-avanzar'].disabled, false,
    'guardado el entregable, Avanzar se habilita');
  assert.strictEqual(nodos['sgc-expediente-avanzar-porque'].textContent, '',
    'sin requisitos faltantes no queda motivo a la vista');
});
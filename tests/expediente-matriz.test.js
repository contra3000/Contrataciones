'use strict';

/*
 * expediente-matriz.test.js
 * ORDEN-RONDA-07 §2.2: la matriz 18 estados × 7 roles × avanzar y devolver,
 * partida en un test por estado (un fallo identifica exactamente qué
 * combinación falló). El rol ejecutor del estado ve los botones habilitados y
 * el resto los ve deshabilitados, con el motivo del motor a la vista.
 * Validación de comodidad del cliente: la que gobierna es la del servidor
 * (ADR-021), probada en transiciones-servidor.test.js.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nuevaVuelta } = require('./helpers/wizard-montura.js');
const { SGC, armarExpediente, expedienteEnEstado, repoFalso } =
  require('./helpers/expediente-montura.js');

const config = SGC.core.config;
const estados = SGC.core.estados;

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

for (let i = 0; i < config.ESTADOS.length; i++) {
  const estadoDef = config.ESTADOS[i];
  test('matriz de botones en ' + estadoDef.id + ': los 7 roles ven avanzar y devolver', async () => {
    const { raiz, nodos } = armarExpediente();
    const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
    SGC.views.expediente.montar(raiz);
    SGC.views.expediente.fijarRepo(repo);

    const expediente = expedienteEnEstado(estadoDef.id, i + 1);
    repo.fijarExpediente(expediente);

    for (const rol of config.ROLES.map((r) => r.id)) {
      SGC.views.expediente.seleccionarOperador({
        email: rol + '@faa.mil.ar', roles: [rol]
      });
      await SGC.views.expediente.abrir(expediente.expedienteId);
      await nuevaVuelta();

      const esperadoAvanzar = estados.puedeAvanzar(expediente, rol);
      const esperadoDevolver = estados.puedeDevolver(expediente, rol);
      assert.equal(nodos['sgc-expediente-avanzar'].disabled, !esperadoAvanzar.permitido,
        'avanzar en ' + estadoDef.id + ' con rol ' + rol);
      if (!esperadoAvanzar.permitido) {
        assert.ok(nodos['sgc-expediente-avanzar-porque'].textContent.length > 0,
          'el motivo de bloqueo de avanzar queda a la vista en ' + estadoDef.id);
        assert.equal(nodos['sgc-expediente-avanzar-porque'].textContent,
          esperadoAvanzar.motivo);
      } else {
        assert.equal(nodos['sgc-expediente-avanzar-porque'].textContent, '');
      }
      assert.equal(nodos['sgc-expediente-devolver'].disabled, !esperadoDevolver.permitido,
        'devolver en ' + estadoDef.id + ' con rol ' + rol);
      if (!esperadoDevolver.permitido) {
        assert.ok(nodos['sgc-expediente-devolver-porque'].textContent.length > 0);
        assert.equal(nodos['sgc-expediente-devolver-porque'].textContent,
          esperadoDevolver.motivo);
      } else {
        assert.equal(nodos['sgc-expediente-devolver-porque'].textContent, '');
      }
    }
  });
}
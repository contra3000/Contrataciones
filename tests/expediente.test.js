'use strict';

/*
 * expediente.test.js
 * ORDEN-RONDA-06 §3.5 puntos 5, 6 y 7 y §3.2/§3.3. Sobre la montura DOM mínima
 * (helpers/dom-stub.js) con un repositorio falso que nunca persiste por su
 * cuenta (se inspecciona lo que la vista le pide guardar). La matriz de
 * permisos 18 × 7 vive en expediente-matriz.test.js (ORDEN-RONDA-07 §2.2).
 *
 *  - Devolver exige un motivo del catálogo cerrado de config.js; sin motivo
 *    elegido el confirmar queda deshabilitado. La transición llega al repo
 *    como intención (ADR-021): destino, motivo y contexto con quién, qué,
 *    cuándo y desde qué equipo. El resultado lo decide el motor del servidor.
 *  - Avanzar con un único destino actúa directo (sin diálogo) y declara la
 *    versión esperada.
 *  - Conflicto de versión: la vista muestra el aviso y ofrece recargar sin
 *    pisar lo ajeno (ORDEN-RONDA-06 §3.3). El 409 real del servidor se prueba
 *    en servidor.test.js.
 *  - La auditoría se pinta cronológica con email, rol, equipo y transición.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nuevaVuelta } = require('./helpers/wizard-montura.js');
const { SGC, MARIA, CONTEXTO_CREACION, armarExpediente, expedienteEnEstado, repoFalso } =
  require('./helpers/expediente-montura.js');

const config = SGC.core.config;
const estados = SGC.core.estados;

const ANA = {
  nombre: 'Ana', apellido: 'Torres',
  email: 'ana.torres@faa.mil.ar',
  roles: ['juridica'], sector: 'juridica'
};
const CARLOS = {
  nombre: 'Carlos', apellido: 'Ramírez',
  email: 'carlos.ramirez@faa.mil.ar',
  roles: ['contrataciones', 'contrataciones_supervisor'], sector: 'contrataciones'
};

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

test('devolver pide motivo del catálogo cerrado; sin motivo el confirmar queda deshabilitado', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  const guardados = repo._guardados;
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const expediente = expedienteEnEstado('DICTAMEN_INICIAL', 41);
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  assert.equal(nodos['sgc-expediente-devolver'].disabled, true,
    'la generadora no puede devolver un Dictamen Inicial');
  assert.match(nodos['sgc-expediente-devolver-porque'].textContent,
    /no puede operar sobre "DICTAMEN_INICIAL"/);

  SGC.views.expediente.seleccionarOperador(ANA);
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  assert.equal(nodos['sgc-expediente-devolver'].disabled, false, 'jurídica puede devolver');
  nodos['sgc-expediente-devolver'].click();
  assert.equal(nodos['sgc-expediente-dialogo'].hidden, false, 'se abre el diálogo de devolución');

  const destinos = estados.puedeDevolver(expediente, 'juridica').destinos;
  assert.equal(nodos['sgc-expediente-dialogo-destino'].children.length, destinos.length,
    'los destinos de devolución que ofrece el motor');
  assert.equal(nodos['sgc-expediente-dialogo-motivo'].children.length,
    config.MOTIVOS_DEVOLUCION.length,
    'el catálogo cerrado de motivos de config.js');
  assert.equal(nodos['sgc-expediente-dialogo-confirmar'].disabled, true,
    'sin motivo elegido no se confirma');

  nodos['sgc-expediente-dialogo-motivo'].value = 'ERRORES_FORMALES';
  nodos['sgc-expediente-dialogo-motivo'].emit('change');
  assert.equal(nodos['sgc-expediente-dialogo-confirmar'].disabled, false);
  nodos['sgc-expediente-dialogo-observacion'].value = 'Falta foliar la nota de pedido.';
  nodos['sgc-expediente-dialogo-confirmar'].click();

  assert.equal(nodos['sgc-expediente-dialogo'].hidden, true, 'el diálogo se cierra');
  await nuevaVuelta();
  assert.equal(guardados.length, 1);
  const guardado = guardados[0];
  assert.equal(guardado.id, expediente.expedienteId);
  assert.equal(guardado.versionEsperada, 1, 'declara la versión que se leyó');
  assert.equal(guardado.destino, destinos[0], 'el destino que ofrece el motor');
  assert.equal(guardado.idMotivo, 'ERRORES_FORMALES');
  assert.equal(guardado.observacion, 'Falta foliar la nota de pedido.');
  assert.equal(guardado.contexto.email, ANA.email, 'la intención registra quién devolvió');
  assert.equal(guardado.contexto.rol, 'juridica');
  assert.equal(guardado.contexto.equipo, 'PC-NAVEGADOR');
});

test('avanzar con un único destino actúa directo, sin diálogo, y guarda la versión', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  const guardados = repo._guardados;
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const expediente = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 42);
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  const siguientes = estados.puedeAvanzar(expediente, 'generador').destinos;
  assert.equal(siguientes.length, 1, 'el primer estado tiene un único siguiente');

  nodos['sgc-expediente-avanzar'].click();
  assert.equal(nodos['sgc-expediente-dialogo'].hidden, true,
    'un solo destino: se avanza sin preguntar');
  await nuevaVuelta();

  assert.equal(guardados.length, 1);
  const guardado = guardados[0];
  assert.equal(guardado.destino, siguientes[0], 'la intención declara el destino del motor');
  assert.equal(guardado.versionEsperada, 1);
  assert.equal(guardado.contexto.email, MARIA.email);
  assert.equal(guardado.contexto.rol, 'generador');
});

test('un operador con varios roles opera con el primero que el motor habilite', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(CARLOS);

  const expediente = expedienteEnEstado('FIRMAS_PLIEGO_DISPOSICION', 43);
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  assert.equal(nodos['sgc-expediente-avanzar'].disabled, false,
    'contrataciones_supervisor está entre los roles de Carlos');
  assert.equal(nodos['sgc-expediente-devolver'].disabled, false);
});

test('conflicto de versión: aviso claro y botón de recargar, sin pisar lo ajeno', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({
    guardar: () => Promise.resolve({ ok: false, conflicto: true, versionRemota: 7 })
  });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const expediente = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 44);
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  assert.equal(nodos['sgc-expediente-conflicto'].hidden, true, 'sin conflicto no hay aviso');
  nodos['sgc-expediente-avanzar'].click();
  await nuevaVuelta();

  assert.equal(nodos['sgc-expediente-conflicto'].hidden, false);
  assert.match(nodos['sgc-expediente-conflicto-texto'].textContent,
    /modificado por otro operador \(versión actual en el servidor: 7\)/);
  assert.equal(nodos['sgc-expediente-mensaje'].hidden, true,
    'no se anuncia un cambio que no se guardó');

  const leidosAntes = repo._leidos.length;
  nodos['sgc-expediente-recargar'].click();
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-conflicto'].hidden, true, 'recargar limpia el aviso');
  assert.ok(repo._leidos.length > leidosAntes, 'recargar vuelve a leer el expediente');
});

test('la auditoría se pinta cronológica con quién, qué, cuándo y desde qué equipo', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  let expediente = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', 45);
  const contextoAvance = {
    timestamp: '2026-08-15T09:00:00.000Z',
    email: MARIA.email,
    rol: 'generador',
    equipo: 'PC-NAVEGADOR'
  };
  const avance = estados.avanzar(expediente, 'generador',
    estados.puedeAvanzar(expediente, 'generador').destinos[0], contextoAvance);
  expediente = avance.expediente;
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir(expediente.expedienteId);
  await nuevaVuelta();

  const ol = nodos['sgc-expediente-auditoria'];
  assert.equal(ol.children.length, 2, 'creación + avance');
  const primera = ol.children[0];
  const segunda = ol.children[1];
  assert.match(primera.children[0].textContent, /\[2026-08-14 10:00:00\] Creación: — → Especificaciones Técnicas/);
  assert.match(primera.children[1].textContent,
    /por maria\.gonzalez@faa\.mil\.ar \(generador\) desde PC-PRUEBA-01/);
  assert.match(segunda.children[0].textContent,
    /\[2026-08-15 09:00:00\] Avance: Especificaciones Técnicas → Solicitud de Contratación \(SCo\)/);
  assert.match(segunda.children[1].textContent,
    /por maria\.gonzalez@faa\.mil\.ar \(generador\) desde PC-NAVEGADOR/);
});

'use strict';

/*
 * expediente.test.js
 * ORDEN-RONDA-06 §3.5 puntos 5, 6 y 7 y §3.2/§3.3. Sobre la montura DOM mínima
 * (helpers/dom-stub.js) con un repositorio falso que nunca persiste por su
 * cuenta (se inspecciona lo que la vista le pide guardar):
 *
 *  - Matriz 18 estados × 7 roles × avanzar y devolver: el rol ejecutor del
 *    estado ve los botones habilitados y el resto los ve deshabilitados con el
 *    motivo del motor a la vista.
 *  - Devolver exige un motivo del catálogo cerrado de config.js; sin motivo
 *    elegido el confirmar queda deshabilitado. La transición llega al repo con
 *    auditoría completa (quién, qué, cuándo, desde qué equipo).
 *  - Avanzar con un único destino actúa directo (sin diálogo) y guarda la
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
const { nodo, nuevaVuelta } = require('./helpers/wizard-montura.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente-dialogo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente.js'));

const SGC = globalThis.SGC;
const config = SGC.core.config;
const estados = SGC.core.estados;

const MARIA = {
  nombre: 'María', apellido: 'González',
  email: 'maria.gonzalez@faa.mil.ar',
  roles: ['generador'], sector: 'usuario'
};
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

const CONTEXTO_CREACION = {
  timestamp: '2026-08-14T10:00:00.000Z',
  email: MARIA.email,
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

function armarExpediente() {
  const app = nodo('main', 'app');
  const exp = nodo('section', 'sgc-expediente');

  const cab = nodo('header', 'sgc-expediente-cabecera');
  cab.appendChild(nodo('button', 'sgc-expediente-volver'));
  cab.appendChild(nodo('h2', 'sgc-expediente-titulo'));
  cab.appendChild(nodo('p', 'sgc-expediente-resumen'));
  exp.appendChild(cab);
  exp.appendChild(nodo('p', 'sgc-expediente-mensaje'));

  const conflicto = nodo('div', 'sgc-expediente-conflicto');
  conflicto.hidden = true;
  conflicto.appendChild(nodo('p', 'sgc-expediente-conflicto-texto'));
  conflicto.appendChild(nodo('button', 'sgc-expediente-recargar'));
  exp.appendChild(conflicto);

  const cuerpo = nodo('div', 'sgc-expediente-cuerpo');
  const secDatos = nodo('section', 'sgc-expediente-datos-seccion');
  secDatos.appendChild(nodo('dl', 'sgc-expediente-datos'));
  cuerpo.appendChild(secDatos);
  const secReng = nodo('section', 'sgc-expediente-renglones-seccion');
  secReng.appendChild(nodo('ul', 'sgc-expediente-renglones'));
  cuerpo.appendChild(secReng);
  exp.appendChild(cuerpo);

  const acciones = nodo('section', 'sgc-expediente-acciones');
  const b1 = nodo('div', 'sgc-expediente-avanzar-bloque');
  b1.appendChild(nodo('button', 'sgc-expediente-avanzar'));
  b1.appendChild(nodo('p', 'sgc-expediente-avanzar-porque'));
  acciones.appendChild(b1);
  const b2 = nodo('div', 'sgc-expediente-devolver-bloque');
  b2.appendChild(nodo('button', 'sgc-expediente-devolver'));
  b2.appendChild(nodo('p', 'sgc-expediente-devolver-porque'));
  acciones.appendChild(b2);
  exp.appendChild(acciones);

  const secAud = nodo('section', 'sgc-expediente-auditoria-seccion');
  secAud.appendChild(nodo('ol', 'sgc-expediente-auditoria'));
  exp.appendChild(secAud);
  app.appendChild(exp);

  const dialogo = nodo('div', 'sgc-expediente-dialogo');
  dialogo.hidden = true;
  dialogo.appendChild(nodo('h3', 'sgc-expediente-dialogo-titulo'));
  const dDest = nodo('div', 'sgc-expediente-dialogo-destino-bloque');
  dDest.appendChild(nodo('select', 'sgc-expediente-dialogo-destino'));
  dialogo.appendChild(dDest);
  const dMot = nodo('div', 'sgc-expediente-dialogo-motivo-bloque');
  dMot.appendChild(nodo('select', 'sgc-expediente-dialogo-motivo'));
  dialogo.appendChild(dMot);
  const dObs = nodo('div', 'sgc-expediente-dialogo-observacion-bloque');
  dObs.appendChild(nodo('textarea', 'sgc-expediente-dialogo-observacion'));
  dialogo.appendChild(dObs);
  const dAcc = nodo('div', 'sgc-expediente-dialogo-acciones');
  dAcc.appendChild(nodo('button', 'sgc-expediente-dialogo-confirmar'));
  dAcc.appendChild(nodo('button', 'sgc-expediente-dialogo-cancelar'));
  dialogo.appendChild(dAcc);
  app.appendChild(dialogo);

  return { raiz: app, nodos: documento.porId };
}

function expedienteEnEstado(idEstado, numero) {
  const def = config.ESTADOS.find((e) => e.id === idEstado);
  const expediente = SGC.adapters.repo.construirExpediente({
    titulo: 'Expediente ' + numero,
    anio: '2026',
    identificacion: {
      numero: String(numero),
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14',
    fechaLimite: '2026-09-01',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    renglones: [
      { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210' }
    ]
  }, CONTEXTO_CREACION, '2026-' + numero);
  expediente.estado = {
    id: idEstado,
    fase: def ? def.fase : null,
    desde: '2026-08-14T10:00:00.000Z'
  };
  return expediente;
}

function repoFalso(montaje) {
  let expedienteActual = null;
  const guardados = [];
  const leidos = [];
  const repo = {
    _expediente: expedienteActual,
    _guardados: guardados,
    _leidos: leidos,
    leerExpediente: (id) => {
      leidos.push(id);
      return Promise.resolve({ expediente: expedienteActual, version: 1 });
    },
    guardarExpediente: (id, expedienteNuevo, versionEsperada, contexto) => {
      guardados.push({ id, expediente: expedienteNuevo, versionEsperada, contexto });
      return montaje.guardar(expedienteNuevo, versionEsperada, contexto);
    },
    fijarExpediente: (expediente) => {
      expedienteActual = expediente;
    }
  };
  return repo;
}

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

test('matriz: 18 estados × 7 roles × avanzar y devolver se reflejan en los botones', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);

  const rolIds = config.ROLES.map((r) => r.id);
  for (let i = 0; i < config.ESTADOS.length; i++) {
    const estadoDef = config.ESTADOS[i];
    const expediente = expedienteEnEstado(estadoDef.id, i + 1);
    repo.fijarExpediente(expediente);
    for (const rol of rolIds) {
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
  }
});

test('devolver pide motivo del catálogo cerrado; sin motivo el confirmar queda deshabilitado', async () => {
  const { raiz, nodos } = armarExpediente();
  const guardados = [];
  const repo = repoFalso({
    guardar: (expedienteNuevo, versionEsperada, contexto) => {
      guardados.push({ expediente: expedienteNuevo, versionEsperada, contexto });
      return Promise.resolve({ ok: true, version: 2 });
    }
  });
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
  assert.equal(guardado.versionEsperada, 1, 'guarda con la versión que se leyó');
  assert.equal(guardado.expediente.estado.id, destinos[0], 'el destino elegido por el motor');
  const auditoria = guardado.expediente.auditoria;
  const ultimo = auditoria[auditoria.length - 1];
  assert.equal(ultimo.accion, 'devolver');
  assert.equal(ultimo.motivo, 'ERRORES_FORMALES');
  assert.equal(ultimo.observacion, 'Falta foliar la nota de pedido.');
  assert.equal(ultimo.email, ANA.email, 'la auditoría registra quién devolvió');
  assert.equal(ultimo.rol, 'juridica');
  assert.equal(ultimo.equipo, 'PC-NAVEGADOR');
});

test('avanzar con un único destino actúa directo, sin diálogo, y guarda la versión', async () => {
  const { raiz, nodos } = armarExpediente();
  const guardados = [];
  const repo = repoFalso({
    guardar: (expedienteNuevo, versionEsperada, contexto) => {
      guardados.push({ expediente: expedienteNuevo, versionEsperada, contexto });
      return Promise.resolve({ ok: true, version: 2 });
    }
  });
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
  assert.equal(guardado.expediente.estado.id, siguientes[0]);
  assert.equal(guardado.versionEsperada, 1);
  const auditoria = guardado.expediente.auditoria;
  const ultimo = auditoria[auditoria.length - 1];
  assert.equal(ultimo.accion, 'avanzar');
  assert.equal(ultimo.email, MARIA.email);
  assert.equal(ultimo.rol, 'generador');
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

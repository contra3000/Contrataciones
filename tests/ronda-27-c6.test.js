'use strict';

/*
 * ronda-27-c6.test.js
 * ORDEN-RONDA-27 pieza 6 — el tablero muestra la SCo.
 *
 * Desde que la SCo sale de `SOLICITUD_CONTRATACION` los requerimientos se
 * mueven en bloque (pieza 4), así que el tablero muestra UNA tarjeta por SCo, con
 * sus requerimientos adentro. Antes de eso van sueltos, porque cada uno se mueve
 * por su cuenta. Y el expediente dice arriba de qué SCo parte y con cuáles va.
 *
 * El tablero sigue armándose SÓLO con GET /api/indice (ORDEN-RONDA-06 §3.5): la
 * agrupación sale del `numeroSCo` que cada entrada ya trae (ORDEN-RONDA-26
 * pieza 4), sin abrir un solo expediente. Por eso `leerExpediente` aquí es una
 * trampa: si alguien lo usa, el test falla.
 *
 * La última prueba no inventa el índice: pide el índice REAL de un servidor
 * real con una SCo de dos, la ve pintar dos tarjetas antes de que la SCo avance y
 * una sola después. Si el servidor no pusiera el `numeroSCo` en cada entrada, o
 * no moviera a los dos juntos, esa prueba caería.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nodo, nuevaVuelta } = require('./helpers/wizard-montura.js');
const { SGC, MARIA, armarExpediente, expedienteEnEstado, repoFalso } =
  require('./helpers/expediente-montura.js');
const ti = require('./helpers/transiciones-servidor-util.js');

require(path.join(RAIZ, 'app', 'js', 'views', 'kanban.js'));

// Dos requerimientos en la misma SCo, ya avanzadas (las dos en el mismo estado,
// que es lo que hace posible la pieza 4), uno suelto y una pareja que todavía no
// salió de SOLICITUD_CONTRATACION.
const ENTRADAS = [
  {
    id: '2026-003', titulo: 'Resmas A4', numeroSCo: '123/2026',
    estado: 'ANALISIS_SCo', fase: 2, sector: 'abastecimiento',
    rolEjecutor: 'abastecimiento', ultimoOperador: 'juan.perez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-15T10:00:00.000Z'
  },
  {
    id: '2026-007', titulo: 'Válvula de seguridad', numeroSCo: '123/2026',
    estado: 'ANALISIS_SCo', fase: 2, sector: 'abastecimiento',
    rolEjecutor: 'abastecimiento', ultimoOperador: 'juan.perez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-15T10:00:00.000Z'
  },
  {
    id: '2026-004', titulo: 'Termostatos', numeroSCo: null,
    estado: 'ESPECIFICACIONES_TECNICAS', fase: 1, sector: 'usuario',
    rolEjecutor: 'generador', ultimoOperador: 'maria.gonzalez@faa.mil.ar',
    fechaLimite: '2026-09-01', actualizado: '2026-08-14T10:00:00.000Z'
  },
  {
    id: '2026-005', titulo: 'Papelería', numeroSCo: '9/2026',
    estado: 'SOLICITUD_CONTRATACION', fase: 1, sector: 'usuario',
    rolEjecutor: 'generador', ultimoOperador: 'maria.gonzalez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-14T11:00:00.000Z'
  },
  {
    id: '2026-006', titulo: 'Bolsas', numeroSCo: '9/2026',
    estado: 'SOLICITUD_CONTRATACION', fase: 1, sector: 'usuario',
    rolEjecutor: 'generador', ultimoOperador: 'maria.gonzalez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-14T11:00:00.000Z'
  },
  {
    // Solo en su SCo: no hay nada que agrupar, así que conserva su tarjeta de
    // siempre (es lo que espera la pantalla de expediente y el resto del tablero).
    id: '2026-008', titulo: 'Cafetera', numeroSCo: '10/2026',
    estado: 'ANALISIS_SCo', fase: 2, sector: 'abastecimiento',
    rolEjecutor: 'abastecimiento', ultimoOperador: 'juan.perez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-15T10:00:00.000Z'
  }
];

function armarKanban() {
  const app = nodo('main', 'app');
  const kanban = nodo('section', 'sgc-kanban');
  const cabecera = nodo('header', 'sgc-kanban-cabecera');
  cabecera.appendChild(nodo('input', 'sgc-kanban-busqueda'));
  cabecera.appendChild(nodo('select', 'sgc-kanban-fase'));
  cabecera.appendChild(nodo('button', 'sgc-kanban-refrescar'));
  cabecera.appendChild(nodo('p', 'sgc-kanban-conteo'));
  cabecera.appendChild(nodo('p', 'sgc-kanban-error'));
  kanban.appendChild(cabecera);
  kanban.appendChild(nodo('div', 'sgc-kanban-columnas'));
  app.appendChild(kanban);
  return { raiz: app, nodos: documento.porId };
}

// El tablero no abre expedientes: si lo hiciera, esta promesa rechazaría y el
// test se caería con un error que no dice dónde.
function repoTablero(entradas, abierto) {
  return {
    listarIndice: () => Promise.resolve(entradas),
    leerExpediente: () => Promise.reject(new Error('el tablero no debe abrir expedientes')),
    onAbrirRegistrado: abierto
  };
}

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

test('una SCo de 2 avanzada es una sola tarjeta, con sus dos requerimientos adentro', async () => {
  const { raiz } = armarKanban();
  let abierto = null;
  SGC.views.kanban.onAbrir((id) => {
    abierto = id;
  });
  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo(repoTablero(ENTRADAS));
  SGC.views.kanban.refrescar();
  await nuevaVuelta();

  const fase2 = raiz.querySelector('#sgc-kanban-lista-2');
  const tarjetas = fase2.children;
  const tarjeta = tarjetas[0];
  assert.equal(tarjeta.getAttribute('data-sco'), '123/2026', 'la tarjeta dice de qué SCo es');
  assert.match(tarjeta.children[0].textContent, /SCo 123\/2026 \(2 requerimientos\)/);
  assert.equal(tarjeta.children[1].textContent, 'Se mueve en bloque');

  const miembros = tarjeta.children[tarjeta.children.length - 1];
  assert.equal(miembros.className, 'kanban-sco-miembros');
  assert.equal(miembros.children.length, 2, 'los dos requerimientos van adentro');
  assert.equal(miembros.children[0].getAttribute('data-id'), '2026-003');
  assert.equal(miembros.children[1].getAttribute('data-id'), '2026-007');
  assert.equal(miembros.children[0].getAttribute('data-sco'), null,
    'los 2026-003 y 2026-007 no tienen tarjeta propia: los dos están en la de la SCo');

  // La pareja que todavía no salió de SOLICITUD_CONTRATACION sigue suelta: cada
  // requerimiento se mueve por su cuenta hasta que la SCo avance.
  const fase1 = raiz.querySelector('#sgc-kanban-lista-1');
  assert.equal(fase1.children.length, 3,
    'la SCo 9/2026 todavía no avanzó: sus dos requerimientos van sueltos');
  const sueltos = [];
  for (var i = 0; i < fase1.children.length; i++) {
    sueltos.push(fase1.children[i].getAttribute('data-id'));
  }
  assert.deepEqual(sueltos.sort(), ['2026-004', '2026-005', '2026-006']);

  const conteo = raiz.querySelector('#sgc-kanban-conteo').textContent;
  assert.match(conteo, /6 de 6 expedientes en el índice/);
  assert.match(conteo, /1 SCo/, 'y se aclara que hay una SCo agrupada: ' + conteo);

  // Una SCo de un solo requerimiento no se agrupa: su tarjeta sigue siendo la
  // de siempre, con su número y su botón de abrir.
  const sueltasDeFase2 = fase2.children.length;
  assert.equal(sueltasDeFase2, 2,
    'la tarjeta de la SCo 10/2026 (un solo requerimiento) no se convierte en SCo');
  assert.equal(fase2.children[1].getAttribute('data-id'), '2026-008',
    'sigue siendo la tarjeta del expediente, con su número');

  // Abrir un miembro abre ese requerimiento, no la SCo.
  miembros.children[1].children[miembros.children[1].children.length - 1].click();
  assert.equal(abierto, '2026-007', 'se abre el requerimiento que se eligió');
});

test('el filtro de texto encuentra la SCo por su número y por el de un requerimiento', async () => {
  const { raiz, nodos } = armarKanban();
  SGC.views.kanban.onAbrir(() => {});
  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo(repoTablero(ENTRADAS));
  SGC.views.kanban.refrescar();
  await nuevaVuelta();

  nodos['sgc-kanban-busqueda'].value = '123/2026';
  nodos['sgc-kanban-busqueda'].emit('input');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-2').children.length, 1,
    'por el número de la SCo se encuentra su tarjeta');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-1').children.length, 0);

  nodos['sgc-kanban-busqueda'].value = 'válvula';
  nodos['sgc-kanban-busqueda'].emit('input');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-2').children.length, 1,
    'por el título de un requerimiento también se encuentra la SCo');

  nodos['sgc-kanban-busqueda'].value = 'termostatos';
  nodos['sgc-kanban-busqueda'].emit('input');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-2').children.length, 0);
  assert.equal(raiz.querySelector('#sgc-kanban-lista-1').children.length, 1,
    'el que no es de la SCo sigue apareciendo como tarjeta suelta');
});

test('el expediente dice arriba de qué SCo parte y con qué requerimientos va', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  const leidosDeSco = [];
  repo.leerSCo = (numero) => {
    leidosDeSco.push(numero);
    return Promise.resolve({
      numeroSCo: numero,
      anio: '2026',
      expedientes: ['2026-003', '2026-007'],
      version: 4
    });
  };
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const expediente = expedienteEnEstado('ANALISIS_SCo', '003');
  expediente.campos = { numeroSCo: '123/2026' };
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir('2026-003');
  await nuevaVuelta();

  assert.deepEqual(leidosDeSco, ['123/2026'],
    'la lista de miembros sale del REGISTRO de la SCo, no del expediente');
  assert.equal(nodos['sgc-expediente-sco'].hidden, false);
  assert.equal(nodos['sgc-expediente-sco'].textContent,
    'Parte de la SCo 123/2026, con 2026-003 y 2026-007',
    'dice la frase exacta de la ORDEN: la SCo y los dos requerimientos que van en ella');
});

// El REGISTRO se lee por red: la línea se pone con lo que ya se sabe (el número
// de la SCo) y se completa cuando llega. Ni la SCo anterior ni una respuesta que
// llega tarde pueden quedar en pantalla.
test('la línea de la SCo no queda mostrando la SCo anterior ni una respuesta vieja', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  const pendientes = {};
  repo.leerSCo = (numero) => new Promise((resolver) => {
    pendientes[numero] = resolver;
  });
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const primera = expedienteEnEstado('ANALISIS_SCo', '003');
  primera.campos = { numeroSCo: '123/2026' };
  repo.fijarExpediente(primera);
  await SGC.views.expediente.abrir('2026-003');
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].textContent, 'Parte de la SCo 123/2026',
    'mientras no llegue el REGISTRO, dice la SCo y nada más');

  // Se abre otro expediente de otra SCo antes de que llegue la respuesta.
  const segunda = expedienteEnEstado('ANALISIS_SCo', '008');
  segunda.campos = { numeroSCo: '321/2026' };
  repo.fijarExpediente(segunda);
  await SGC.views.expediente.abrir('2026-008');
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].textContent, 'Parte de la SCo 321/2026',
    'la SCo anterior desaparece apenas se abre la nueva, sin esperar a la red');

  // Llega tarde la de 123/2026: no se pinta sobre la que está en pantalla.
  pendientes['123/2026']({ numeroSCo: '123/2026', anio: '2026', expedientes: ['2026-003', '2026-007'] });
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].textContent, 'Parte de la SCo 321/2026',
    'la respuesta vieja se descarta');

  pendientes['321/2026']({ numeroSCo: '321/2026', anio: '2026', expedientes: ['2026-008'] });
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].textContent,
    'Parte de la SCo 321/2026, con 2026-008',
    'y la que sí corresponde se pinta');

  // Si el REGISTRO no se puede leer, no se pisa lo que ya se sabía.
  repo.leerSCo = () => Promise.reject(new Error('se cayó la red'));
  const tercera = expedienteEnEstado('ANALISIS_SCo', '009');
  tercera.campos = { numeroSCo: '999/2026' };
  repo.fijarExpediente(tercera);
  await SGC.views.expediente.abrir('2026-009');
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].textContent, 'Parte de la SCo 999/2026',
    'con el REGISTRO caído queda lo que se sabe seguro');
});

test('sin número de SCo la línea no aparece, y sin registro dice lo que se sabe', async () => {
  const { raiz, nodos } = armarExpediente();
  const repo = repoFalso({ guardar: () => Promise.resolve({ ok: true, version: 2 }) });
  repo.leerSCo = () => Promise.resolve(null);
  SGC.views.expediente.montar(raiz);
  SGC.views.expediente.fijarRepo(repo);
  SGC.views.expediente.seleccionarOperador(MARIA);

  const expediente = expedienteEnEstado('ESPECIFICACIONES_TECNICAS', '004');
  repo.fijarExpediente(expediente);
  await SGC.views.expediente.abrir('2026-004');
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].hidden, true,
    'un requerimiento sin SCo no muestra la línea');

  // Con número pero todavía sin registro (los dos no salieron de
  // SOLICITUD_CONTRATACION): se dice la SCo y no se inventa la lista.
  const conNumero = expedienteEnEstado('SOLICITUD_CONTRATACION', '005');
  conNumero.campos = { numeroSCo: '9/2026' };
  repo.fijarExpediente(conNumero);
  await SGC.views.expediente.abrir('2026-005');
  await nuevaVuelta();
  assert.equal(nodos['sgc-expediente-sco'].hidden, false);
  assert.equal(nodos['sgc-expediente-sco'].textContent, 'Parte de la SCo 9/2026');
});

// ---------------------------------------------------------------------------
// Con el índice REAL de un servidor REAL: dos tarjetas antes de que la SCo
// avance, una tarjeta con los dos después.
// ---------------------------------------------------------------------------

const NUMERO_SCO = '21/2026';

async function leerIndice(base) {
  const r = await ti.pedir(base, 'GET', '/api/indice');
  assert.equal(r.status, 200, 'se lee el índice fragmentado');
  return r.body;
}

// Un requerimiento en SOLICITUD_CONTRATACION con el número de la SCo cargado,
// como lo deja la pantalla.
async function miembroEnSolicitud(base, datosDir, numero) {
  const creado = await ti.crearEnEstado(base, datosDir, 'SOLICITUD_CONTRATACION', assert);
  const leido = await ti.pedir(base, 'GET', '/api/expedientes/' + creado.id);
  const expediente = leido.body.expediente;
  expediente.campos = Object.assign({}, expediente.campos, { numeroSCo: NUMERO_SCO });
  const puesto = await ti.pedir(base, 'PUT', '/api/expedientes/' + creado.id, {
    expediente: expediente,
    versionEsperada: leido.body.version,
    contexto: ti.contexto('abastecimiento')
  });
  assert.equal(puesto.status, 200, 'se carga el número de SCo de ' + creado.id);
  return creado.id;
}

// Pinta el tablero con el índice que se le pasa y devuelve las tarjetas de la
// columna de la fase 1 (donde están los requerimientos en SOLICITUD).
function pintar(raiz, entradas) {
  SGC.views.kanban.onAbrir(() => {});
  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo({
    listarIndice: () => Promise.resolve(entradas),
    leerExpediente: () => Promise.reject(new Error('el tablero no debe abrir expedientes'))
  });
  SGC.views.kanban.refrescar();
  return raiz;
}

// Las tarjetas del tablero, en cualquier columna: la fase de un estado no se
// supone en el test (SOLICITUD_CONTRATACION es fase 2 y ANALISIS_SCo es fase 3,
// por ejemplo).
function tarjetasDelTablero(raiz) {
  const sueltas = [];
  const deSco = [];
  const listas = raiz.querySelectorAll('ul');
  for (var i = 0; i < listas.length; i++) {
    for (var j = 0; j < listas[i].children.length; j++) {
      const tarjeta = listas[i].children[j];
      // Sólo las tarjetas: la lista de miembros de la SCo también es un `ul`,
      // pero sus hijos son `li` de requerimiento, no tarjetas del tablero.
      if (tarjeta.className.indexOf('kanban-tarjeta') !== 0) {
        continue;
      }
      if (tarjeta.getAttribute('data-sco')) {
        deSco.push(tarjeta);
      } else {
        sueltas.push(tarjeta);
      }
    }
  }
  return { sueltas: sueltas, deSco: deSco };
}

test('con el índice de un servidor real: antes de avanzar dos tarjetas, después una con los dos', async () => {
  const entorno = await ti.arrancarEntorno();
  try {
    const a = await miembroEnSolicitud(entorno.base, entorno.datosDir);
    const b = await miembroEnSolicitud(entorno.base, entorno.datosDir);

    // Antes de que la SCo avance, sus dos requerimientos van sueltos.
    const antes = await leerIndice(entorno.base);
    const { raiz: raizAntes } = armarKanban();
    pintar(raizAntes, antes);
    await nuevaVuelta();
    const antesDe = tarjetasDelTablero(raizAntes);
    assert.equal(antesDe.deSco.length, 0,
      'la SCo todavía no salió de SOLICITUD_CONTRATACION: no hay tarjeta de SCo');
    assert.deepEqual(antesDe.sueltas.map((t) => t.getAttribute('data-id')).sort(), [a, b].sort(),
      'sus dos requerimientos van sueltos, como antes de esta pieza');

    // Avanza uno: la pieza 4 mueve a los dos.
    const leido = await ti.pedir(entorno.base, 'GET', '/api/expedientes/' + a);
    const r = await ti.pedir(entorno.base, 'POST', '/api/expedientes/' + a + '/avanzar', {
      versionEsperada: leido.body.version,
      destino: 'ANALISIS_SCo',
      contexto: ti.contexto('abastecimiento')
    });
    assert.equal(r.status, 200, 'la SCo entra a ANALISIS_SCo: ' + JSON.stringify(r.body));

    const despues = await leerIndice(entorno.base);
    const entradasDeLaSco = despues.filter((e) => e.numeroSCo === NUMERO_SCO);
    assert.equal(entradasDeLaSco.length, 2, 'el índice trae las dos entradas con su SCo');
    assert.deepEqual(entradasDeLaSco.map((e) => e.estado), ['ANALISIS_SCo', 'ANALISIS_SCo'],
      'y las dos quedaron en el mismo estado, porque se movieron juntas');

    const { raiz } = armarKanban();
    pintar(raiz, despues);
    await nuevaVuelta();
    const despuesDe = tarjetasDelTablero(raiz);
    assert.equal(despuesDe.sueltas.length, 0, 'no queda ninguna tarjeta suelta de la SCo');
    assert.equal(despuesDe.deSco.length, 1, 'después de avanzar, una sola tarjeta para la SCo');
    assert.equal(despuesDe.deSco[0].getAttribute('data-sco'), NUMERO_SCO);
    const miembros = despuesDe.deSco[0].children[despuesDe.deSco[0].children.length - 1];
    const ids = [];
    for (var i = 0; i < miembros.children.length; i++) {
      ids.push(miembros.children[i].getAttribute('data-id'));
    }
    assert.deepEqual(ids.sort(), [a, b].sort(), 'con los dos requerimientos adentro');
  } finally {
    await ti.limpiarEntorno(entorno);
  }
});

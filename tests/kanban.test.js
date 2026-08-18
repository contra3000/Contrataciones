'use strict';

/*
 * kanban.test.js
 * ORDEN-RONDA-06 §3.5 punto 4 (el tablero se arma SÓLO desde GET /api/indice)
 * y §3.1 (una columna por fase, filtros por texto y fase, tarjetas livianas).
 *
 * Sobre la montura DOM mínima (helpers/dom-stub.js) y con un repositorio
 * falso cuyo listarIndice entrega entradas del índice fragmentado:
 *
 *  - Se pintan las diez columnas de fase con sus títulos de config.FASES.
 *  - La tarjeta muestra número, título, estado, último operador y fecha.
 *  - Refrescar NO abre ningún expediente (cero llamadas a leerExpediente).
 *  - Filtros por texto y por fase.
 *  - Si el índice falla, el error queda visible y no rompe la vista.
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
require(path.join(RAIZ, 'app', 'js', 'views', 'kanban.js'));

const SGC = globalThis.SGC;
const config = SGC.core.config;

const ENTRADAS = [
  {
    id: '2026-001', titulo: 'Resmas A4',
    estado: 'ESPECIFICACIONES_TECNICAS', fase: 1, sector: 'usuario',
    rolEjecutor: 'generador', ultimoOperador: 'maria.gonzalez@faa.mil.ar',
    fechaLimite: '2026-09-01', actualizado: '2026-08-14T10:00:00.000Z'
  },
  {
    id: '2026-002', titulo: 'Termostato',
    estado: 'REVISION_SCo', fase: 3, sector: 'contrataciones',
    rolEjecutor: 'contrataciones', ultimoOperador: 'carlos.ramirez@faa.mil.ar',
    fechaLimite: null, actualizado: '2026-08-15T11:30:00.000Z'
  },
  {
    id: '2026-003', titulo: 'Válvula de seguridad',
    estado: 'PERFECCIONADA', fase: 10, sector: 'abastecimiento',
    rolEjecutor: 'abastecimiento', ultimoOperador: 'juan.perez@faa.mil.ar',
    fechaLimite: '2026-07-30', actualizado: '2026-08-10T09:00:00.000Z'
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

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

test('el tablero se arma solo desde /api/indice, una columna por fase y con tarjetas completas', async () => {
  const { raiz, nodos } = armarKanban();
  const expedientesAbiertos = [];
  const repo = {
    listarIndice: () => Promise.resolve(ENTRADAS),
    leerExpediente: (id) => {
      expedientesAbiertos.push(id);
      return Promise.reject(new Error('el tablero no debe abrir expedientes'));
    }
  };

  let abierto = null;
  SGC.views.kanban.onAbrir((id) => {
    abierto = id;
  });

  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo(repo);
  SGC.views.kanban.refrescar();
  await nuevaVuelta();

  const contenedor = nodos['sgc-kanban-columnas'];
  assert.equal(contenedor.children.length, config.FASES.length,
    'una columna por fase (diez), no por estado');
  assert.equal(contenedor.children[0].children[0].textContent, 'Fase 1 · Usuario');
  assert.equal(contenedor.children[9].children[0].textContent, 'Fase 10 · Abastecimiento');

  const col1 = raiz.querySelector('#sgc-kanban-lista-1');
  const col3 = raiz.querySelector('#sgc-kanban-lista-3');
  const col10 = raiz.querySelector('#sgc-kanban-lista-10');
  assert.equal(col1.children.length, 1);
  assert.equal(col3.children.length, 1);
  assert.equal(col10.children.length, 1);
  assert.equal(col1.children[0].getAttribute('data-id'), '2026-001');

  const tarjeta = col1.children[0];
  assert.equal(tarjeta.children[0].textContent, '2026-001', 'número del expediente');
  assert.equal(tarjeta.children[1].textContent, 'Resmas A4', 'título');
  assert.equal(tarjeta.children[2].textContent, 'Especificaciones Técnicas', 'estado legible');
  assert.equal(tarjeta.children[3].textContent,
    'Último operador: maria.gonzalez@faa.mil.ar', 'último operador');
  assert.equal(tarjeta.children[4].textContent,
    'Actualizado: 2026-08-14 10:00:00', 'fecha de última modificación');
  assert.match(nodos['sgc-kanban-conteo'].textContent, /3 de 3/);

  tarjeta.children[tarjeta.children.length - 1].click();
  assert.equal(abierto, '2026-001', 'abrir dispara el callback con el id de la tarjeta');

  assert.deepEqual(expedientesAbiertos, [],
    'ninguna llamada a leerExpediente: el tablero no lee los datos.json');
});

test('los filtros por texto y por fase reducen lo pintado sin tocar el índice de nuevo', async () => {
  const { raiz, nodos } = armarKanban();
  let llamadasIndice = 0;
  const repo = {
    listarIndice: () => {
      llamadasIndice += 1;
      return Promise.resolve(ENTRADAS);
    },
    leerExpediente: () => Promise.reject(new Error('no debe usarse'))
  };

  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo(repo);
  SGC.views.kanban.refrescar();
  await nuevaVuelta();
  assert.equal(llamadasIndice, 1);

  nodos['sgc-kanban-busqueda'].value = 'termostato';
  nodos['sgc-kanban-busqueda'].emit('input');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-3').children.length, 1);
  assert.equal(raiz.querySelector('#sgc-kanban-lista-1').children.length, 0);
  assert.equal(raiz.querySelector('#sgc-kanban-lista-10').children.length, 0);
  assert.match(nodos['sgc-kanban-conteo'].textContent, /1 de 3/);

  nodos['sgc-kanban-fase'].value = '3';
  nodos['sgc-kanban-fase'].emit('change');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-3').children.length, 1,
    'el filtro de fase no elimina lo que ya filtra el texto');

  nodos['sgc-kanban-fase'].value = '';
  nodos['sgc-kanban-fase'].emit('change');
  nodos['sgc-kanban-busqueda'].value = 'seguridad';
  nodos['sgc-kanban-busqueda'].emit('input');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-3').children.length, 0,
    'el termostato no es la válvula de seguridad');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-10').children.length, 1);

  nodos['sgc-kanban-busqueda'].value = '';
  nodos['sgc-kanban-busqueda'].emit('input');
  nodos['sgc-kanban-fase'].value = '1';
  nodos['sgc-kanban-fase'].emit('change');
  assert.equal(raiz.querySelector('#sgc-kanban-lista-1').children.length, 1);
  assert.equal(raiz.querySelector('#sgc-kanban-lista-3').children.length, 0);
  assert.equal(nodos['sgc-kanban-conteo'].textContent, '1 de 3 expedientes en el índice');

  assert.equal(llamadasIndice, 1, 'filtrar no vuelve a consultar el índice');
});

test('si el índice falla, el tablero muestra el error y no se rompe', async () => {
  const { raiz, nodos } = armarKanban();
  const repo = {
    listarIndice: () => Promise.reject(new Error('servidor caído')),
    leerExpediente: () => Promise.reject(new Error('no debe usarse'))
  };

  SGC.views.kanban.montar(raiz);
  SGC.views.kanban.fijarRepo(repo);
  SGC.views.kanban.refrescar();
  await nuevaVuelta();

  assert.equal(nodos['sgc-kanban-error'].hidden, false);
  assert.match(nodos['sgc-kanban-error'].textContent, /No se pudo cargar el tablero: servidor caído/);
});

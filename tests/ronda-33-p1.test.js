'use strict';

/*
 * ronda-33-p1.test.js
 * RONDA-33 · pieza 1 · "La plantilla para llenar con un asistente de IA"
 * (ORDEN-RONDA-33 pieza 1).
 *
 * La persona baja la plantilla, se la da a un asistente (ChatGPT, Copilot,
 * Claude…) junto con los papeles desordenados, y pega lo que el asistente
 * devuelve. Esta pieza hace dos cosas, por la pantalla:
 *
 *  - la plantilla baja con las instrucciones de la orden (texto tal cual) y DOS
 *    renglones de ejemplo: uno con un código real del catálogo vigente y su
 *    "buscar", y uno con el código vacío;
 *  - un renglón SIN código, o con uno que no existe, ya no rechaza el archivo:
 *    entra "por buscar" (con su aviso para el que no existe), y se elige el ítem
 *    en el buscador. El pegado tolera el bloque ```json y el texto alrededor.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const CODIGO_PAPELERIA = '2.3.1-6563.129';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function entrarComoUsuario() {
  await m.correr();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
}

async function bajar() {
  const descarga = await m.bajarPlantilla();
  return JSON.parse(await descarga.texto());
}

// Lo que el asistente devuelve, pegado por la pantalla: se abre el panel, se
// escribe en el textarea y se aprieta "Cargar lo pegado".
async function pegar(texto) {
  m.documento.getElementById('sgc-btn-pegar').click();
  m.setear('sgc-pegar-json', texto);
  m.documento.getElementById('sgc-btn-cargar-pegado').click();
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó a lo pegado');
  return m.msjArchivo().textContent;
}

// Las instrucciones de la orden, tal como están en su blockquote: se leen del
// propio archivo para que la comparación sea contra la orden publicada.
function instruccionesDeLaOrden() {
  const orden = fs.readFileSync(path.join(RAIZ, 'ordenes', 'ORDEN-RONDA-33.md'), 'utf8');
  return orden.split(/\r?\n/)
    .filter((linea) => /^\s*>/.test(linea))
    .map((linea) => linea.replace(/^\s*>\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizar(texto) {
  return String(texto).replace(/\s+/g, ' ').trim();
}

test('RONDA-33 pieza 1 · la plantilla baja con las instrucciones de la orden, tal cual', async () => {
  await entrarComoUsuario();

  const plantilla = await bajar();

  assert.strictEqual(typeof plantilla.instrucciones, 'string',
    'la plantilla trae el campo instrucciones');
  assert.strictEqual(normalizar(plantilla.instrucciones), instruccionesDeLaOrden(),
    'las instrucciones son el texto de ORDEN-RONDA-33, sin agregar ni quitar nada');

  assert.ok(Array.isArray(plantilla.renglones) && plantilla.renglones.length === 2,
    'la plantilla trae dos renglones de ejemplo: ' + JSON.stringify(plantilla.renglones));
  assert.strictEqual(plantilla.renglones[0].codigo, CODIGO_PAPELERIA,
    'el primero tiene un código real del catálogo vigente');
  assert.strictEqual(typeof plantilla.renglones[0].buscar, 'string',
    'el primero dice con qué palabras buscarlo');
  assert.strictEqual(plantilla.renglones[1].codigo, '',
    'el segundo muestra cómo se deja el código que no se sabe');
  assert.strictEqual(plantilla.renglones[1].buscar, 'resma papel A4',
    'el segundo trae su "buscar", como pide la orden');

  assert.deepStrictEqual(m.red.llamadas, [],
    'bajar la plantilla no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('RONDA-33 pieza 1 · pegar el JSON del asistente carga los renglones y deja por buscar los que no tienen código', async () => {
  await entrarComoUsuario();

  // Como lo devuelve un asistente: una frase, el JSON en un bloque ```json y una
  // frase al final. Tres renglones: uno con código real, uno sin código, uno con
  // un código que no existe.
  const cuerpo = {
    formato: 'sgc-requerimiento/1',
    titulo: 'Insumos de papelería',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: 'Se necesita reponer insumos.',
    objetivo: '',
    instrucciones: 'Rellená este JSON tal cual.',
    renglones: [
      { codigo: CODIGO_PAPELERIA, buscar: 'resma papel A4', cantidad: 2, unidad: 'UN', aclaracion: '' },
      { codigo: '', buscar: 'cartuchera', cantidad: 3, unidad: 'UN', aclaracion: 'con cierre' },
      { codigo: '9.9.9-0000.0', buscar: 'clips', cantidad: 5, unidad: 'CAJA', aclaracion: '' }
    ]
  };
  const pegado = 'Claro, acá está el JSON:\n```json\n' +
    JSON.stringify(cuerpo, null, 2) + '\n```\nEspero que sirva.';

  const msj = await pegar(pegado);
  assert.match(msj, /Plantilla importada/, 'el asistente contesta que la importó: ' + msj);
  assert.match(msj, /Renglón 3: el código 9\.9\.9-0000\.0 no está en el catálogo; quedó para buscar/,
    'el código inexistente se dice con su renglón y qué pasó: ' + msj);

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, 3, 'entran los tres renglones, no se rechaza nada');

  assert.strictEqual(renglones[0].codigo, CODIGO_PAPELERIA, 'el primero conserva su código');
  assert.ok(renglones[0].item && renglones[0].item !== renglones[0].codigo,
    'el primero sale con la descripción ONC del catálogo: ' + renglones[0].item);
  assert.notStrictEqual(renglones[0].porBuscar, true, 'el primero no queda por buscar');

  assert.strictEqual(renglones[1].porBuscar, true, 'el renglón sin código queda por buscar');
  assert.strictEqual(renglones[1].buscar, 'cartuchera', 'queda con el texto buscado');
  assert.strictEqual(renglones[1].cantidad, 3, 'conserva la cantidad que traía');
  assert.strictEqual(renglones[1].aclaracion, 'con cierre', 'conserva la aclaración que traía');

  assert.strictEqual(renglones[2].porBuscar, true, 'el código inexistente también queda por buscar');
  assert.strictEqual(renglones[2].codigo, '', 'y pierde el código que no existe');

  assert.deepStrictEqual(m.red.llamadas, [],
    'importar lo pegado no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('RONDA-33 pieza 1 · un texto pegado que no es JSON no carga nada', async () => {
  await entrarComoUsuario();

  const msj = await pegar('Perdón, no entendí los documentos. Probá de nuevo.');

  assert.match(msj, /No se pudo importar/, 'avisa que no se pudo importar: ' + msj);
  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 0,
    'no se cargó ningún renglón: nada a medias');
});

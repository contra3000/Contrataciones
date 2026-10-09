'use strict';

/*
 * ronda-33-p2.test.js
 * RONDA-33 · pieza 2 · "Completar los renglones 'por buscar' en pantalla"
 * (ORDEN-RONDA-33 pieza 2).
 *
 * Un renglón sin ítem elegido (por buscar) tiene que poder cerrarse en pantalla:
 *
 *  1. con uno "por buscar", "Siguiente" no pasa y lleva a ese renglón;
 *  2. "Buscar" pone el texto en el buscador y el ítem elegido REEMPLAZA a ese
 *     renglón, conservando cantidad y aclaración, y no agrega uno nuevo;
 *  3. "Guardar avance" con uno "por buscar" se reimporta igual, todavía por buscar;
 *  4. "Exportar para Abastecimiento" queda deshabilitado mientras haya alguno
 *     por buscar, y se dice por qué;
 *  5. el LEEME.txt del paquete suma la sección "Llenar con un asistente de IA".
 *
 * Todo por la pantalla: el catálogo es el real, entra por <script>, y el
 * generador corre en la montura sin servidor (helpers/generador-montura.js).
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');
const EMPAQUETAR = require('../tools/empaquetar-generador.js');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function entrarComoUsuario() {
  await m.correr();
  m.limpiarDescargas();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
}

// La plantilla de la pieza 1: un renglón con código del catálogo y uno sin
// código, con el texto con el que la persona lo va a buscar.
function plantillaConPorBuscar() {
  return JSON.stringify({
    formato: 'sgc-requerimiento/1',
    titulo: 'Resmas A4',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: 'Se necesita papel para el área.',
    objetivo: '',
    renglones: [
      { codigo: '2.9.6-1115.1', cantidad: 2, unidad: 'UN', aclaracion: '' },
      { codigo: '', buscar: 'papel', cantidad: 3, unidad: 'UN', aclaracion: 'Papel obra' }
    ]
  });
}

async function importarTexto(texto) {
  m.elegirArchivo(texto, 'plantilla.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000, 'el asistente no contestó');
  return m.msjArchivo().textContent;
}

function listaRenglones() {
  return m.documento.getElementById('sgc-lista-renglones');
}

test('RONDA-33 pieza 2 · con un renglón por buscar, "Siguiente" no pasa y lleva a ese renglón',
  async () => {
    await entrarComoUsuario();
    await importarTexto(plantillaConPorBuscar());

    const filas = listaRenglones().children;
    assert.strictEqual(filas.length, 2, 'entran los dos renglones de la plantilla');
    assert.ok(filas[1].classList.contains('renglon-por-buscar'),
      'el renglón sin código se ve como "por buscar"');

    m.documento.getElementById('sgc-siguiente').click();

    assert.ok(m.documento.getElementById('sgc-paso-fundamentacion').hidden,
      'no se avanzó de paso con un renglón por buscar');
    assert.strictEqual(m.documento.getElementById('sgc-paso-renglones').hidden, false,
      'seguimos en el paso de renglones');
    assert.match(m.documento.getElementById('sgc-paso-msj').textContent,
      /Renglón 2: falta elegir el ítem del catálogo/,
      'el motivo dice cuál renglón y qué falta: ' +
        m.documento.getElementById('sgc-paso-msj').textContent);

    const boton = filas[1].querySelector('[data-buscar]');
    assert.ok(boton, 'el renglón por buscar tiene su botón "Buscar"');
    assert.strictEqual(m.documento.activeElement, boton,
      'con lo de la ronda 31, el foco fue al botón "Buscar" del renglón con error');
  });

test('RONDA-33 pieza 2 · "Buscar" llena el buscador y el ítem elegido reemplaza al renglón',
  async () => {
    await entrarComoUsuario();
    await importarTexto(plantillaConPorBuscar());

    const fila2 = listaRenglones().children[1];
    fila2.querySelector('[data-buscar]').click();
    assert.strictEqual(m.documento.getElementById('sgc-campo-clases').value, 'papel',
      '"Buscar" puso el texto del renglón en el buscador');

    await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
      'opción de la clase renderizada');
    m.mousedown('sgc-opcion-clase-0');
    await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
      'ítems de la clase cargados');
    const elegido = SGC().catalogo.buscador.obtenerEstado().itemsFiltrados[0];
    m.mousedown('sgc-opcion-item-0');
    await m.esperar(() => SGC().catalogo.renglones.obtener()[1].porBuscar !== true, 20000,
      'el renglón 2 dejó de estar por buscar');

    const renglones = SGC().catalogo.renglones.obtener();
    assert.strictEqual(renglones.length, 2, 'el ítem elegido reemplaza: siguen siendo dos renglones');
    assert.strictEqual(renglones[1].codigo, elegido.codigo, 'el renglón 2 quedó con el código elegido');
    assert.strictEqual(renglones[1].item, elegido.item, 'y con su descripción');
    assert.strictEqual(renglones[1].cantidad, 3, 'se conservó la cantidad que traía');
    assert.strictEqual(renglones[1].aclaracion, 'Papel obra', 'se conservó la aclaración que traía');
    assert.notStrictEqual(renglones[1].porBuscar, true, 'ya no está por buscar');
    assert.ok(!listaRenglones().children[1].classList.contains('renglon-por-buscar'),
      'la fila dejó de verse en rojo');
  });

test('RONDA-33 pieza 2 · "Guardar avance" con un renglón por buscar se reimporta igual',
  async () => {
    await entrarComoUsuario();
    await importarTexto(plantillaConPorBuscar());

    const antes = m.descargas.length;
    m.documento.getElementById('sgc-guardar-avance').click();
    await m.esperar(() => m.descargas.length > antes, 20000, 'el avance no se descargó');
    const descarga = m.descargas[m.descargas.length - 1];
    const texto = await descarga.texto();
    const archivo = JSON.parse(texto);
    assert.strictEqual(archivo.expediente.renglones[1].porBuscar, true,
      'el avance guarda el renglón por buscar como tal');
    assert.strictEqual(archivo.expediente.renglones[1].buscar, 'papel',
      'y conserva el texto con el que se lo buscará');

    // Se reimporta en una sesión nueva, como cuando la persona retoma.
    await entrarComoUsuario();
    const respuesta = await importarTexto(texto);
    assert.match(respuesta, /Avance importado/i, 'se reconoce el avance: ' + respuesta);
    const renglones = SGC().catalogo.renglones.obtener();
    assert.strictEqual(renglones.length, 2, 'vuelven los dos renglones');
    assert.strictEqual(renglones[1].porBuscar, true, 'el renglón sigue por buscar');
    assert.strictEqual(renglones[1].buscar, 'papel', 'y con su texto para buscar');
  });

test('RONDA-33 pieza 2 · "Exportar para Abastecimiento" queda deshabilitado con uno por buscar',
  async () => {
    await entrarComoUsuario();
    await importarTexto(plantillaConPorBuscar());

    const boton = m.documento.getElementById('sgc-btn-exportar');
    assert.strictEqual(boton.disabled, true,
      'no se puede exportar mientras haya un renglón por buscar');
    const msj = m.documento.getElementById('sgc-exportar-msj');
    assert.strictEqual(msj.hidden, false, 'se dice por qué no se puede exportar');
    assert.match(msj.textContent, /ítem del catálogo/i,
      'el motivo nombra el ítem que falta elegir: ' + msj.textContent);
  });

test('RONDA-33 pieza 2 · el LEEME del paquete explica cómo llenar con un asistente de IA', () => {
  const leeme = EMPAQUETAR.leerLeeme('r33-x', '09/10/2026');
  assert.match(leeme, /LLENAR CON UN ASISTENTE DE IA/,
    'la sección nueva del LEEME existe');
  assert.match(leeme, /Descargar plantilla vacía/,
    'el paso 1 nombra el botón de la plantilla');
  assert.match(leeme, /Completá/,
    'el paso 2 pide completar la plantilla con el asistente');
  assert.match(leeme, /esta plantilla siguiendo sus instrucciones/,
    'con la frase de la orden');
  assert.match(leeme, /por buscar/, 'explica que lo que no tiene código queda por buscar');
  assert.match(leeme, /r33-x · 09\/10\/2026/, 'la línea de versión sigue saliendo del paquete');
});

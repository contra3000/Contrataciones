'use strict';

/*
 * ronda-39-p2.test.js
 * RONDA-39 · pieza 2 · "Los códigos con separadores raros" (ORDEN-RONDA-39).
 *
 * En los documentos los códigos del catálogo vienen con tabulaciones, guiones o
 * puntos de más (`3.3.3   1627  36`). El importador normaliza el código antes de
 * validarlo: si tiene la forma d.d.d-NNNN.N lo reescribe, así entra por su
 * descripción en vez de quedar "por buscar". Un código que de verdad no existe
 * conserva el "buscar" del asistente.
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. "Pegar texto" con los cuatro códigos de la tabla: los cuatro entran como
 *     `3.3.3-1627.36`, ninguno "por buscar", y el aviso dice que se acomodaron.
 *  2. Un renglón con `9.9.9-0000.0` y "buscar": "matafuego" queda "por buscar" y
 *     "Buscar" pone "matafuego" en el buscador.
 *  3. La plantilla trae las instrucciones nuevas (el código se copia tal cual y
 *     el SGC lo acomoda).
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO = '3.3.3-1627.36';

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

function plantilla(renglones) {
  return JSON.stringify({
    formato: 'sgc-requerimiento/1',
    titulo: 'Insumos varios',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: 'Se necesita reponer insumos.',
    objetivo: '',
    renglones: renglones
  });
}

test('RONDA-39 pieza 2a · los códigos con separadores raros se acomodan y entran con descripción, sin quedar por buscar', async () => {
  await entrarComoUsuario();

  // Los cuatro códigos de la tabla de la orden: mismo ítem, cuatro formas de
  // escribirlo con espacios, tabulaciones, puntos o guiones de más.
  const msj = await pegar(plantilla([
    { codigo: '3.3.3   1627  36', buscar: 'resma', cantidad: 1, unidad: 'UN', aclaracion: '' },
    { codigo: '3.3.3\t\t1627\t\t36', buscar: 'resma', cantidad: 2, unidad: 'UN', aclaracion: '' },
    { codigo: '3.3.3-1627-36', buscar: 'resma', cantidad: 3, unidad: 'UN', aclaracion: '' },
    { codigo: '3.3.3.1627.36', buscar: 'resma', cantidad: 4, unidad: 'UN', aclaracion: '' }
  ]));

  assert.match(msj, /Plantilla importada/, 'el archivo entra: ' + msj);
  assert.match(msj, /4 códigos se acomodaron a la forma del catálogo/,
    'el aviso dice cuántos códigos se acomodaron: ' + msj);

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, 4, 'entran los cuatro renglones');
  renglones.forEach((r, i) => {
    assert.strictEqual(r.codigo, CODIGO,
      'el renglón ' + (i + 1) + ' se guarda con el código normalizado');
    assert.notStrictEqual(r.porBuscar, true,
      'el renglón ' + (i + 1) + ' no queda por buscar');
    assert.ok(r.item && r.item !== r.codigo,
      'el renglón ' + (i + 1) + ' sale con la descripción del catálogo: ' + r.item);
  });
});

test('RONDA-39 pieza 2b · un código inexistente conserva el "buscar" y "Buscar" lo pone en el buscador', async () => {
  await entrarComoUsuario();

  const msj = await pegar(plantilla([
    { codigo: '9.9.9-0000.0', buscar: 'matafuego', cantidad: 2, unidad: 'UN', aclaracion: '' }
  ]));

  assert.match(msj, /Plantilla importada/, 'el archivo entra: ' + msj);
  assert.match(msj, /el código 9\.9\.9-0000\.0 no está en el catálogo; quedó para buscar/,
    'el código inexistente se dice con qué pasó: ' + msj);

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, 1, 'entra el renglón');
  assert.strictEqual(renglones[0].porBuscar, true, 'queda por buscar');
  assert.strictEqual(renglones[0].buscar, 'matafuego',
    'conserva el "buscar" del asistente, no el código');

  // "Buscar" lleva esas palabras al buscador de ítems del catálogo.
  const botonBuscar = m.documento.getElementById('sgc-lista-renglones')
    .querySelector('[data-buscar]');
  assert.ok(botonBuscar, 'el renglón por buscar muestra su botón "Buscar"');
  botonBuscar.click();
  assert.strictEqual(m.documento.getElementById('sgc-buscar-item').value, 'matafuego',
    'y "Buscar" pone "matafuego" en "Buscar ítem": ' +
      m.documento.getElementById('sgc-buscar-item').value);
});

test('RONDA-39 pieza 2c · la plantilla trae las instrucciones nuevas del código', async () => {
  await entrarComoUsuario();

  const descarga = await m.bajarPlantilla();
  const plantillaDescargada = JSON.parse(await descarga.texto());
  const instrucciones = plantillaDescargada.instrucciones;

  assert.match(instrucciones, /copialo tal como\s+aparezca en los documentos/,
    'la regla dice que el código se copia tal cual: ' + instrucciones);
  assert.match(instrucciones, /el SGC lo acomoda/,
    'y que el SGC lo acomoda: ' + instrucciones);
  assert.match(instrucciones, /3\.3\.3 1627 36/,
    'con el ejemplo de la orden: ' + instrucciones);
  assert.ok(!instrucciones.includes('con la forma 2.9.6-1115.1'),
    'ya no pide la forma exacta: ' + instrucciones);
});

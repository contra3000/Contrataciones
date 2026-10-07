'use strict';

/*
 * ronda-31-p1.test.js
 * RONDA-31 · pieza 1 · "Un documento de referencia no es un archivo que se
 * sube: es un archivo que se ELIGE y se sella" (ORDEN-RONDA-31 pieza 1).
 *
 * El generador no tiene servidor ni carpeta: no hay a dónde subir un PDF. Lo
 * que hay es elegir el archivo en la propia máquina y anotar su huella. Lo que
 * se comprueba acá:
 *  - el documento (presupuesto, precio de plaza o justificación) se anota al
 *    elegir el archivo, con su tamaño y su SHA-256, y la fecha guardada en ISO;
 *  - la huella que quedó es la de los bytes de verdad, verificada con Node —
 *    la misma cuenta que hace la pieza 2 al leer el exportado;
 *  - una justificación es un documento de referencia como los otros, y un
 *    renglón con UN valor y UNA justificación está completo para imprimir y
 *    exportar (la regla de la ronda 31);
 *  - lo impreso acompaña los documentos: la leyenda dice qué se adjunta, con
 *    su tipo y su fecha.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const gm = require('./helpers/generador-montura.js');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

// La huella como la calcula Node leyendo los bytes: lo que la pieza 2 tiene que
// poder reproducir cuando abre el exportado.
function sha256De(texto) {
  return crypto.createHash('sha256').update(Buffer.from(texto, 'utf8')).digest('hex');
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

async function irAlPasoRenglones() {
  const d = m.documento;
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');
}

async function agregarRenglonReal(indice, claseNombre) {
  m.escribir('sgc-campo-clases', claseNombre);
  await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
    'opción de la clase renderizada');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
    'ítems de la clase cargados');
  m.mousedown('sgc-opcion-item-0');
  await m.esperar(() => m.documento.getElementById('sgc-lista-renglones').children.length === indice + 1,
    20000, 'renglón ' + (indice + 1) + ' agregado');
  const fila = m.documento.getElementById('sgc-lista-renglones').children[indice];
  m.escribirEnNodo(fila.querySelector('[aria-label="Unidad de medida"]'), 'UN');
}

async function claseConItems() {
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 1, 'el catálogo real tiene clases con ítems');
  return clases;
}

test('RONDA-31 pieza 1a · el documento de referencia se elige como archivo y su huella es la de sus bytes', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const contenido = 'precio de plaza resma color 2026';
  const anotado = await m.agregarDocumento({
    nombre: 'precio-plaza-resma-color-2026.pdf',
    proveedor: 'Comercial Casas',
    fecha: '10/02/2026',
    tipo: 'precio-plaza',
    contenido
  });

  assert.strictEqual(anotado.tipo, 'precio-plaza',
    'el documento se anota con el tipo que se eligió');
  assert.strictEqual(anotado.fecha, '2026-02-10', 'la fecha se guarda en ISO');
  assert.strictEqual(anotado.bytes, Buffer.byteLength(contenido, 'utf8'),
    'el tamaño anotado es el de los bytes del archivo');
  assert.strictEqual(anotado.sha256, sha256De(contenido),
    'la huella es la de los bytes de verdad, como la lee Node');

  const texto = d.getElementById('sgc-presup-lista').textContent;
  assert.match(texto, /precio-plaza-resma-color-2026\.pdf · Comercial Casas · 10\/02\/2026/,
    'la lista muestra nombre, proveedor y fecha en dd/mm/aaaa: ' + texto);
  assert.match(texto, /Precio de plaza/, 'y dice de qué tipo es');

  // No hay a dónde subir el original: elegir y sellar no pide nada por red.
  assert.deepStrictEqual(m.red.llamadas, [],
    'elegir el archivo y sellarlo no pide nada por red');
});

test('RONDA-31 pieza 1b · una justificación es un documento de referencia, y un renglón con un valor y esa justificación está completo', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const just = await m.agregarDocumento({
    nombre: 'justificacion-folio-2026.pdf',
    tipo: 'justificacion',
    contenido: 'no se consigue el precio de plaza para el folio'
  });
  assert.strictEqual(just.tipo, 'justificacion',
    'la justificación se anota como documento de referencia, con su tipo');

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);

  // La pareja completa de la ronda 31: UN valor de referencia y UNA
  // justificación por qué no hay un segundo valor.
  const presupuesto = await m.agregarDocumento({
    nombre: 'presupuesto-folio-2026.pdf',
    proveedor: 'Librería Sur',
    fecha: '12/02/2026',
    contenido: 'presupuesto folio 2026'
  });
  m.cargarValores([
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '820' },
      { presupuestoId: just.id, justificacion: true }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'El folio se compra directo al proveedor del presupuesto.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  d.getElementById('sgc-btn-imprimir').click();

  const exportar = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportar.disabled, false,
    'un valor y una justificación es la pareja completa: se puede exportar');
  assert.strictEqual(d.getElementById('sgc-exportar-msj').hidden, true,
    'y no queda motivo de valores que dar');
});

test('RONDA-31 pieza 1c · lo impreso acompaña los documentos: la leyenda dice qué se adjunta, con su tipo y su fecha', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const presupuesto = await m.agregarDocumento({
    nombre: 'presupuesto-resma-2026.pdf',
    tipo: 'presupuesto',
    proveedor: 'Librería Sur',
    fecha: '12/02/2026',
    contenido: 'presupuesto resma 2026'
  });
  const precioPlaza = await m.agregarDocumento({
    nombre: 'precio-plaza-resma-2026.pdf',
    tipo: 'precio-plaza',
    proveedor: 'Comercial Casas',
    fecha: '10/02/2026',
    contenido: 'precio de plaza resma 2026'
  });
  const just = await m.agregarDocumento({
    nombre: 'justificacion-resma-2026.pdf',
    tipo: 'justificacion',
    contenido: 'justificacion resma 2026'
  });

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);
  await agregarRenglonReal(1, clases[1][2]);
  m.cargarValores([
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '4200' },
      { presupuestoId: precioPlaza.id, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '820' },
      { presupuestoId: just.id, justificacion: true }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'El papel hace falta en el área.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  d.getElementById('sgc-btn-imprimir').click();

  const texto = d.getElementById('sgc-generador-impresion').textContent;
  const leyenda = 'Se acompañan como adjuntos:';
  assert.strictEqual(texto.split(leyenda).length - 1, 1,
    'la leyenda acompaña lo impreso y sale una sola vez');
  assert.ok(texto.indexOf(leyenda + ' Presupuesto presupuesto-resma-2026.pdf (Librería Sur, 12/02/2026);') !== -1,
    'cita el presupuesto con su tipo, proveedor y fecha');
  assert.ok(texto.indexOf('Precio de plaza precio-plaza-resma-2026.pdf (Comercial Casas, 10/02/2026);') !== -1,
    'cita el precio de plaza con su tipo');
  assert.ok(texto.indexOf('Justificación justificacion-resma-2026.pdf') !== -1,
    'cita la justificación, aunque no tenga proveedor ni fecha');

  // Y el exportado lleva el documento sellado: tipo, bytes y huella, con la
  // huella que reproduce Node leyendo el archivo (la auditoría de la pieza 2).
  const contenidos = {
    'presupuesto-resma-2026.pdf': 'presupuesto resma 2026',
    'precio-plaza-resma-2026.pdf': 'precio de plaza resma 2026',
    'justificacion-resma-2026.pdf': 'justificacion resma 2026'
  };
  d.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > 0, 10000, 'el exportado no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  const docs = archivo.expediente.presupuestos;
  assert.strictEqual(docs.length, 3, 'el exportado lleva los tres documentos');
  for (const doc of docs) {
    const contenido = contenidos[doc.nombreOriginal];
    assert.ok(contenido, 'documento esperado: ' + doc.nombreOriginal);
    assert.ok(doc.tipo, 'el JSON trae el tipo de ' + doc.nombreOriginal);
    assert.strictEqual(doc.bytes, Buffer.byteLength(contenido, 'utf8'),
      'el JSON trae los bytes de ' + doc.nombreOriginal);
    assert.strictEqual(doc.sha256, sha256De(contenido),
      'la huella del JSON es la que calcula Node para ' + doc.nombreOriginal);
  }
});
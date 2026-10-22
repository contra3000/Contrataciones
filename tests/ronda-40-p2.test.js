'use strict';

/*
 * ronda-40-p2.test.js
 * RONDA-40 — pieza 2 — "Buscar ítem en todo el catálogo" (ORDEN-RONDA-40
 * pieza 2, puntos 2a a 2g).
 *
 * Por la pantalla del generador (ADR-044), con el catálogo real y sin servidor:
 *
 *  1. las tres búsquedas de la tabla traen el resultado que la orden pide;
 *  2. elegir con el mouse suma un solo renglón, cierra la lista y no duplica;
 *  3. con flechas y Enter se elige igual y la lista se cierra;
 *  4. elegir una clase y su ítem con triple clic deja un solo renglón y cierra
 *     #sgc-lista-items (sólo en el generador);
 *  5. "Buscar" de un renglón por buscar pone el texto en "Buscar ítem" y el
 *     ítem elegido reemplaza al renglón conservando cantidad y aclaración;
 *  6. el requerimiento así armado exporta y el JSON trae el código elegido;
 *  7. dos builds del catálogo completo dan busqueda.js igual byte a byte, con
 *     159.366 ítems.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const NODE = process.execPath;
const BUILD = path.join(RAIZ, 'tools', 'build-catalogo.js');
const COMPLETO = path.join(RAIZ, 'datos-prueba', 'catalogo_incisos.json');
const FIXTURE = path.join(__dirname, 'fixtures', 'r33-completo.json');

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
  m.limpiarDescargas();
}

function listaBusqueda() {
  return m.documento.getElementById('sgc-lista-buscar-item');
}

function codigosVisibles(cantidad) {
  return listaBusqueda().children.slice(0, cantidad)
    .map((li) => li.children[0].textContent);
}

async function buscarItem(texto) {
  m.escribir('sgc-buscar-item', texto);
  await m.esperar(() => SGC().catalogo.buscador.obtenerEstado().busquedaCargada,
    60000, 'no se cargó el índice de búsqueda');
  await m.esperar(() => SGC().catalogo.buscador.obtenerEstado().buscarItem.length > 0,
    30000, 'la búsqueda no trajo resultados');
  return SGC().catalogo.buscador.obtenerEstado();
}

function listaRenglones() {
  return m.documento.getElementById('sgc-lista-renglones');
}

function filaConCodigo(codigo) {
  for (const li of listaBusqueda().children) {
    if (li.children[0].textContent === codigo) {
      return li;
    }
  }
  return null;
}

async function importarTexto(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'archivo.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó');
  return m.msjArchivo().textContent;
}

async function archivoPorBuscar() {
  const archivo = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  archivo.expediente.renglones = [{
    codigo: '',
    item: '',
    cantidad: 4,
    unidad: 'UN',
    aclaracion: 'Aclaración de prueba',
    valoresReferencia: [],
    porBuscar: true,
    buscar: 'mantenimiento matafuego'
  }];
  delete archivo.sello.huella;
  archivo.sello.huella = await SGC().generadorIntercambio.huellaDe(archivo);
  return JSON.stringify(archivo);
}

function escribirEnFila(indice, etiqueta, valor) {
  const fila = listaRenglones().children[indice];
  const campo = fila.querySelector('[aria-label="' + etiqueta + '"]');
  assert.ok(campo, 'la fila ' + (indice + 1) + ' tiene el campo ' + etiqueta);
  campo.value = String(valor);
  campo.emit('input', { target: campo });
}

function ejecutarBuild(salida) {
  const res = spawnSync(NODE, [BUILD, '--entrada', COMPLETO, '--salida', salida], {
    encoding: 'utf8',
    timeout: 180000
  });
  assert.strictEqual(res.status, 0, 'el build falló:\n' + res.stdout + res.stderr);
  return res.stdout;
}

function datosDeBusqueda(texto) {
  const inicio = texto.indexOf(',') + 1;
  const fin = texto.lastIndexOf(');');
  return JSON.parse(texto.slice(inicio, fin));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('RONDA-40 pieza 2a — las tres búsquedas de la tabla traen lo que la orden pide', async () => {
  await entrarComoUsuario();

  const primera = await buscarItem('mantenimiento recarga matafuego');
  const cinco = codigosVisibles(5);
  assert.ok(cinco.includes('3.3.3-1627.36'),
    'entre los cinco primeros está 3.3.3-1627.36: ' + cinco.join(', '));
  assert.ok(cinco.includes('3.3.9-8881.1'),
    'y 3.3.9-8881.1: ' + cinco.join(', '));
  assert.match(primera.dom.conteoBuscarItem.textContent, /1225 coincidencias/,
    'el conteo dice las coincidencias: ' + primera.dom.conteoBuscarItem.textContent);
  assert.match(primera.dom.conteoBuscarItem.textContent, /se muestran las primeras 60/,
    'y que sólo se muestran las primeras 60');

  const reparacion = await buscarItem('reparacion matafuegos');
  const tres = codigosVisibles(3);
  assert.ok(tres.every((codigo) => codigo.startsWith('3.3.3-1627.')),
    'los tres primeros son de 3.3.3-1627: ' + tres.join(', '));
  assert.ok(!reparacion.buscarItem.slice(0, 10).some((r) => /POSTRES/i.test(r.item)),
    'ningún POSTRES entre los diez primeros');

  const valvula = await buscarItem('válvula esférica');
  assert.match(valvula.buscarItem[0].item, /^VALVULAS ESFERICAS/,
    'la primera coincidencia es de válvulas esféricas: ' + valvula.buscarItem[0].item);
});

test('RONDA-40 pieza 2b — el mouse suma un solo renglón, cierra la lista y no duplica', async () => {
  await entrarComoUsuario();
  await buscarItem('mantenimiento recarga matafuego');

  const primera = codigosVisibles(1)[0];
  assert.strictEqual(primera, '3.3.3-1627.36', 'la primera opción es la esperada');
  m.mousedown('sgc-opcion-buscar-item-0');

  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 1,
    'elegir agrega exactamente un renglón');
  assert.strictEqual(listaBusqueda().hidden, true, 'la lista se cerró');
  assert.strictEqual(SGC().catalogo.renglones.obtener()[0].codigo, '3.3.3-1627.36',
    'el renglón quedó con el código elegido');

  escribirEnFila(0, 'Cantidad del ítem', 2);
  escribirEnFila(0, 'Unidad de medida', 'UN');
  const error = listaRenglones().children[0].children[
    listaRenglones().children[0].children.length - 1];
  assert.strictEqual(error.hidden, true,
    'con cantidad y unidad el renglón no tiene error: ' + error.textContent);

  m.mousedown('sgc-opcion-buscar-item-0');
  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 1,
    'otro clic en la lista cerrada no agrega un segundo renglón');
});

test('RONDA-40 pieza 2c — con flechas y Enter se elige y la lista se cierra', async () => {
  await entrarComoUsuario();
  await buscarItem('mantenimiento recarga matafuego');

  const campo = m.documento.getElementById('sgc-buscar-item');
  campo.emit('keydown', { key: 'ArrowDown', preventDefault() {} });
  campo.emit('keydown', { key: 'Enter', preventDefault() {} });

  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 1,
    'Enter eligió el ítem activo');
  assert.strictEqual(SGC().catalogo.renglones.obtener()[0].codigo, '3.3.3-1627.36',
    'eligió la primera coincidencia');
  assert.strictEqual(listaBusqueda().hidden, true, 'la lista se cerró');
});

test('RONDA-40 pieza 2d — elegir clase y ítem con triple clic deja un renglón y cierra la lista de ítems', async () => {
  await entrarComoUsuario();

  m.escribir('sgc-campo-clases', 'valvulas');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
    'la clase no apareció');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
    'los ítems de la clase no llegaron');

  m.mousedown('sgc-opcion-item-0');
  m.mousedown('sgc-opcion-item-0');
  m.mousedown('sgc-opcion-item-0');

  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 1,
    'el triple clic agrega un solo renglón');
  assert.strictEqual(m.documento.getElementById('sgc-lista-items').hidden, true,
    'y la lista de ítems de la clase queda cerrada');
});

test('RONDA-40 pieza 2e — "Buscar" llena "Buscar ítem" y el ítem elegido reemplaza al renglón', async () => {
  await entrarComoUsuario();
  await importarTexto(await archivoPorBuscar());

  const fila = listaRenglones().children[0];
  assert.ok(fila.classList.contains('renglon-por-buscar'),
    'el renglón entró por buscar');
  const boton = fila.querySelector('[data-buscar]');
  assert.ok(boton, 'el renglón tiene su botón "Buscar"');
  boton.click();

  assert.strictEqual(m.documento.getElementById('sgc-buscar-item').value,
    'mantenimiento matafuego', '"Buscar" puso el texto en "Buscar ítem"');
  await m.esperar(() => SGC().catalogo.buscador.obtenerEstado().buscarItem.length > 0,
    60000, 'la búsqueda del renglón no trajo resultados');

  const opcion = filaConCodigo('3.3.3-1627.36');
  assert.ok(opcion, 'la coincidencia esperada está en la lista');
  m.mousedown(opcion.id);

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, 1, 'el ítem elegido reemplaza: sigue habiendo un renglón');
  assert.strictEqual(renglones[0].codigo, '3.3.3-1627.36', 'quedó con el código elegido');
  assert.strictEqual(renglones[0].cantidad, 4, 'se conservó la cantidad');
  assert.strictEqual(renglones[0].unidad, 'UN', 'se conservó la unidad');
  assert.strictEqual(renglones[0].aclaracion, 'Aclaración de prueba',
    'se conservó la aclaración');
  assert.notStrictEqual(renglones[0].porBuscar, true, 'ya no está por buscar');
});

test('RONDA-40 pieza 2f — el requerimiento con el ítem elegido exporta y el JSON trae ese código', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(fs.readFileSync(FIXTURE, 'utf8'));

  d.getElementById('sgc-anterior').click();
  m.elegirPac('1');
  m.escribir('sgc-lugar-entrega', 'Depósito de Intendencia, Hangar 3');
  m.elegirModalidad('comun');
  d.getElementById('sgc-siguiente').click();

  await buscarItem('mantenimiento recarga matafuego');
  const opcion = filaConCodigo('3.3.3-1627.36');
  assert.ok(opcion, 'la coincidencia esperada está en la lista');
  m.mousedown(opcion.id);

  escribirEnFila(2, 'Unidad de medida', 'UN');
  const presupuestos = SGC().generadorPresupuestos.listar().map((p) => p.id);
  assert.ok(presupuestos.length >= 2, 'el requerimiento importado trae sus presupuestos');
  m.cargarValores([[], [], [
    { presupuestoId: presupuestos[0], base: 'unitario', valor: 100 },
    { presupuestoId: presupuestos[1], base: 'unitario', valor: 110 }
  ]]);

  d.getElementById('sgc-siguiente').click();
  d.getElementById('sgc-siguiente').click();
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0,
    20000, 'los documentos se compusieron');

  const antes = m.descargas.length;
  const boton = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(boton.disabled, false, 'el requerimiento con el ítem elegido exporta');
  boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());

  assert.ok(archivo.expediente.renglones.some((r) => r.codigo === '3.3.3-1627.36'),
    'el JSON exportado trae el código elegido en "Buscar ítem"');
});

test('RONDA-40 pieza 2g — dos builds del catálogo completo dan busqueda.js igual, con 159.366 ítems',
  { timeout: 300000 }, (t) => {
    if (!fs.existsSync(COMPLETO)) {
      t.skip('datos-prueba/catalogo_incisos.json no está presente en este clon; la verificación contra el catálogo completo no corre acá.');
      return;
    }
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-r40-busqueda-A-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-r40-busqueda-B-'));
    try {
      ejecutarBuild(dirA);
      ejecutarBuild(dirB);
      const bytesA = fs.readFileSync(path.join(dirA, 'busqueda.js'));
      const bytesB = fs.readFileSync(path.join(dirB, 'busqueda.js'));
      assert.strictEqual(sha256(bytesA), sha256(bytesB),
        'las dos corridas producen el mismo busqueda.js');

      const datos = datosDeBusqueda(bytesA.toString('utf8'));
      assert.strictEqual(datos.length, 159366, 'el índice trae los 159.366 ítems');
      assert.ok(datos.every((e) => Array.isArray(e) && e.length === 2 &&
        typeof e[0] === 'string' && typeof e[1] === 'string'),
      'cada entrada es [codigo, item]');

      const versionado = path.join(RAIZ, 'app', 'catalogo', 'busqueda.js');
      if (fs.existsSync(versionado)) {
        assert.strictEqual(sha256(fs.readFileSync(versionado)), sha256(bytesA),
          'el busqueda.js versionado es el que produce el catálogo completo');
      }
    } finally {
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

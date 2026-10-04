'use strict';

/*
 * ronda-28-c4.test.js
 * RONDA-28 · pieza 4 · "plantilla, importar y exportar" (ORDEN-RONDA-28 §4,
 * ADR-044).
 *
 * El generador no tiene servidor, así que el archivo ES el transporte. Lo que se
 * prueba acá es el ida y vuelta completo, con la montura de
 * helpers/generador-montura.js: location.protocol = 'file:', sin servidor y con
 * fetch y XMLHttpRequest de espía. Los renglones son del CATÁLOGO REAL, que entra
 * por <script>, y los códigos se resuelven con el índice código -> clase.
 *
 * Los cinco casos que pide la orden:
 *  - exportar -> importar -> el contenido es igual, sin contar el sello;
 *  - importar -> corregir un campo y un renglón en el formulario -> exportar ->
 *    el JSON trae la corrección;
 *  - una plantilla llena de un fixture se importa;
 *  - un JSON con un código inexistente, o con un renglón con un solo valor ->
 *    error claro y nada cargado;
 *  - una huella alterada -> "el archivo fue modificado fuera del generador".
 *
 * Y además lo que hace que el circuito sea utilizable: el nombre del archivo, la
 * versión que sube, el formato declarado y el aviso de versión vieja.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function esperarCatalogo() {
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

async function entrarComoUsuario(nombre) {
  await m.correr();
  m.limpiarDescargas();
  await esperarCatalogo();
  m.setear('sgc-generador-nombre', nombre || 'Ana Pérez');
  // ORDEN-RONDA-29 pieza 2: la identidad son cuatro datos desde la ronda 29.
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
}

// ---------------------------------------------------------------------------
// Recorrido real: el mismo de la pieza 3, que es el que produce un requerimiento
// exportable (tres renglones del catálogo, un presupuesto de referencia y dos
// valores por renglón, más la EETT compuesta).
// ---------------------------------------------------------------------------

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

// Alta completa con la EETT compuesta, que es lo que habilita exportar.
async function altaExportable(nombre) {
  const d = m.documento;
  await entrarComoUsuario(nombre);
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');

  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  const elegidas = clases.slice(0, 3);
  for (let i = 0; i < elegidas.length; i++) {
    await agregarRenglonReal(i, elegidas[i][2]);
  }
  await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
    20000, 'los tres renglones quedan sin errores');

  m.escribir('sgc-presup-archivo', 'presupuesto-resma-2026.pdf');
  m.escribir('sgc-presup-proveedor', 'Librería Sur');
  m.escribir('sgc-presup-fecha', '12/02/2026');
  d.getElementById('sgc-presup-agregar').click();
  m.escribir('sgc-presup-archivo', 'presupuesto-resma-2026-b.pdf');
  m.escribir('sgc-presup-proveedor', 'Papelera Norte');
  m.escribir('sgc-presup-fecha', '13/02/2026');
  d.getElementById('sgc-presup-agregar').click();

  const presupuestos = SGC().generadorPresupuestos.listar();
  const presupuesto1 = presupuestos[0].id;
  const presupuesto2 = presupuestos[1].id;
  m.cargarValores([
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '4200' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '800' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '900' }],
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '15000' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '16000' }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'Se necesita papel para el área.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT compuesta');
  return { clases: elegidas, renglones: SGC().catalogo.renglones.obtener() };
}

// Exportar por el botón, como una persona: lee lo que se descargó.
async function exportarPorElBoton() {
  const d = m.documento;
  const antes = m.descargas.length;
  const exportar = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportar.disabled, false, 'con la EETT compuesta se puede exportar');
  exportar.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const descarga = m.descargas[m.descargas.length - 1];
  const texto = await descarga.texto();
  return { nombre: descarga.nombre, archivo: JSON.parse(texto), texto: texto };
}

// Importar un texto por el input de archivos, como una persona.
async function importarTexto(texto) {
  m.elegirArchivo(texto, 'requerimiento.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000, 'el asistente no contestó');
  return m.msjArchivo().textContent;
}

function renglonesEnPantalla() {
  return SGC().catalogo.renglones.obtener();
}

// ---------------------------------------------------------------------------
// La plantilla vacía
// ---------------------------------------------------------------------------

test('la plantilla se baja con su formato y se puede volver a subir vacía de valores', async () => {
  await entrarComoUsuario();

  const descarga = await m.bajarPlantilla();
  assert.match(descarga.nombre, /\.json$/, 'la plantilla se baja como .json');
  const plantilla = JSON.parse(await descarga.texto());
  assert.strictEqual(plantilla.formato, 'sgc-requerimiento/1',
    'la plantilla declara el formato, para que un archivo de otra versión se diga');
  assert.strictEqual(plantilla.formato, SGC().views.fasttrack.FORMATO,
    'el formato es el del Fast-Track, no una copia escrita en el HTML');
  assert.ok(Array.isArray(plantilla.renglones) && plantilla.renglones.length > 0,
    'la plantilla trae un renglón de ejemplo');
  assert.deepStrictEqual(m.red.llamadas, [],
    'bajar la plantilla no pide nada por red: ' + m.red.llamadas.join(', '));

  // Subida tal cual, sin tocar nada: es el caso de "la bajé y la volví a subir".
  const respuesta = await importarTexto(JSON.stringify(plantilla));
  assert.match(respuesta, /importad/i, 'el asistente contesta que la importó: ' + respuesta);
  assert.ok(!/No se pudo importar/.test(respuesta), 'una plantilla válida no se rechaza');

  const renglones = renglonesEnPantalla();
  assert.strictEqual(renglones.length, plantilla.renglones.length,
    'los renglones de la plantilla quedan en el formulario');
  assert.deepStrictEqual(m.red.llamadas, [],
    'importar la plantilla tampoco pide nada por red: ' + m.red.llamadas.join(', '));
});

// ---------------------------------------------------------------------------
// Exportar -> importar -> exportar: el contenido es el mismo
// ---------------------------------------------------------------------------

test('exportar, importar y volver a exportar da el mismo contenido: el sello es lo único que cambia',
  async () => {
    await altaExportable();

    const primera = await exportarPorElBoton();
    assert.strictEqual(primera.archivo.sello.formato, 'sgc-requerimiento/1',
      'el archivo declara su formato');
    assert.ok(typeof primera.archivo.sello.version === 'number', 'el sello lleva la versión');
    assert.match(primera.archivo.sello.huella, /^[0-9a-f]{64}$/,
      'la huella es un SHA-256 en hexadecimal');
    assert.ok(primera.archivo.sello.versionCatalogo, 'el sello dice con qué catálogo se armó');
    assert.ok(primera.archivo.sello.versionGenerador, 'el sello dice con qué generador se armó');
    assert.strictEqual(primera.archivo.sello.rol, 'generador', 'el sello dice de qué rol es');
    assert.strictEqual(primera.archivo.sello.nombre, 'Ana Pérez', 'el sello dice de quién es');

    // El nombre del archivo es lo que va a tener que escribir y mandar alguien.
    assert.strictEqual(primera.nombre, 'requerimiento-2026-resmas-a4-v1.json',
      'el nombre lleva el año, el título corto y la versión');

    // Ahora, como el Jefe: se importa el archivo y se sigue trabajando.
    await m.correr();
    m.limpiarDescargas();
    await esperarCatalogo();
    m.setear('sgc-generador-nombre', 'Ana Pérez');
    m.completarIdentidad();
    m.elegirRol('generador');
    await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');

    const respuesta = await importarTexto(primera.texto);
    assert.match(respuesta, /Requerimiento importado/i,
      'el asistente dice que importó un requerimiento: ' + respuesta);

    // Lo importado se ve en el formulario y se puede seguir editando.
    assert.strictEqual(m.documento.getElementById('sgc-titulo').value, 'Resmas A4',
      'el título quedó en el formulario');
    assert.strictEqual(m.documento.getElementById('sgc-justificacion').value,
      'Se necesita papel para el área.', 'la fundamentación quedó en el formulario');
    const renglones = renglonesEnPantalla();
    assert.strictEqual(renglones.length, 3, 'los tres renglones volvieron');
    assert.strictEqual(new Set(renglones.map((r) => r.codigo)).size, 3,
      'los tres renglones son tres códigos distintos: la lista se redibuja vacía antes de llenarse');
    assert.ok(renglones[0].item && renglones[0].item.length > 3,
      'el renglón volvió con la descripción del ítem, no sólo con el código');
    assert.strictEqual(SGC().generadorPresupuestos.listar().length, 2,
      'el presupuesto de referencia volvíó');
    assert.strictEqual(SGC().generadorValores.renglonesConValores()[0].valoresReferencia.length, 2,
      'los dos valores de referencia del primer renglón volvieron');

    // Exportar de nuevo: para que se pueda hay que volver a componer la EETT,
    // que es lo que exige el estado (ORDEN-RONDA-28 §3).
    m.documento.getElementById('sgc-btn-imprimir').click();
    await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
      'EETT compuesta tras importar');
    const segunda = await exportarPorElBoton();

    assert.strictEqual(segunda.nombre, 'requerimiento-2026-resmas-a4-v2.json',
      'la versión del requerimiento sube en cada exportación');
    assert.deepStrictEqual(segunda.archivo.expediente, primera.archivo.expediente,
      'el contenido va y vuelve igual: el sello es lo único que cambia');
  });

// ---------------------------------------------------------------------------
// Importar -> corregir -> exportar
// ---------------------------------------------------------------------------

test('corregir un campo y un renglón después de importar se ve en el JSON exportado',
  async () => {
    await altaExportable('Ana Pérez');
    const primera = await exportarPorElBoton();

    await m.correr();
    m.limpiarDescargas();
    await esperarCatalogo();
    m.setear('sgc-generador-nombre', 'Ana Pérez');
    m.completarIdentidad();
    m.elegirRol('generador');
    await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
    await importarTexto(primera.texto);

    // Las correcciones se hacen en el formulario, como cualquier otra.
    m.escribir('sgc-justificacion', 'Se necesita papel para el área y para el archivo.');
    const filas = m.documento.getElementById('sgc-lista-renglones').children;
    m.escribirEnNodo(filas[0].querySelector('[aria-label="Cantidad del ítem"]'), '7');

    m.documento.getElementById('sgc-btn-imprimir').click();
    await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
      'EETT compuesta');
    const segunda = await exportarPorElBoton();

    assert.match(segunda.archivo.expediente.campos.justificacion, /y para el archivo/,
      'la corrección del campo salió en el JSON');
    assert.strictEqual(segunda.archivo.expediente.renglones[0].cantidad, 7,
      'la corrección del renglón salió en el JSON');
    assert.notDeepStrictEqual(segunda.archivo.expediente, primera.archivo.expediente,
      'el archivo nuevo no es una copia del anterior');
  });

// ---------------------------------------------------------------------------
// Archivos que no entran
// ---------------------------------------------------------------------------

test('un código que no existe en el catálogo se dice con su renglón y no carga nada', async () => {
  await entrarComoUsuario();

  const antes = m.documento.getElementById('sgc-lista-renglones').children.length;
  const plantilla = {
    formato: 'sgc-requerimiento/1',
    titulo: 'Papel',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: 'Se necesita papel.',
    objetivo: '',
    renglones: [
      { codigo: '2.9.6-1115.1', cantidad: 2, unidad: 'UN', aclaracion: '' },
      { codigo: '9.9.9-0000.0', cantidad: 1, unidad: 'UN', aclaracion: '' }
    ]
  };
  const respuesta = await importarTexto(JSON.stringify(plantilla));

  assert.match(respuesta, /Renglón 2/, 'el error dice en qué renglón está: ' + respuesta);
  assert.match(respuesta, /9\.9\.9-0000\.0/, 'el error dice qué código no existe: ' + respuesta);
  assert.match(respuesta, /no existe en el cat/, 'el error dice por qué: ' + respuesta);
  assert.strictEqual(m.documento.getElementById('sgc-lista-renglones').children.length, antes,
    'no se cargó ningún renglón: nada a medias');
  assert.strictEqual(SGC().generadorPresupuestos.listar().length, 0,
    'tampoco se tocó el resto del formulario');
});

test('un renglón con un solo valor de referencia se rechaza con el texto de la ronda 26',
  async () => {
    await altaExportable('Ana Pérez');
    const primera = await exportarPorElBoton();

    // Se saca el segundo valor del segundo renglón, como si alguien lo hubiera
    // borrado del archivo con un editor de texto.
    const archivo = JSON.parse(primera.texto);
    archivo.expediente.renglones[1].valoresReferencia =
      archivo.expediente.renglones[1].valoresReferencia.slice(0, 1);

    await m.correr();
    m.limpiarDescargas();
    await esperarCatalogo();
    m.setear('sgc-generador-nombre', 'Ana Pérez');
    m.completarIdentidad();
    m.elegirRol('generador');
    await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');

    const respuesta = await importarTexto(JSON.stringify(archivo));
    assert.match(respuesta, /Renglón 2/, 'el error dice en qué renglón: ' + respuesta);
    assert.match(respuesta, /valores de referencia/i, 'el error dice qué falta: ' + respuesta);
    assert.strictEqual(renglonesEnPantalla().length, 0, 'no se cargó nada a medias');
  });

test('una huella que no calza dice que el archivo fue modificado fuera del generador', async () => {
  await altaExportable('Ana Pérez');
  const primera = await exportarPorElBoton();

  // Un número editado a mano: el contenido sigue siendo válido (el caso difícil,
  // donde la huella es la única que puede dar la voz).
  const archivo = JSON.parse(primera.texto);
  archivo.expediente.renglones[0].valoresReferencia[0].valor = 1;

  await m.correr();
  m.limpiarDescargas();
  await esperarCatalogo();
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');

  const respuesta = await importarTexto(JSON.stringify(archivo));
  assert.match(respuesta, /modificado fuera del generador/,
    'el motivo del rechazo es la modificación, dicho como lo dice la orden: ' + respuesta);
  assert.strictEqual(renglonesEnPantalla().length, 0, 'no se cargó nada a medias');
});

test('un archivo de otro formato se dice que es de otra versión, no que está mal formado',
  async () => {
    await entrarComoUsuario();
    const respuesta = await importarTexto(JSON.stringify({
      formato: 'sgc-requerimiento/9',
      titulo: 'Papel',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      justificacion: 'Se necesita papel.',
      renglones: [{ codigo: '2.9.6-1115.1', cantidad: 1, unidad: 'UN' }]
    }));
    assert.match(respuesta, /sgc-requerimiento\/9/, 'dice qué formato trae el archivo: ' + respuesta);
    assert.match(respuesta, /Actualizá el generador|exportá de nuevo/,
      'dice qué hacer: ' + respuesta);
  });

test('un archivo que no es ni plantilla ni requerimiento se rechaza sin tocar nada', async () => {
  await entrarComoUsuario();
  const antes = renglonesEnPantalla().length;
  const respuesta = await importarTexto('{"hola":"mundo"}');
  assert.match(respuesta, /no es ni la plantilla|ni un requerimiento exportado/,
    'dice qué es lo que espera: ' + respuesta);
  assert.strictEqual(renglonesEnPantalla().length, antes, 'no se cargó nada');
});

// ---------------------------------------------------------------------------
// La versión del requerimiento
// ---------------------------------------------------------------------------

test('importar una versión más vieja que otra ya importada avisa y sigue', async () => {
  await altaExportable('Ana Pérez');
  const primera = await exportarPorElBoton();
  assert.strictEqual(primera.archivo.sello.version, 1, 'la primera exportación es la v1');

  // Se exporta dos veces más: v2 y v3.
  m.documento.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT recompuesta');
  const segunda = await exportarPorElBoton();
  m.documento.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT recompuesta');
  const tercera = await exportarPorElBoton();
  assert.strictEqual(segunda.archivo.sello.version, 2, 'la segunda exportación es la v2');
  assert.strictEqual(tercera.archivo.sello.version, 3, 'la tercera exportación es la v3');

  // Ahora se importa la v3 y después la v1, que es más vieja.
  await m.correr();
  m.limpiarDescargas();
  await esperarCatalogo();
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
  await importarTexto(tercera.texto);
  const respuesta = await importarTexto(primera.texto);

  assert.match(respuesta, /versión 1/, 'el aviso dice qué versión es la vieja: ' + respuesta);
  assert.match(respuesta, /versión 3/, 'el aviso dice cuál se había importado: ' + respuesta);
  assert.match(respuesta, /importad/i, 'y el archivo se importa igual: ' + respuesta);

  // Y el siguiente número no vuelve atrás: se exporta la v4.
  m.documento.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT compuesta');
  const cuarta = await exportarPorElBoton();
  assert.strictEqual(cuarta.archivo.sello.version, 4,
    'tras importar la v3 el siguiente número es el 4, no el 2');
});
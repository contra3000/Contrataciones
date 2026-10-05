'use strict';

/*
 * ronda-30-p2.test.js
 * ORDEN-RONDA-30 · pieza 2 · "Guardar avance" que se descarga.
 *
 * La ronda 29 metió un "Guardar avance" que escribía en el localStorage del
 * navegador, y un botón aparte para volver a leerlo. Eso no sirve para nada
 * fuera de esa máquina: si la sesión se cae, el trabajo se pierde, y para
 * retomar no hay nada que retomar. Esta pieza cambia el botón por lo que tiene
 * que ser: un ARCHIVO, el mismo que baja "Exportar para Abastecimiento", con la
 * misma huella y el mismo formato, y nada de completitud.
 *
 * Lo que se prueba acá, apretando botones y no llamando funciones de las vistas:
 *
 *  1. con un renglón sin valores, en el paso 2, "Guardar avance" descarga el
 *     archivo y avisa al lado del botón;
 *  2. ese archivo se importa por el "Importar" de siempre y abre en el paso 2,
 *     con el renglón a medias como estaba;
 *  3. un byte cambiado a mano no entra: se dice que el archivo fue modificado
 *     fuera del generador;
 *  4. el `estado` del sello cambiado a mano tampoco entra, por la misma razón:
 *     el sello está firmado;
 *  5. si el catálogo de ahora llama al ítem de otra forma, queda la descripción
 *     del archivo y se avisa de la diferencia.
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

// Como F5 con doble clic: se rearma la pantalla y se espera el catálogo.
async function arrancar() {
  await m.correr();
  m.limpiarDescargas();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

// Los cuatro datos de la identidad y el rol, como una persona.
async function entrarComoUsuario() {
  m.escribirIdentidad({ grado: 'Cabo', nombre: 'Ana', apellido: 'Pérez', numeroControl: '12345' });
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

async function claseConItems() {
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 1, 'el catálogo real tiene clases con ítems');
  return clases;
}

// Un renglón del catálogo real, buscado por la pantalla como lo busca una
// persona: se escribe la clase, se elige y se elige el primer ítem.
async function agregarRenglonReal(indice, claseNombre, conUnidad) {
  m.escribir('sgc-campo-clases', claseNombre);
  await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
    'opción de la clase renderizada');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
    'ítems de la clase cargados');
  m.mousedown('sgc-opcion-item-0');
  await m.esperar(() => m.documento.getElementById('sgc-lista-renglones').children.length === indice + 1,
    20000, 'renglón ' + (indice + 1) + ' agregado');
  if (conUnidad !== false) {
    const fila = m.documento.getElementById('sgc-lista-renglones').children[indice];
    m.escribirEnNodo(fila.querySelector('[aria-label="Unidad de medida"]'), 'UN');
  }
}

function agregarPresupuesto(archivo, proveedor, fecha) {
  m.escribir('sgc-presup-archivo', archivo);
  m.escribir('sgc-presup-proveedor', proveedor);
  m.escribir('sgc-presup-fecha', fecha);
  m.documento.getElementById('sgc-presup-agregar').click();
}

function renglonesEnPantalla() {
  return SGC().catalogo.renglones.obtener();
}

// El <span> con la descripción que se ve en la fila del renglón. El stub del DOM
// entiende '#id' y '[attr]', no clases, así que se busca por children.
function buscarPorClase(nodo, clase) {
  if (nodo.className === clase) {
    return nodo;
  }
  for (const hijo of nodo.children) {
    const encontrado = buscarPorClase(hijo, clase);
    if (encontrado) {
      return encontrado;
    }
  }
  return null;
}

// "Guardar avance", apretado. Devuelve lo que se descargó.
async function guardarAvancePorElBoton() {
  const antes = m.descargas.length;
  m.documento.getElementById('sgc-guardar-avance').click();
  await m.esperar(() => m.descargas.length > antes, 20000, '"Guardar avance" no descargó nada');
  const descarga = m.descargas[m.descargas.length - 1];
  return { nombre: descarga.nombre, texto: await descarga.texto() };
}

// "Importar" del paso 1, con el archivo elegido como lo elige una persona.
async function importarTexto(texto, nombre) {
  const msj = m.msjArchivo();
  msj.hidden = true;
  m.elegirArchivo(texto, nombre || 'requerimiento.json');
  await m.esperar(() => msj.hidden === false, 20000, 'el asistente no contestó el archivo');
  return msj.textContent;
}

// El avance de siempre: un renglón sin valores, guardado en el paso 2. Es el
// caso que la ronda 29 no podía guardar, porque el botón escribía en el
// navegador y ni se enteraba de que faltaba nada.
async function avanceDeRenglonSinValores() {
  await arrancar();
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);
  return guardarAvancePorElBoton();
}

// Un avance que además está COMPLETO (con sus dos valores de presupuestos
// distintos y la justificación escrita), guardado desde el paso 3. Se usa para
// el caso del `estado` cambiado a mano: como el contenido está entero, lo único
// que puede rechazarlo es la firma.
async function avanceCompleto() {
  await arrancar();
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);
  agregarPresupuesto('presupuesto-resma-2026.pdf', 'Librería Sur', '12/02/2026');
  agregarPresupuesto('presupuesto-resma-2026-b.pdf', 'Papelera Norte', '13/02/2026');
  const [p1, p2] = SGC().generadorPresupuestos.listar().map((p) => p.id);
  m.cargarValores([
    [{ presupuestoId: p1, base: 'unitario', valor: '4200' },
      { presupuestoId: p2, base: 'unitario', valor: '4500' }]]);
  m.documento.getElementById('sgc-siguiente').click();
  await m.esperar(() => !m.documento.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'Se necesita papel para el área.');
  return guardarAvancePorElBoton();
}

// Cambiar en el catálogo de la montura la descripción de un código, como si el
// catálogo se hubiera actualizado después de que se guardara el archivo. Se
// cambia el dato del fragmento cargado, no una función: lo que cambia es el
// catálogo, no el código.
async function cambiarDescripcionDelCatalogo(codigo, descripcion) {
  const carga = SGC().catalogo.carga;
  await carga.cargarCodigos();
  const idClase = carga.obtenerEstado().codigos[codigo];
  assert.ok(idClase, 'el catálogo tiene el código ' + codigo);
  const items = await carga.cargarClase(idClase);
  const item = items.filter((i) => i.codigo === codigo)[0];
  assert.ok(item, 'el fragmento del catálogo tiene el ítem ' + codigo);
  item.item = descripcion;
}

// ---------------------------------------------------------------------------

test('RONDA-30 pieza 2 · 1 · "Guardar avance" con un renglón sin valores descarga el archivo', async () => {
  const d = m.documento;
  await arrancar();
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);

  const descarga = await guardarAvancePorElBoton();
  assert.match(descarga.nombre, /^requerimiento-2026-.+-v1-avance\.json$/,
    'el nombre dice qué es: el requerimiento, el año, el título, la versión y que es avance: ' +
    descarga.nombre);

  const archivo = JSON.parse(descarga.texto);
  assert.strictEqual(archivo.sello.formato, 'sgc-requerimiento/1',
    'es el mismo formato que el archivo de Abastecimiento, no un formato nuevo');
  assert.strictEqual(archivo.sello.estado, 'avance', 'el sello dice que este archivo es un avance');
  assert.strictEqual(archivo.sello.paso, 1,
    'el sello dice en qué paso quedó: el segundo, contado desde cero');
  assert.match(archivo.sello.huella, /^[0-9a-f]{64}$/,
    'el archivo va firmado, como el que baja "Exportar para Abastecimiento"');
  assert.strictEqual(archivo.expediente.renglones.length, 1, 'viaja el renglón que había cargado');
  assert.ok(archivo.expediente.renglones[0].valoresReferencia.every((v) => !v.presupuestoId),
    'y sus filas de valores van vacías, porque guardarlo no las completa');

  // El aviso va al lado del botón, no en el mensaje del paso 4, que desde el
  // paso 2 no se ve.
  const boton = d.getElementById('sgc-guardar-avance');
  const msj = d.getElementById('sgc-avance-msj');
  assert.strictEqual(msj.hidden, false, 'el aviso está a la vista');
  assert.strictEqual(msj.textContent, 'Se descargó ' + descarga.nombre + '.',
    'el aviso dice qué se descargó, con el nombre del archivo: ' + msj.textContent);
  assert.strictEqual(msj.parentNode, boton.parentNode,
    'el aviso está en la misma barra de botones que el que se apretó');
  assert.strictEqual(d.getElementById('sgc-generador-msj-revision').hidden, true,
    'el mensaje del paso 4 no se usó para esto: no se ve desde donde se aprieta');
  assert.deepStrictEqual(m.red.llamadas, [],
    'guardar el avance no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('RONDA-30 pieza 2 · 2 · el avance se importa por el "Importar" de siempre y abre en el paso 2', async () => {
  const descarga = await avanceDeRenglonSinValores();

  // Cerrar el generador y abrirlo de nuevo: se vuelve a entrar por la pantalla
  // de identidad, como el Jefe.
  await arrancar();
  await entrarComoUsuario();

  const respuesta = await importarTexto(descarga.texto);
  assert.match(respuesta, /Avance importado/, 'el asistente contesta qué importó: ' + respuesta);
  assert.ok(!/No se pudo importar/.test(respuesta),
    'no se pide completitud a un avance: ' + respuesta);

  const d = m.documento;
  assert.strictEqual(d.getElementById('sgc-paso-renglones').hidden, false,
    'abrió en el paso 2, que es donde se guardó');
  assert.strictEqual(d.getElementById('sgc-paso-identificacion').hidden, true,
    'y no en el paso 1, que es donde se importan las plantillas');
  assert.strictEqual(renglonesEnPantalla().length, 1, 'volvió el renglón que estaba a medias');
  assert.strictEqual(d.getElementById('sgc-titulo').value, 'Resmas A4',
    'y el título del archivo quedó en el formulario');
  assert.deepStrictEqual(SGC().generadorValores.renglonesConValores()[0].valoresReferencia
    .filter((v) => v.presupuestoId), [],
    'los valores de referencia volvieron vacíos, como estaban');
});

test('RONDA-30 pieza 2 · 3 · un byte cambiado a mano no entra: se dice que fue modificado', async () => {
  const descarga = await avanceDeRenglonSinValores();
  const archivo = JSON.parse(descarga.texto);
  // Un número editado a mano, con un editor de texto. El contenido sigue
  // estando bien, así que lo único que lo puede detectar es la firma.
  archivo.expediente.anio = '2027';

  await arrancar();
  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(archivo));

  assert.match(respuesta, /modificado fuera del generador/,
    'el motivo del rechazo es la modificación, con las palabras de la orden: ' + respuesta);
  assert.strictEqual(renglonesEnPantalla().length, 0, 'no se cargó nada a medias');
  assert.strictEqual(m.documento.getElementById('sgc-titulo').value, '',
    'ni se tocó el formulario');
});

test('RONDA-30 pieza 2 · 4 · el `estado` del sello cambiado a mano tampoco entra', async () => {
  // Un avance que ya está entero, para que lo único que pueda rechazarlo sea la
  // firma: cambiarle el estado a mano es cambiar el archivo, y el `estado` está
  // dentro de lo que la huella firma.
  const descarga = await avanceCompleto();
  assert.strictEqual(JSON.parse(descarga.texto).sello.paso, 2,
    'el avance se guardó desde el paso 3');
  const archivo = JSON.parse(descarga.texto);
  archivo.sello.estado = 'para-abastecimiento';

  await arrancar();
  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(archivo));

  assert.match(respuesta, /modificado fuera del generador/,
    'el motivo del rechazo es la modificación, con las palabras de la orden: ' + respuesta);
  assert.strictEqual(renglonesEnPantalla().length, 0, 'no se cargó nada a medias');
});

test('RONDA-30 pieza 2 · 5 · si el catálogo cambió la descripción, queda la del archivo y se avisa', async () => {
  const descarga = await avanceDeRenglonSinValores();
  const renglonDelArchivo = JSON.parse(descarga.texto).expediente.renglones[0];
  const codigo = renglonDelArchivo.codigo;
  const descripcionDelArchivo = renglonDelArchivo.item;
  assert.ok(descripcionDelArchivo && descripcionDelArchivo.length > 3,
    'el archivo tiene la descripción del ítem, que es la que hay que conservar');

  const nueva = 'Papel bond 90 g, nombre que cambió en el catálogo';
  await cambiarDescripcionDelCatalogo(codigo, nueva);

  await arrancar();
  await entrarComoUsuario();
  const respuesta = await importarTexto(descarga.texto);

  assert.strictEqual(renglonesEnPantalla()[0].item, descripcionDelArchivo,
    'queda la descripción del ARCHIVO: lo que se pidió, no lo que dice el catálogo de ahora');
  const fila = m.documento.getElementById('sgc-lista-renglones').children[0];
  const descripcionEnPantalla = buscarPorClase(fila, 'renglon-item');
  assert.ok(descripcionEnPantalla, 'la fila del renglón muestra su descripción');
  assert.strictEqual(descripcionEnPantalla.textContent, descripcionDelArchivo,
    'y en la pantalla se ve la del archivo, no la del catálogo');
  assert.match(respuesta, /cat.logo de ahora llama/,
    'se avisa de que el catálogo cambió la descripción: ' + respuesta);
  assert.ok(respuesta.indexOf(nueva) !== -1,
    'el aviso dice cómo lo llama el catálogo ahora: ' + respuesta);
  assert.ok(/queda la del archivo/i.test(respuesta),
    'y dice cuál se quedó: ' + respuesta);
});

'use strict';

/*
 * ronda-28-c3.test.js
 * RONDA-28 · pieza 3 · "rol Usuario: el requerimiento, los valores, los
 * documentos y la exportación" (ORDEN-RONDA-28 §3, ADR-044).
 *
 * La montura de helpers/generador-montura.js abre app/generador.html como lo
 * abre el Jefe: con location.protocol = 'file:', sin servidor levantado y con
 * fetch y XMLHttpRequest de espía. Los renglones salen del CATÁLOGO REAL, que
 * entra por <script>: no hay renglones de mentira en esta pieza, porque el
 * falsehood que importa acá es el del promedio (un renglón sin item imprime una
 * columna de descripción vacía y nadie lo nota).
 *
 * Lo que se comprueba:
 *  - el generador no ofrece "Avanzar" ni "Crear expediente": ofrece imprimir y
 *    exportar para Abastecimiento;
 *  - los presupuestos son REFERENCIAS (nombre, proveedor, fecha), no archivos
 *    subidos: no hay <input type="file"> de presupuestos en el generador;
 *  - el bloque de valores de referencia es el MISMO archivo que usa la pantalla
 *    de carga del requerimiento con servidor, no una copia;
 *  - un requerimiento con tres renglones reales y dos valores por renglón
 *    imprime la Solicitud de Gastos y la EETT con la descripción del ítem;
 *  - "Exportar para Abastecimiento" se habilita sólo cuando la validación de
 *    ESPECIFICACIONES_TECNICAS da válida, y antes dice qué falta con el texto de
 *    la ronda 26.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const APP_DIR = path.join(RAIZ, 'app');
const INDEX_HTML = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
const CSS_IMPRESION = fs.readFileSync(path.join(APP_DIR, 'css', 'impresion.css'), 'utf8');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function arrancar() {
  await m.correr();
  return m;
}

async function esperarCatalogo() {
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

// ---------------------------------------------------------------------------
// Recorrido real: nombre y rol, paso 1, tres renglones del catálogo, un
// presupuesto de referencia, dos valores por renglón, paso 3, paso 4.
// ---------------------------------------------------------------------------

async function entrarComoUsuario(nombre) {
  await arrancar();
  await esperarCatalogo();
  m.setear('sgc-generador-nombre', nombre);
  // ORDEN-RONDA-29 pieza 2: la identidad son cuatro datos desde la ronda 29.
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
  return m;
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

async function altaCompleta(nombre) {
  const d = m.documento;
  await entrarComoUsuario(nombre || 'Ana Pérez');

  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');

  // Tres clases reales del catálogo que tengan ítems: tres renglones de verdad.
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 3, 'el catálogo real tiene al menos tres clases con ítems');
  const elegidas = clases.slice(0, 3);
  for (let i = 0; i < elegidas.length; i++) {
    await agregarRenglonReal(i, elegidas[i][2]);
  }
  await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
    20000, 'los tres renglones quedan sin errores');

  // Un presupuesto de REFERENCIA (no se sube nada).
  m.escribir('sgc-presup-archivo', 'presupuesto-resma-2026.pdf');
  m.escribir('sgc-presup-proveedor', 'Librería Sur');
  m.escribir('sgc-presup-fecha', '12/02/2026');
  d.getElementById('sgc-presup-agregar').click();
  m.escribir('sgc-presup-archivo', 'presupuesto-resma-2026-b.pdf');
  m.escribir('sgc-presup-proveedor', 'Papelera Norte');
  m.escribir('sgc-presup-fecha', '13/02/2026');
  d.getElementById('sgc-presup-agregar').click();

  // Dos valores completos por renglón: la regla de la ronda 26.
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
  return { clase: elegidas[0], renglones: SGC().catalogo.renglones.obtener() };
}

// ---------------------------------------------------------------------------
// §3 · Qué ofrece el último paso
// ---------------------------------------------------------------------------

test('el generador no ofrece "Avanzar" ni crear expediente: ofrece imprimir y exportar', async () => {
  await entrarComoUsuario('Ana Pérez');
  const d = m.documento;

  // El botón del asistente existe (wizard.montar lo busca por id y le pone su
  // escucha, si falta el asistente no arranca) pero no se muestra: el generador
  // no crea expedientes.
  assert.ok(d.getElementById('sgc-persistir'), 'el asistente encuentra su botón de alta');
  assert.strictEqual(d.getElementById('sgc-generador-sin-crear').hidden, true,
    '"Crear expediente" no se muestra en el generador');

  const imprimir = d.getElementById('sgc-btn-imprimir');
  const exportar = d.getElementById('sgc-btn-exportar');
  assert.ok(imprimir, 'hay un botón para imprimir los documentos');
  assert.ok(exportar, 'el botón es "Exportar para Abastecimiento"');
  assert.match(exportar.textContent, /Exportar para Abastecimiento/,
    'el botón de salida del circuito se llama así, no "Avanzar"');
  assert.strictEqual(exportar.disabled, true,
    'sin EETT todavía, exportar no se puede');

  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(msj.hidden, false, 'el motivo se ve sin preguntar');
  assert.match(msj.textContent, /Falta:/, 'el motivo se anuncia');
});

test('los presupuestos se anotan como referencia: nombre, proveedor y fecha, sin subir archivos', async () => {
  await entrarComoUsuario('Ana Pérez');
  const d = m.documento;

  // En el generador no hay a dónde subir un archivo: no hay input de archivo.
  assert.strictEqual(d.getElementById('sgc-req-presupuesto-archivo'), null,
    'el generador no ofrece subir presupuestos: no hay dónde guardarlos');
  assert.strictEqual(d.getElementById('sgc-req-presupuestos-lista'), null,
    'ni la lista de archivos subidos');

  d.getElementById('sgc-presup-agregar').click();
  assert.match(d.getElementById('sgc-presup-msj').textContent, /nombre del archivo/i,
    'sin nombre no hay presupuesto: un nombre es lo mínimo para poder citarlo');

  m.escribir('sgc-presup-archivo', 'presupuesto-resma-2026.pdf');
  m.escribir('sgc-presup-proveedor', 'Librería Sur');
  m.escribir('sgc-presup-fecha', '12/02/2026');
  d.getElementById('sgc-presup-agregar').click();

  const lista = SGC().generadorPresupuestos.listar();
  assert.strictEqual(lista.length, 1, 'el presupuesto quedó anotado');
  assert.strictEqual(lista[0].nombreOriginal, 'presupuesto-resma-2026.pdf');
  assert.strictEqual(lista[0].proveedor, 'Librería Sur');
  assert.strictEqual(lista[0].fecha, '12/02/2026');
  assert.ok(lista[0].id, 'tiene id propio: es el presupuestoId que citan los valores');
  assert.match(d.getElementById('sgc-presup-lista').textContent,
    /presupuesto-resma-2026\.pdf · Librería Sur · 12\/02\/2026/,
    'en pantalla se ve nombre, proveedor y fecha');

  // Sin nombre de archivo no se agrega: se avisa y no se guarda nada.
  d.getElementById('sgc-presup-agregar').click();
  assert.strictEqual(SGC().generadorPresupuestos.listar().length, 1,
    'un clic sin datos no inventa un presupuesto');
});

test('el bloque de valores es el de la aplicación con servidor, no una copia', () => {
  // El mismo archivo en las dos caras (ADR-044: un arreglo vale para las dos).
  assert.ok(INDEX_HTML.indexOf('js/views/requerimiento-valores.js') !== -1,
    'la aplicación con servidor carga el bloque de valores');
  assert.ok(m.HTML.indexOf('js/views/requerimiento-valores.js') !== -1,
    'el generador carga el MISMO bloque de valores');
  assert.ok(m.HTML.indexOf('id="sgc-req-valores"') !== -1,
    'el generador declara el contenedor que el bloque busca');
  assert.ok(m.HTML.indexOf('id="sgc-req-total"') !== -1,
    'y el pie del total, que el bloque escribe');

  // Y el módulo del generador no reimplementa la regla: usa la del núcleo.
  const valores = fs.readFileSync(path.join(APP_DIR, 'js', 'generador', 'valores.js'), 'utf8');
  const sinComentarios = valores.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.strictEqual(/validarValoresReferencia|valorPromedio|promedio/.test(sinComentarios), false,
    'generador/valores.js no recalcula el promedio ni revalida: reutiliza');
  assert.ok(/SGC\.views\.requerimientoValores/.test(valores),
    'el bloque del generador habla con el de la pantalla del servidor');
});

test('tres renglones reales con dos valores cada uno: se imprimen la Solicitud de Gastos y la EETT', async () => {
  const { renglones } = await altaCompleta('Ana Pérez');
  const d = m.documento;

  assert.strictEqual(renglones.length, 3, 'el requerimiento tiene tres renglones');
  assert.strictEqual(new Set(renglones.map((r) => r.codigo)).size, 3,
    'los tres renglones son tres códigos distintos: la lista se dibuja de cero, no arrastra filas');
  for (const r of renglones) {
    assert.ok(typeof r.item === 'string' && r.item.length > 0,
      'cada renglón trae la descripción del ítem del catálogo (RONDA-25 pieza 5)');
  }

  // Imprimir compone los documentos y llama a window.print() con la clase de
  // impresión puesta, como la vista de expediente (ORDEN-RONDA-25 pieza 4).
  let impresiones = 0;
  let claseDuranteImpresion = null;
  globalThis.print = function () {
    impresiones++;
    claseDuranteImpresion = globalThis.document.body.classList.contains('imprimiendo');
  };
  try {
    d.getElementById('sgc-btn-imprimir').click();
  } finally {
    delete globalThis.print;
  }

  assert.strictEqual(impresiones, 1, 'imprimir imprime una vez');
  assert.strictEqual(claseDuranteImpresion, true,
    'la hoja de impresión está activa durante el print');

  const seccion = d.getElementById('sgc-generador-impresion');
  const texto = seccion.textContent;
  assert.match(texto, /Solicitud de Gastos/, 'la Solicitud de Gastos está compuesta');
  assert.match(texto, /Especificaci.n T.cnica/, 'la EETT está compuesta');
  assert.match(texto, /Valores preventivo de la contrataci.n|preventivo/i,
    'el preventivo sale del cálculo, no de un número escrito a mano');
  for (const r of renglones) {
    assert.ok(texto.indexOf(r.item) !== -1,
      'el documento lleva la descripción del ítem "' + r.item.slice(0, 30) + '…"');
  }

  // Un documento por hoja: la sección tiene hijos y cada uno es un documento.
  assert.ok(seccion.children.length >= 2,
    'Solicitud de Gastos y EETT son dos documentos (hojas) distintos');
  assert.strictEqual(seccion.className.indexOf('documento-impresion') !== -1, true,
    'la sección lleva la clase de documento del sistema: la tipografía es la misma');

  assert.deepStrictEqual(m.red.llamadas, [],
    'imprimir los documentos no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('"Exportar para Abastecimiento" se habilita con la validación válida y antes dice qué falta', async () => {
  await altaCompleta('Ana Pérez');
  const d = m.documento;
  const exportar = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');

  // Con los datos cargados pero sin EETT generada, el estado todavía no avanza.
  assert.strictEqual(exportar.disabled, true, 'sin imprimir no hay EETT: no se puede exportar');
  const sinGenerar = msj.textContent;
  assert.match(sinGenerar, /especificaci.n t.cnica|Especificaci.n T.cnica/i,
    'lo que falta es la EETT, dicha con su título y no con su id: ' + sinGenerar);

  d.getElementById('sgc-btn-imprimir').click();

  assert.strictEqual(exportar.disabled, false,
    'con la EETT compuesta la validación de ESPECIFICACIONES_TECNICAS da válida');
  assert.strictEqual(msj.hidden, true, 'ya no hay motivo que dar');

  // Y lo que hace no es un "Avanzar" de estado: arma el archivo para
  // Abastecimiento (pieza 4) y lo dice en la pantalla. El nombre del archivo lo
  // comprueba la pieza 4; acá importa que no finge: descarga y contesta.
  exportar.click();
  const aviso = d.getElementById('sgc-generador-msj-revision');
  await m.esperar(() => aviso.hidden === false, 10000, 'el generador contesta');
  assert.match(aviso.textContent, /Abastecimiento/,
    'dice a quién es el archivo: el circuito empieza en Abastecimiento');
  assert.match(aviso.textContent, /\.json/, 'dice qué archivo se descargó');
  assert.deepStrictEqual(m.red.llamadas, [],
    'exportar no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('un renglón con un solo valor deja exportar deshabilitado con el texto de la ronda 26', async () => {
  await altaCompleta('Ana Pérez');
  const d = m.documento;
  const exportar = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');

  d.getElementById('sgc-btn-imprimir').click();
  assert.strictEqual(exportar.disabled, false, 'con dos valores por renglón se puede exportar');

  // Quitar el segundo valor del segundo renglón, por su propio botón (así lo
  // saca una persona): el promedio queda con un solo valor y la ronda 26 lo veta.
  const boton = m.quitarValorFila(1, 1);
  assert.ok(boton, 'cada fila de valores tiene su botón para quitarla');

  await m.esperar(() => exportar.disabled === true, 10000,
    'con un renglón de un solo valor no se puede exportar');

  assert.match(msj.textContent,
    /2 valores de referencia de presupuestos distintos en Rengl.n 2/,
    'el motivo es el texto de la ronda 26 y 29, con el renglón: ' + msj.textContent);

  // Y el botón de imprimir tampoco compone un documento a medias: lo que quedó
  // de la impresión anterior se deja como estaba.
  const seccion = d.getElementById('sgc-generador-impresion');
  const hojasAntes = seccion.children.length;
  assert.ok(hojasAntes >= 2, 'la impresión anterior dejó sus hojas');
  d.getElementById('sgc-btn-imprimir').click();
  assert.strictEqual(seccion.children.length, hojasAntes,
    'con un renglón incompleto no se compone un documento nuevo');
});

test('la impresión del generador no rompe la de la aplicación con servidor', () => {
  // Las reglas nuevas llevan la clase .generador del body: la aplicación con
  // servidor imprime con la misma clase .imprimiendo y necesita ver
  // #sgc-expediente.
  assert.ok(CSS_IMPRESION.indexOf('body.generador.imprimiendo > #app') !== -1,
    'las reglas del generador están acotadas a body.generador');
  assert.ok(CSS_IMPRESION.indexOf('body.imprimiendo > #app > *:not(#sgc-expediente)') !== -1,
    'la rama de la aplicación con servidor sigue como estaba');
  assert.ok(m.HTML.indexOf('<body class="generador">') !== -1,
    'generador.html declara esa clase en el body');
});
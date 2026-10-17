'use strict';

/*
 * ronda-38-p2.test.js
 * RONDA-38 · pieza 2 · "La modalidad común u OCA" (ORDEN-RONDA-38 pieza 2).
 *
 * La pieza agrega la modalidad de compra a "1 · Identificación". Cuando es
 * "Orden de compra abierta (OCA)" aparecen dos exigencias nuevas: la
 * justificación de por qué se pide OCA (en "3 · Fundamentación", con la guía de
 * la norma) y la cantidad máxima por Solicitud de Provisión de cada renglón (en
 * "2 · Renglones"). Sale "Objetivo" de Fundamentación y el JSON queda con la
 * modalidad, la justificación y las cantidades.
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Sin modalidad, "Siguiente" no pasa de Identificación y el foco queda en
 *     #sgc-modalidad.
 *  2. Con "Común": no aparece la justificación de la OCA ni las cantidades
 *     máximas, y exporta como siempre.
 *  3. Con OCA, sin justificación: "3 · Fundamentación" dice "falta", el campo
 *     muestra la guía con "Decreto 1030/2016, art. 25 inc. c", y no imprime ni
 *     exporta.
 *  4. Con OCA y sin cantidad máxima en un renglón: no exporta y el motivo
 *     nombra el renglón.
 *  5. Con OCA completa: el requerimiento trae la justificación, la tabla de
 *     máximos y la nota con "Decreto 1030/2016" —sin "1023/01" ni "Art. 111"—,
 *     y el JSON trae modalidad, ocaJustificacion y cantidadMaxima.
 *  6. En "3 · Fundamentación" ya no hay #sgc-objetivo.
 *  7. Un avance escrito antes de esta pieza —sin modalidad— pide la modalidad
 *     antes de exportar.
 *
 * El requerimiento con servidor no cambia: la causal sólo varía en un
 * expediente con OCA (pieza 2c), que es lo que manda el test de plantillas.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_OCA =
  'No se puede prefijar la cantidad: se descuenta contra un remito por partida.';
const LUGAR = 'Depósito de Intendencia, VII Brigada Aérea';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

function pasoVisible() {
  const d = m.documento;
  return ['identificacion', 'renglones', 'fundamentacion', 'revision']
    .find((p) => !d.getElementById('sgc-paso-' + p).hidden);
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

/*
 * El archivo que baja el generador. Llega con modalidad "comun", como el que
 * sale hoy de la pantalla; `sinModalidad` arma el de un archivo escrito ANTES
 * de esta pieza, que es el que tiene que volver a pedir la modalidad.
 * Cantidad y valor por pieza: 10 × $ 100 = $ 1.000, dentro del monto del
 * proceso 1 ($ 63.617.500), así que el PAC no pide nada.
 */
function archivo(o) {
  const cantidad = o.cantidad === undefined ? 10 : o.cantidad;
  const valor = o.valor === undefined ? 100 : o.valor;
  const expediente = {
    titulo: 'Resmas A4',
    anio: o.anio || '2026',
    trimestre: o.trimestre || '1',
    lugarEntrega: LUGAR,
    pac: { numero: o.pac, justificacion: '' },
    campos: {
      operador: 'ana.perez@faa.mil.ar',
      dependenciaSolicitante: 'División Usuario',
      justificacion: justificacion,
      objetivo: ''
    },
    renglones: [
      {
        codigo: CODIGO_PAPELERIA,
        item: ITEM_PAPELERIA,
        cantidad: cantidad,
        unidad: 'UN',
        aclaracion: '',
        valoresReferencia: [
          { presupuestoId: 'p1', base: 'unitario', valor: valor },
          { presupuestoId: 'p2', base: 'unitario', valor: valor }
        ]
      }
    ],
    presupuestos: [
      { id: 'p1', nombreOriginal: 'presupuesto-resma-2026.pdf', proveedor: 'Librería Sur',
        fecha: '12/02/2026', tipo: 'presupuesto' },
      { id: 'p2', nombreOriginal: 'presupuesto-resma-2026-b.pdf', proveedor: 'Papelera Norte',
        fecha: '13/02/2026', tipo: 'presupuesto' }
    ]
  };
  if (!o.sinModalidad) {
    expediente.modalidad = 'comun';
  }
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: expediente
  });
}

async function importarTexto(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'archivo.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó');
  return m.msjArchivo().textContent;
}

// Navegar al paso id, como una persona con "Siguiente"/"Anterior". Sólo sirve
// cuando el paso deja avanzar (no esquiva la validación): si el avance está
// frenado, se queda y el esperar avisa.
async function ir(id) {
  const d = m.documento;
  const orden = ['identificacion', 'renglones', 'fundamentacion', 'revision'];
  for (let k = 0; k < 8; k++) {
    const actual = pasoVisible();
    if (actual === id) {
      return;
    }
    const destino = orden.indexOf(id) > orden.indexOf(actual) ? 'sgc-siguiente' : 'sgc-anterior';
    const esperado = destino === 'sgc-siguiente'
      ? orden[orden.indexOf(actual) + 1]
      : orden[orden.indexOf(actual) - 1];
    d.getElementById(destino).click();
    await m.esperar(() => pasoVisible() === esperado || pasoVisible() === id, 10000,
      'el paso no se movió desde ' + actual);
  }
  throw new Error('no se llegó al paso ' + id);
}

// Compone los documentos y espera a que haya algo entregable. Sólo sirve cuando
// la impresión sale: con algo que frena, el esperar avisa y el test no se cuelga.
async function imprimir() {
  const d = m.documento;
  const antes = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > antes,
    20000, 'los documentos se compusieron');
}

async function exportarJson() {
  const d = m.documento;
  const antes = m.descargas.length;
  d.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  return JSON.parse(await m.descargas[m.descargas.length - 1].texto());
}

function vista() {
  const d = m.documento;
  return {
    d: d,
    modalidad: d.getElementById('sgc-modalidad'),
    errorModalidad: d.getElementById('sgc-error-modalidad'),
    campoOca: d.getElementById('sgc-oca-justificacion-campo'),
    guia: d.getElementById('sgc-oca-justificacion-guia'),
    textareaOca: d.getElementById('sgc-oca-justificacion'),
    errorOca: d.getElementById('sgc-error-oca-justificacion'),
    objetivo: d.getElementById('sgc-objetivo'),
    boton: d.getElementById('sgc-btn-exportar'),
    msj: d.getElementById('sgc-exportar-msj'),
    impreso: d.getElementById('sgc-generador-impresion')
  };
}

test('RONDA-38 pieza 2a · sin modalidad "Siguiente" no pasa de Identificación y el foco queda en #sgc-modalidad', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  const respuesta = await importarTexto(archivo({ pac: '1', sinModalidad: true }));
  assert.match(respuesta, /Requerimiento importado/, 'el archivo entra: ' + respuesta);
  assert.strictEqual(pasoVisible(), 'renglones', 'el archivo abre en "2 · Renglones"');

  // Vuelta a Identificación, como quien se da cuenta ahí de que falta elegir.
  await ir('identificacion');
  d.getElementById('sgc-siguiente').click();

  assert.strictEqual(pasoVisible(), 'identificacion',
    'sin la modalidad "Siguiente" no pasa de Identificación');
  const v = vista();
  assert.strictEqual(v.errorModalidad.hidden, false,
    'el motivo se dice junto al campo');
  assert.match(v.errorModalidad.textContent, /Elegí la modalidad de compra/,
    'con las palabras de la orden: ' + v.errorModalidad.textContent);
  assert.strictEqual(d.activeElement, d.getElementById('sgc-modalidad'),
    'y el foco queda en #sgc-modalidad');
  assert.strictEqual(v.modalidad.classList.contains('campo-con-error'), true,
    'que queda marcado con la clase campo-con-error');

  // Con la modalidad elegida, el mismo "Siguiente" pasa.
  m.elegirModalidad('comun');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'renglones', 20000,
    'elegida la modalidad, se avanza');
});

test('RONDA-38 pieza 2b · con "Común" no hay justificación de la OCA ni cantidades máximas, y exporta como siempre', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));

  const v = vista();
  const bloqueValores = d.getElementById('sgc-req-valores');
  assert.strictEqual(v.campoOca.hidden, true,
    'con la modalidad común la justificación de la OCA no aparece');
  assert.strictEqual(bloqueValores.querySelectorAll('[data-oca-max]').length, 0,
    'ni la cantidad máxima por Solicitud de Provisión');
  assert.strictEqual(bloqueValores.querySelectorAll('[data-oca-min]').length, 0,
    'ni la cantidad mínima');

  await ir('revision');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false, 'y exporta como siempre');
  const impreso = v.impreso.textContent;
  assert.ok(!impreso.includes('Orden de Compra Abierta'),
    'el requerimiento no habla de la OCA: ' + impreso.slice(0, 200));
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.modalidad, 'comun',
    'el JSON lleva la modalidad común');
  assert.strictEqual(salida.expediente.ocaJustificacion, '',
    'sin justificación de la OCA');
  assert.strictEqual(salida.expediente.renglones[0].cantidadMaxima, undefined,
    'y sin cantidades de la OCA');
});

test('RONDA-38 pieza 2c · con OCA, sin justificación: Fundamentación dice "falta", la guía cita el Decreto, y no imprime ni exporta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));
  await ir('identificacion');
  m.elegirModalidad('oca');

  const v = vista();
  assert.strictEqual(v.campoOca.hidden, false,
    'con la modalidad OCA la justificación aparece');
  assert.match(v.guia.textContent, /Decreto 1030\/2016, arts?\. 25\s+inc\. c/,
    'la guía de la norma acompaña el campo: ' + v.guia.textContent.trim());
  assert.ok(d.getElementById('sgc-pasos').querySelector('[data-paso="fundamentacion"]')
    .textContent.match(/falta/),
    'el paso "3 · Fundamentación" queda marcado "· falta": ' +
      d.getElementById('sgc-pasos').querySelector('[data-paso="fundamentacion"]').textContent);

  await ir('fundamentacion');
  assert.strictEqual(v.textareaOca.value, '',
    'recién aparece vacía');

  // Sin la justificación, "Siguiente" no pasa de Fundamentación.
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion',
    'sin justificar la OCA no se avanza');
  assert.strictEqual(v.errorOca.hidden, false, 'el motivo se dice junto al campo');
  assert.match(v.errorOca.textContent, /Falta justificar la modalidad orden de compra abierta/,
    'con las palabras de la orden: ' + v.errorOca.textContent);
  assert.strictEqual(d.activeElement, d.getElementById('sgc-oca-justificacion'),
    'y el foco queda en el campo');
  assert.strictEqual(v.textareaOca.classList.contains('campo-con-error'), true,
    'que queda marcado con la clase campo-con-error');

  // No exporta: el botón está frenado y el motivo lo dice.
  assert.strictEqual(v.boton.disabled, true, 'sin la justificación no exporta');
  assert.match(v.msj.textContent, /justificar la modalidad orden de compra abierta/,
    'con el mismo texto: ' + v.msj.textContent);

  // No imprime: el botón vive en el paso 4 y su puerta es la misma que la de
  // exportar, así que se aprieta acá para ver que no compone nada.
  const entregables = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  d.getElementById('sgc-btn-imprimir').click();
  assert.strictEqual(SGC().generadorDocumentos.expedienteLocal().entregables.length,
    entregables, 'Imprimir no compone ningún documento');
  assert.strictEqual(v.impreso.textContent.trim(), '', 'y la sección de impresión queda vacía');
});

test('RONDA-38 pieza 2d · con OCA y sin cantidad máxima en un renglón: no exporta y el motivo nombra el renglón', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000,
    'con la justificación cargada, avanza');

  const v = vista();
  assert.strictEqual(v.boton.disabled, true,
    'sin la cantidad máxima no exporta, aunque la justificación esté');
  assert.match(v.msj.textContent, /Renglón 1: falta la cantidad máxima por Solicitud de Provisión/,
    'y el motivo nombra el renglón: ' + v.msj.textContent);
  assert.strictEqual(v.campoOca.hidden, false,
    'la justificación que se cargó sigue a la vista');
  assert.strictEqual(v.textareaOca.value, JUSTIFICACION_OCA,
    'con el texto que se escribió');
});

test('RONDA-38 pieza 2e · con OCA completa el requerimiento trae la justificación, la tabla y la nota; el JSON trae modalidad y cantidad máxima', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('renglones');
  m.cargarOca([{ maxima: 5, minima: 2 }]);
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  await ir('revision');
  await imprimir();

  const impreso = vista().impreso.textContent;
  assert.ok(impreso.includes('Justificación:') && impreso.includes(JUSTIFICACION_OCA),
    'el requerimiento trae la justificación de la OCA: ' + impreso.slice(0, 300));
  assert.ok(impreso.includes('Cantidad máxima (por Solicitud de Provisión)'),
    'y la tabla de máximos con su rótulo: ' + impreso);
  assert.ok(impreso.includes('Decreto 1030/2016'),
    'y la nota de la causal con el decreto nuevo: ' + impreso);
  assert.ok(!impreso.includes('1023/01'),
    'sin la cita vieja del decreto 1023/01');
  assert.ok(!impreso.includes('Art. 111'),
    'ni la del Art. 111: ' + impreso);

  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.modalidad, 'oca',
    'el JSON trae la modalidad OCA');
  assert.strictEqual(salida.expediente.ocaJustificacion, JUSTIFICACION_OCA,
    'y la justificación de la OCA');
  assert.strictEqual(salida.expediente.renglones[0].cantidadMaxima, 5,
    'y la cantidad máxima del renglón');
  assert.strictEqual(salida.expediente.renglones[0].cantidadMinima, 2,
    'y la cantidad mínima');

  // El avance guarda lo mismo y, reimportado, lo recupera.
  const antesAvance = m.descargas.length;
  d.getElementById('sgc-guardar-avance').click();
  await m.esperar(() => m.descargas.length > antesAvance, 20000, 'el avance no se descargó');
  const avance = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(avance.sello.estado, 'avance', 'el sello dice que es un avance');
  assert.strictEqual(avance.expediente.modalidad, 'oca', 'el avance trae la modalidad');
  assert.strictEqual(avance.expediente.ocaJustificacion, JUSTIFICACION_OCA,
    'y la justificación');
  assert.strictEqual(avance.expediente.renglones[0].cantidadMaxima, 5,
    'y la cantidad máxima');

  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(avance), 'resmas-avance-oca.json');
  assert.match(respuesta, /Avance importado/, 'el avance vuelve a entrar: ' + respuesta);
  await ir('identificacion');
  assert.strictEqual(vista().modalidad.value, 'oca',
    'el campo muestra la modalidad que traía');
  await ir('fundamentacion');
  assert.strictEqual(vista().textareaOca.value, JUSTIFICACION_OCA,
    'y el campo de la OCA muestra la justificación que traía');
});

test('RONDA-38 pieza 2f · en "3 · Fundamentación" ya no hay #sgc-objetivo', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));
  await ir('fundamentacion');

  assert.strictEqual(vista().objetivo, null,
    'el campo "Objetivo" salió de la pantalla');
  assert.strictEqual(d.getElementById('sgc-oca-justificacion') === null, false,
    'en su lugar está el bloque de la OCA, que es lo que va acá');
  assert.match(d.getElementById('sgc-paso-fundamentacion').textContent, /Fundamentación/,
    'y el paso sigue siendo "3 · Fundamentación"');

  // El JSON viejo sigue llevando el objetivo: se importa y no se muestra.
  const conObjetivo = JSON.parse(archivo({ pac: '1' }));
  conObjetivo.expediente.campos.objetivo = 'Bajar el costo de reposición';
  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(conObjetivo), 'con-objetivo.json');
  assert.match(respuesta, /Requerimiento importado/, 'el archivo con objetivo entra: ' + respuesta);
  await ir('fundamentacion');
  assert.strictEqual(vista().objetivo, null, 'y el objetivo no aparece en la pantalla');
});

test('RONDA-38 pieza 2g · un avance escrito antes de esta pieza, sin modalidad, pide la modalidad antes de exportar', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '1' }));
  const antesAvance = m.descargas.length;
  d.getElementById('sgc-guardar-avance').click();
  await m.esperar(() => m.descargas.length > antesAvance, 20000, 'el avance no se descargó');
  const avance = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(avance.expediente.modalidad, 'comun',
    'hoy el avance sale con la modalidad');

  // El mismo archivo, escrito a mano como el que dejó una ronda anterior: sin
  // modalidad, con la huella vuelta a calcular sobre el contenido nuevo (la
  // misma función que sella todo el sistema, como hace quien edita un archivo).
  delete avance.expediente.modalidad;
  avance.sello.huella = await SGC().generadorIntercambio.huellaDe(avance);

  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(avance), 'avance-sin-modalidad.json');
  assert.match(respuesta, /Avance importado/,
    'el avance viejo entra: ' + respuesta);

  const v = vista();
  assert.strictEqual(v.boton.disabled, true, 'no exporta: falta la modalidad');
  assert.match(v.msj.textContent, /Elegí la modalidad de compra/,
    'y el motivo lo dice: ' + v.msj.textContent);

  // Elegida la modalidad, el mismo avance se puede exportar.
  await ir('identificacion');
  m.elegirModalidad('comun');
  await ir('revision');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false,
    'con la modalidad elegida, el avance sí exporta');
});

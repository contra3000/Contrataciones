'use strict';

/*
 * ronda-34-p2.test.js
 * RONDA-34 · pieza 2 · "El proceso del PAC en Identificación"
 * (ORDEN-RONDA-34 pieza 2).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. El desplegable tiene los 39 procesos de config/pac.js más
 *     "No autorizado en el PAC"; el proceso 22 muestra "USD".
 *  2. Elegir el proceso 3 completa el trimestre con el 1°, y la persona
 *     puede cambiarlo; "Siguiente" pasa.
 *  3. (ORDEN-RONDA-35 pieza 2a) Ya no hay campo manual "Preventivo en
 *     dólares": se eliminó de la pantalla.
 *  4. Proceso 4 (ARS, $ 1.029.094,70): con un preventivo que lo supera
 *     ($ 2.100.000) aparece el campo de justificación y la exportación
 *     queda frenada nombrando el proceso; con la justificación, exporta.
 *  5. El requerimiento impreso dice "Proceso 4 · Insumos médicos VIIBA ..."
 *     y la justificación del PAC.
 *  6. El JSON exportado trae pac.numero "4" y la justificación; el avance
 *     que se guarda la trae también y, reimportado, el campo la muestra.
 *  7. Proceso 22 (USD 21.466,00): el preventivo sale de los valores (como
 *     en cualquier proceso); con valores dentro del monto exporta, y con
 *     valores que lo superan pide la justificación.
 *  8. "No autorizado en el PAC": sin justificación no exporta, y el
 *     documento impreso lo dice.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_PAC = 'El proceso 4 cubre la reposición de insumos de papelería.';

// El proceso del PAC viaja como `pac` (sólo si la persona lo eligió), en la
// forma en que lo exporta el generador: { numero, justificacion }. Ya no lleva
// el preventivo en dólares escrito a mano (ORDEN-RONDA-35 pieza 2a).
const proceso4 = { numero: '4', justificacion: '' };
const proceso22 = { numero: '22', justificacion: '' };
const noAutorizado = { numero: 'no-autorizado', justificacion: '' };

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

// El archivo que baja el generador en la ronda 34: con trimestre (pieza 1) y
// con el proceso del PAC que esta pieza cuida. Cantidad y valor por pieza para
// decidir el total: por defecto 10 × $ 210.000 = $ 2.100.000, que supera el
// monto del proceso 4 ($ 1.029.094,70).
function exportadoConPac(pac, opciones) {
  const o = opciones || {};
  const cantidad = o.cantidad === undefined ? 10 : o.cantidad;
  const valor = o.valor === undefined ? 210000 : o.valor;
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: {
      titulo: 'Resmas A4',
      anio: '2026',
      trimestre: '1',
      lugarEntrega: 'Depósito de Intendencia, VII Brigada Aérea',
      pac: pac,
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
    }
  });
}

async function importarTexto(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'archivo.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó');
  return m.msjArchivo().textContent;
}

// Importa un requerimiento ya exportado y lo deja en el paso de revisión.
async function hastaRevision() {
  const d = m.documento;
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  return d;
}

// Vuelve a Identificación desde el paso donde esté.
async function hastaIdentificacion() {
  const d = m.documento;
  for (let i = 0; i < 4; i++) {
    if (!d.getElementById('sgc-paso-identificacion').hidden) {
      return d;
    }
    d.getElementById('sgc-anterior').click();
  }
  throw new Error('no se llegó al paso de Identificación');
}

// Desde Identificación hasta Revisión (tres "Siguiente").
async function desdeIdentificacionHastaRevision() {
  const d = m.documento;
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  return d;
}

async function imprimir() {
  const d = m.documento;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'los documentos se compusieron');
}

function exportarVista() {
  const d = m.documento;
  return {
    d: d,
    boton: d.getElementById('sgc-btn-exportar'),
    msj: d.getElementById('sgc-exportar-msj')
  };
}

test('RONDA-34 pieza 2a · el desplegable trae los 39 procesos y "No autorizado en el PAC", y el 22 dice USD', async () => {
  const d = m.documento;
  await entrarComoUsuario();

  const select = d.getElementById('sgc-pac');
  assert.strictEqual(select.children.length, 41,
    '39 procesos + 1 vacío + "No autorizado en el PAC": ' + select.children.length);

  const ultimo = select.children[select.children.length - 1];
  assert.strictEqual(ultimo.value, 'no-autorizado', 'el último es el "no autorizado"');
  assert.strictEqual(ultimo.textContent, 'No autorizado en el PAC',
    'con las palabras de la orden: ' + ultimo.textContent);

  const opcion22 = Array.from(select.children).find((o) => o.value === '22');
  assert.ok(opcion22, 'el proceso 22 (USD) está en la lista');
  assert.match(opcion22.textContent, /USD/,
    'y muestra su monto en dólares: ' + opcion22.textContent);

  const opcion4 = Array.from(select.children).find((o) => o.value === '4');
  assert.ok(opcion4 && opcion4.textContent.includes('Insumos médicos VIIBA'),
    'el proceso 4 es Insumos médicos VIIBA: ' + (opcion4 && opcion4.textContent));
  assert.match(opcion4.textContent, /\$ 1\.029\.094,70/,
    'con su monto en pesos: ' + opcion4.textContent);
});

test('RONDA-34 pieza 2b · elegir el proceso 3 completa el trimestre con el 1°, se puede cambiar a 2 y "Siguiente" pasa', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  // ORDEN-RONDA-35 pieza 1: la Identificación también pide el lugar de entrega.
  m.escribir('sgc-lugar-entrega', 'Depósito de Intendencia, VII Brigada Aérea');

  m.elegirPac('3');
  const trime = d.getElementById('sgc-trimestre');
  assert.strictEqual(trime.value, '1',
    'el proceso 3 trae el 1° trimestre, solo: ' + trime.value);
  assert.strictEqual(SGC().views.wizard.datos().identificacion.trimestre, '1',
    'y al elegirlo se sincronizó con el trimestre 1 del proceso');

  m.setear('sgc-trimestre', '2');
  assert.strictEqual(trime.value, '2', 'y la persona lo puede cambiar');
  assert.strictEqual(SGC().views.wizard.datos().identificacion.trimestre, '1',
    'el cambio de campo todavía no está en los datos: aún no se sincronizó');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');
  assert.strictEqual(SGC().views.wizard.datos().identificacion.trimestre, '2',
    'al avanzar, el trimestre que se validó es el 2');
  assert.strictEqual(SGC().views.wizard.datos().identificacion.pac.numero, '3',
    'y el proceso del PAC quedó cargado con el 3');
});

test('RONDA-35 pieza 2a · ya no hay campo manual "Preventivo en dólares"', async () => {
  const d = m.documento;
  await entrarComoUsuario();

  m.elegirPac('22');
  assert.strictEqual(d.getElementById('sgc-pac-preventivo-usd-campo'), null,
    'el campo del preventivo en dólares se eliminó de la pantalla');
  assert.strictEqual(d.getElementById('sgc-pac-preventivo-usd'), null,
    'y el input tampoco está');

  m.elegirPac('4');
  assert.strictEqual(d.getElementById('sgc-pac-preventivo-usd-campo'), null,
    'tampoco reaparece con un proceso en pesos');
});

test('RONDA-34 pieza 2d · proceso 4 y preventivo que lo supera: exportar frenado con el motivo del PAC, y con la justificación exporta', async () => {
  await entrarComoUsuario();
  const respuesta = await importarTexto(exportadoConPac(proceso4));
  assert.match(respuesta, /Requerimiento importado/, 'el archivo entra: ' + respuesta);
  await hastaRevision();

  let v = exportarVista();
  assert.strictEqual(v.boton.disabled, true, 'sin justificación no se exporta');
  assert.strictEqual(v.msj.hidden, false, 'el motivo se dice');
  assert.match(v.msj.textContent, /justificar el preventivo que supera el monto del proceso 4 del PAC/,
    'con las palabras de la orden: ' + v.msj.textContent);

  await hastaIdentificacion();
  assert.strictEqual(v.d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'el preventivo supera el monto del proceso: el campo de justificación aparece');
  assert.strictEqual(v.d.getElementById('sgc-pac-justificacion').value, '',
    'recién aparece vacío');

  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  await desdeIdentificacionHastaRevision();
  await imprimir();

  v = exportarVista();
  assert.strictEqual(v.boton.disabled, false,
    'con la justificación cargada y los documentos compuestos, exporta');

  const antes = m.descargas.length;
  v.boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(archivo.expediente.pac.numero, '4',
    'la exportación llevó el proceso 4');
  assert.strictEqual(archivo.expediente.pac.justificacion, JUSTIFICACION_PAC,
    'y la justificación que la desbloqueó');
});

test('RONDA-34 pieza 2e · el requerimiento impreso dice el proceso del PAC y la justificación', async () => {
  await entrarComoUsuario();
  await importarTexto(exportadoConPac(proceso4));
  await hastaIdentificacion();
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  await desdeIdentificacionHastaRevision();
  await imprimir();

  const impreso = m.documento.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('PAC 2026'),
    'el requerimiento trae el renglón del PAC: ' + impreso);
  assert.ok(impreso.includes('Proceso 4 · Insumos médicos VIIBA · Contratación Directa · 1° trimestre · $ 1.029.094,70'),
    'con el proceso completo: ' + impreso);
  assert.ok(impreso.includes('Justificación del PAC') && impreso.includes(JUSTIFICACION_PAC),
    'y la justificación del PAC: ' + impreso);
  assert.ok(!impreso.includes('Preventivo en dólares'),
    'pero el proceso 4 es en pesos: el preventivo en dólares no sale');
});

test('RONDA-34 pieza 2f · el JSON exportado y el avance traen pac.numero "4" y la justificación se vuelve a ver', async () => {
  await entrarComoUsuario();
  await importarTexto(exportadoConPac(proceso4));
  await hastaIdentificacion();
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  await desdeIdentificacionHastaRevision();
  await imprimir();

  const antes = m.descargas.length;
  const v = exportarVista();
  assert.strictEqual(v.boton.disabled, false, 'se exporta');
  v.boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(archivo.expediente.pac.numero, '4',
    'el requerimiento exportado lleva el proceso 4');

  // El avance del mismo momento: mismo contenido, mismo PAC.
  const antesAvance = m.descargas.length;
  m.documento.getElementById('sgc-guardar-avance').click();
  await m.esperar(() => m.descargas.length > antesAvance, 20000, 'el avance no se descargó');
  const avance = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(avance.sello.estado, 'avance', 'el sello dice que es un avance');
  assert.strictEqual(avance.expediente.pac.numero, '4', 'el avance trae el proceso 4');

  // Se cierra y se vuelve a entrar: el avance se reimporta donde quedó y el
  // campo de la justificación la muestra de nuevo.
  await entrarComoUsuario();
  const respuesta = await importarTexto(JSON.stringify(avance), 'resmas-avance.json');
  assert.match(respuesta, /Avance importado/, 'el avance vuelve a entrar: ' + respuesta);
  assert.strictEqual(m.documento.getElementById('sgc-paso-revision').hidden, false,
    'y abre donde quedó, en la revisión');

  await hastaIdentificacion();
  const select = m.documento.getElementById('sgc-pac');
  assert.strictEqual(select.value, '4', 'el campo muestra el proceso que traía');
  assert.strictEqual(m.documento.getElementById('sgc-pac-justificacion').value,
    JUSTIFICACION_PAC, 'y la justificación que traía');
});

test('RONDA-35 pieza 2a · el proceso 22 calcula el preventivo de los valores, en USD', async () => {
  // USD 1.000 (10 × 100): dentro del monto del proceso 22 (USD 21.466), exporta.
  await entrarComoUsuario();
  await importarTexto(exportadoConPac(proceso22, { cantidad: 10, valor: 100 }));
  await hastaIdentificacion();
  assert.strictEqual(m.documento.getElementById('sgc-pac-preventivo-usd'), null,
    'ya no hay campo manual de preventivo en dólares');
  assert.strictEqual(m.documento.getElementById('sgc-pac-justificacion-campo').hidden, true,
    'USD 1.000 no supera los 21.466: no pide justificación');
  const bloque = m.documento.getElementById('sgc-req-valores').textContent;
  assert.match(bloque, /USD/, 'el bloque de valores dice USD: ' + bloque.slice(0, 140));
  assert.doesNotMatch(bloque, /\$ ?1\.000,00/,
    'y no dice el mismo monto en pesos: ' + bloque.slice(0, 140));
  await desdeIdentificacionHastaRevision();
  await imprimir();
  let v = exportarVista();
  assert.strictEqual(v.boton.disabled, false, 'dentro del monto, exporta');

  // USD 30.000 (10 × 3.000): supera el monto, pide la justificación.
  await entrarComoUsuario();
  await importarTexto(exportadoConPac(proceso22, { cantidad: 10, valor: 3000 }));
  await hastaRevision();
  v = exportarVista();
  assert.strictEqual(v.boton.disabled, true, 'supera el monto sin justificación: no exporta');
  assert.match(v.msj.textContent, /justificar el preventivo que supera el monto del proceso 22 del PAC/,
    'con las palabras de la orden: ' + v.msj.textContent);

  await hastaIdentificacion();
  assert.strictEqual(m.documento.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'y aparece el campo de justificación');
  m.escribir('sgc-pac-justificacion', 'Se agregan herramientas del segundo semestre.');
  await desdeIdentificacionHastaRevision();
  await imprimir();
  v = exportarVista();
  assert.strictEqual(v.boton.disabled, false, 'con la justificación exporta');
});

test('RONDA-34 pieza 2h · "No autorizado en el PAC": sin justificación no exporta, y el documento impreso lo dice', async () => {
  await entrarComoUsuario();
  await importarTexto(exportadoConPac(noAutorizado));
  await hastaRevision();

  let v = exportarVista();
  assert.strictEqual(v.boton.disabled, true, 'sin justificación no exporta');
  assert.match(v.msj.textContent, /justificar el pedido no autorizado en el PAC/,
    'con las palabras de la orden: ' + v.msj.textContent);

  await hastaIdentificacion();
  assert.strictEqual(v.d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'y aparece el campo de justificación');
  m.escribir('sgc-pac-justificacion', 'El pedido no estaba en el PAC 2026.');
  await desdeIdentificacionHastaRevision();
  await imprimir();

  v = exportarVista();
  assert.strictEqual(v.boton.disabled, false, 'con la justificación exporta');

  const impreso = v.d.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('PAC 2026') && impreso.includes('No autorizado en el PAC'),
    'el documento lo dice: ' + impreso);
});
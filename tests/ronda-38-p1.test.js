'use strict';

/*
 * ronda-38-p1.test.js
 * RONDA-38 · pieza 1 · "La justificación del PAC se revisa también al cambiar de
 * proceso" (ORDEN-RONDA-38 pieza 1).
 *
 * El problema que cuida (pregunta del auditor 37): las causas se comparan por
 * TIPO. Una justificación escrita para el proceso 4 por la causa "monto" seguía
 * valiendo si se pasaba a otro proceso que también supera su monto —aunque el
 * texto nombre el proceso 4—, y nadie se enteraba. Lo que decidió el Jefe el
 * 17/10: cualquier cambio de proceso pide revisar.
 *
 * Junto con `pac.causas` ahora se guarda `pac.procesoJustificado` (el proceso de
 * entonces, o `no-autorizado`) al escribir o confirmar la justificación. Si el
 * proceso de ahora no es ese, se pide revisar igual que cuando cambian las
 * causas. Un archivo de la 37 —con `pac.causas` y sin `pac.procesoJustificado`—
 * toma el proceso de ahora y no pide revisar por eso.
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Justificar el proceso 4 (monto superado) y pasar al 5, que también lo
 *     supera: aparece el aviso, el campo queda marcado, "Siguiente" y "Exportar"
 *     se frenan.
 *  2. "Sigue valiendo" quita el aviso en el momento, sin cambiar de paso; el JSON
 *     lleva `pac.procesoJustificado: "5"` y las causas de ahora.
 *  3. Reescribir la justificación también la pone al día en el momento.
 *  4. Un avance de la 37 (con causas, sin procesoJustificado) entra sin pedir
 *     revisión; uno de la 36 (sin causas) la sigue pidiendo.
 *
 * Los montos salen de config/pac.json: el proceso 4 (Insumos médicos VIIBA) tiene
 * $ 1.029.094,70; el 5 (Repuestos camionetas GOE), $ 21.196.761. El preventivo
 * del archivo es 300.000 × $ 100 = $ 30.000.000: supera a los dos, con la MISMA
 * causa "monto". Así lo único que cambia es el número del proceso. El PAC es del
 * año 2026 y el archivo se pide para el 1° trimestre, como los procesos 4 y 5.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const FIXTURES = path.join(__dirname, 'fixtures');
const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_PAC = 'El monto del proceso 4 quedó corto por la inflación del trimestre.';
const OTRA_JUSTIFICACION = 'Se reescribe para el proceso 5, que también supera su monto.';
const LUGAR = 'Depósito de Intendencia, VII Brigada Aérea';
const CANTIDAD = 300000;
const VALOR = 100;

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

// El archivo que baja el generador. `pac` puede ser el número del proceso (con
// `causas` y `procesoJustificado` opcionales: los avances viejos traen causas y
// no el proceso contra el que se escribió).
function archivo(o) {
  const pac = {
    numero: o.pac,
    justificacion: o.justificacion || ''
  };
  if (Array.isArray(o.causas)) {
    pac.causas = o.causas;
  }
  if (typeof o.procesoJustificado === 'string') {
    pac.procesoJustificado = o.procesoJustificado;
  }
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: {
      titulo: 'Resmas A4',
      anio: o.anio || '2026',
      trimestre: o.trimestre || '1',
      lugarEntrega: LUGAR,
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
          cantidad: o.cantidad === undefined ? CANTIDAD : o.cantidad,
          unidad: 'UN',
          aclaracion: '',
          valoresReferencia: [
            { presupuestoId: 'p1', base: 'unitario', valor: o.valor === undefined ? VALOR : o.valor },
            { presupuestoId: 'p2', base: 'unitario', valor: o.valor === undefined ? VALOR : o.valor }
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

async function imprimir() {
  const d = m.documento;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0,
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
    campo: d.getElementById('sgc-pac-justificacion-campo'),
    aviso: d.getElementById('sgc-pac-justificacion-aviso'),
    confirmar: d.getElementById('sgc-pac-justificacion-confirmar'),
    textarea: d.getElementById('sgc-pac-justificacion'),
    boton: d.getElementById('sgc-btn-exportar'),
    msj: d.getElementById('sgc-exportar-msj')
  };
}

test('RONDA-38 pieza 1a · cambiar de proceso (misma causa) pide revisar y frena "Siguiente" y "Exportar"', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4' }));
  await ir('fundamentacion');

  const v = vista();
  assert.strictEqual(v.campo.hidden, false, 'con la causa "monto" el campo está a la vista');

  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  assert.strictEqual(v.aviso.hidden, true,
    'recién escrita, no pide revisar (aunque la causa siga siendo la misma)');

  // Se cambia a otro proceso que también supera su monto: la causa queda "monto"
  // igual, pero el proceso cambió y la justificación puede estar hablando del 4.
  await ir('identificacion');
  m.elegirPac('5');

  assert.strictEqual(v.aviso.hidden, false, 'al cambiar de proceso, el aviso aparece');
  assert.strictEqual(v.aviso.textContent.trim() !== '', true, 'el aviso tiene texto');
  assert.match(v.campo.textContent, /cambiaron las causas/i,
    'el texto del aviso sigue siendo el del pedido de revisión: ' + v.campo.textContent);
  assert.strictEqual(v.confirmar.hidden, false, 'y aparece el botón para darla por buena');
  assert.strictEqual(v.textarea.classList.contains('campo-con-error'), true,
    'el campo queda marcado');

  assert.strictEqual(v.boton.disabled, true, 'con la revisión pendiente no exporta');
  assert.match(v.msj.textContent, /cambiaron las causas/i,
    'y el motivo lo dice: ' + v.msj.textContent);

  // "Siguiente" no pasa de Fundamentación y el paso queda "· falta".
  await ir('fundamentacion');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'con la revisión pendiente no se avanza');
  const li = d.getElementById('sgc-pasos').querySelector('[data-paso="fundamentacion"]');
  assert.match(li.textContent, /falta/,
    'el paso "3 · Fundamentación" queda "· falta": ' + li.textContent);
});

test('RONDA-38 pieza 1b · "Sigue valiendo" quita el aviso en el momento y exporta con el proceso nuevo', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4' }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);

  await ir('identificacion');
  m.elegirPac('5');

  const v = vista();
  assert.strictEqual(v.aviso.hidden, false, 'con el proceso cambiado, pide revisar');

  // Sin cambiar de paso: se confirma que sigue valiendo.
  v.confirmar.click();
  assert.strictEqual(v.aviso.textContent, '', 'al confirmar, el aviso se va en el momento');
  assert.strictEqual(v.aviso.hidden, true, 'y queda oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'el botón se va con él');
  assert.strictEqual(v.textarea.classList.contains('campo-con-error'), false,
    'y el campo se desmarca');
  assert.strictEqual((v.campo.textContent || '').indexOf('cambiaron las causas'), -1,
    'no queda ningún texto de "cambiaron las causas" a la vista');

  await ir('revision');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false, 'y exporta');
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.pac.procesoJustificado, '5',
    'el JSON lleva el proceso contra el que vale la justificación: ' +
    JSON.stringify(salida.expediente.pac));
  assert.deepStrictEqual(salida.expediente.pac.causas, ['monto'],
    'y las causas de ahora: ' + JSON.stringify(salida.expediente.pac.causas));
});

test('RONDA-38 pieza 1c · reescribir la justificación la pone al día en el momento', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4' }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);

  await ir('identificacion');
  m.elegirPac('5');
  const v = vista();
  assert.strictEqual(v.aviso.hidden, false, 'con el proceso cambiado, pide revisar');

  m.escribir('sgc-pac-justificacion', OTRA_JUSTIFICACION);
  assert.strictEqual(v.aviso.textContent, '', 'al reescribir, el aviso se va sin tocar el botón');
  assert.strictEqual(v.aviso.hidden, true, 'y queda oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'sin hacer falta el botón');

  await ir('revision');
  await imprimir();
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.pac.procesoJustificado, '5',
    'y el JSON lleva el proceso de ahora: ' + JSON.stringify(salida.expediente.pac));
});

test('RONDA-38 pieza 1d · un avance de la 37 (con causas, sin procesoJustificado) entra sin pedir revisión', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Misma forma que deja la 37: causas guardadas, sin procesoJustificado.
  await importarTexto(archivo({
    pac: '4',
    justificacion: JUSTIFICACION_PAC,
    causas: ['monto']
  }));
  await ir('fundamentacion');

  const v = vista();
  assert.strictEqual(v.textarea.value, JUSTIFICACION_PAC,
    'el campo muestra la justificación que traía');
  assert.strictEqual(v.aviso.textContent, '', 'sin procesoJustificado, no pide revisar por eso');
  assert.strictEqual(v.aviso.hidden, true, 'el aviso está oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'ni botón de confirmar');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'y deja avanzar sin revisar nada');
});

test('RONDA-38 pieza 1e · un avance de la 36 (sin causas) sigue pidiendo revisar', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  const texto = fs.readFileSync(path.join(FIXTURES, 'r36-avance-justificado.json'), 'utf8');
  const respuesta = await importarTexto(texto, 'r36-avance-justificado.json');
  assert.match(respuesta, /Avance importado/, 'el avance entra: ' + respuesta);

  await ir('fundamentacion');
  const v = vista();
  assert.strictEqual(v.campo.hidden, false, 'el campo de la justificación está a la vista');
  assert.match(v.campo.textContent, /cambiaron las causas/i,
    'sin causas guardadas, pide revisarla: ' + v.campo.textContent);
  assert.strictEqual(v.aviso.hidden, false, 'el aviso está a la vista');
});

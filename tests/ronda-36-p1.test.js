'use strict';

/*
 * ronda-36-p1.test.js
 * RONDA-36 · pieza 1 · "La justificación del PAC, en Fundamentación y por sus
 * causas" (ORDEN-RONDA-36 pieza 1).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. El campo de justificación del PAC ya no está en "1 · Identificación":
 *     vive en "3 · Fundamentación". Con el preventivo por encima del monto del
 *     proceso aparece, dice por qué y el paso queda marcado "· falta".
 *  2. Sin la justificación, "Siguiente" no pasa de Fundamentación: el motivo se
 *     dice junto al campo, el foco queda ahí y el campo se marca. Con la
 *     justificación, imprime, exporta y el requerimiento dice "Justificación
 *     del PAC".
 *  3. Otra causa: el trimestre elegido no es el del proceso. El campo aparece,
 *     nombra los dos trimestres y frena la exportación.
 *  4. Otra causa: el año del requerimiento no es el del PAC (2027 contra 2026).
 *  5. Sin ninguna causa, el campo no aparece y el requerimiento exporta.
 *  6. Lo escrito se conserva si la causa desaparece (se oculta, no se borra) y
 *     vuelve con el texto.
 *
 * Los montos salen de config/pac.json: el proceso 4 (Insumos médicos VIIBA)
 * tiene $ 1.029.094,70; el 3, $ 4.739.880; el 1, $ 63.617.500; y el PAC es del
 * año 2026.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_PAC = 'El monto del proceso 4 quedó corto por la inflación del trimestre.';
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

// El stub no tiene Node.contains: se sube por parentNode hasta el contenedor.
function estaDentro(nodo, contenedor) {
  let p = nodo;
  while (p) {
    if (p === contenedor) {
      return true;
    }
    p = p.parentNode;
  }
  return false;
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

// El archivo que baja el generador: con el proceso del PAC y el trimestre
// elegidos. Cantidad y valor por pieza deciden el preventivo: por defecto
// 10 × $ 100 = $ 1.000, por debajo del monto de cualquier proceso.
function archivo(o) {
  const cantidad = o.cantidad === undefined ? 10 : o.cantidad;
  const valor = o.valor === undefined ? 100 : o.valor;
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: {
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
    }
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

async function imprimir() {
  const d = m.documento;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'los documentos se compusieron');
}

async function exportarJson() {
  const d = m.documento;
  const antes = m.descargas.length;
  d.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  return JSON.parse(await m.descargas[m.descargas.length - 1].texto());
}

test('RONDA-36 pieza 1a · la justificación del PAC está en Fundamentación, no en Identificación; y con el monto superado aparece y dice por qué', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Proceso 4 ($ 1.029.094,70) con $ 2.000.000: el preventivo lo supera.
  const respuesta = await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  assert.match(respuesta, /Requerimiento importado/, 'el archivo entra: ' + respuesta);

  const campo = d.getElementById('sgc-pac-justificacion');
  assert.ok(campo, 'el campo de la justificación del PAC existe');
  assert.strictEqual(estaDentro(campo, d.getElementById('sgc-paso-identificacion')), false,
    'ya no está en "1 · Identificación"');
  assert.strictEqual(estaDentro(campo, d.getElementById('sgc-paso-fundamentacion')), true,
    'ahora está en "3 · Fundamentación"');

  await ir('fundamentacion');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'el preventivo supera el monto del proceso: el campo aparece');
  const motivos = d.getElementById('sgc-pac-justificacion-motivos').textContent;
  assert.match(motivos, /supera/i, 'el texto dice que el preventivo supera el monto: ' + motivos);
  assert.match(motivos, /proceso 4/, 'y nombra el proceso 4: ' + motivos);
  assert.strictEqual(d.getElementById('sgc-pac-justificacion').value, '',
    'recién aparece vacío');

  const li = d.getElementById('sgc-pasos').querySelector('[data-paso="fundamentacion"]');
  assert.match(li.textContent, /falta/,
    'el paso "3 · Fundamentación" queda marcado "· falta": ' + li.textContent);
});

test('RONDA-36 pieza 1b · sin la justificación "Siguiente" no pasa y marca el campo; con ella imprime, exporta y el requerimiento lo dice', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');

  // Sin la justificación, "Siguiente" no pasa de Fundamentación: el motivo se
  // dice junto al campo, el foco queda ahí y el campo se marca.
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'sin justificar el PAC no se avanza');
  assert.strictEqual(d.getElementById('sgc-error-pac-justificacion').hidden, false,
    'el motivo se dice junto al campo');
  assert.strictEqual(d.activeElement, d.getElementById('sgc-pac-justificacion'),
    'y el foco queda en el campo');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion').classList.contains('campo-con-error'),
    true, 'que queda marcado con la clase campo-con-error');

  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'paso de revisión visible');
  await imprimir();

  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, false,
    'con la justificación y los documentos compuestos, exporta');
  const descargado = await exportarJson();
  assert.strictEqual(descargado.expediente.pac.numero, '4',
    'el JSON exportado lleva el proceso 4');
  assert.strictEqual(descargado.expediente.pac.justificacion, JUSTIFICACION_PAC,
    'y la justificación que la desbloqueó');

  const impreso = d.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('Justificación del PAC') && impreso.includes(JUSTIFICACION_PAC),
    'el requerimiento imprime la justificación del PAC: ' + impreso.slice(0, 300));
});

test('RONDA-36 pieza 1c · pidiendo para otro trimestre, el campo aparece, nombra los dos y frena la exportación', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // El proceso 3 es del 1° trimestre y el pedido es para el 2°.
  await importarTexto(archivo({ pac: '3', trimestre: '2', cantidad: 10, valor: 100 }));
  await ir('fundamentacion');

  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'otro trimestre: el campo de justificación aparece');
  const motivos = d.getElementById('sgc-pac-justificacion-motivos').textContent;
  assert.match(motivos, /1°/, 'nombra el trimestre del proceso del PAC: ' + motivos);
  assert.match(motivos, /2°/, 'y el trimestre pedido: ' + motivos);

  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, true,
    'sin la justificación no exporta');
  assert.match(d.getElementById('sgc-exportar-msj').textContent, /trimestre/,
    'y el motivo nombra el trimestre: ' + d.getElementById('sgc-exportar-msj').textContent);
});

test('RONDA-36 pieza 1d · con otro año, el campo aparece y nombra 2027 y 2026', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // El PAC es del año 2026 y el requerimiento se pide para 2027.
  await importarTexto(archivo({ pac: '1', anio: '2027', trimestre: '1', cantidad: 10, valor: 100 }));
  await ir('fundamentacion');

  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'otro año: el campo de justificación aparece');
  const motivos = d.getElementById('sgc-pac-justificacion-motivos').textContent;
  assert.match(motivos, /2027/, 'nombra el año del requerimiento: ' + motivos);
  assert.match(motivos, /2026/, 'y el año del PAC: ' + motivos);

  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, true,
    'sin la justificación no exporta');
});

test('RONDA-36 pieza 1e · sin causas el campo no aparece y el requerimiento exporta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Proceso 1, 1° trimestre, año 2026 y monto bajo: ninguna causa.
  await importarTexto(archivo({ pac: '1', anio: '2026', trimestre: '1', cantidad: 10, valor: 100 }));
  await ir('fundamentacion');

  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, true,
    'sin causas el campo no aparece');

  await ir('revision');
  await imprimir();
  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, false,
    'y el requerimiento exporta sin justificación del PAC');
});

test('RONDA-36 pieza 1f · lo escrito se conserva si la causa desaparece y vuelve', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // El proceso 3 es del 1° trimestre; el pedido es para el 2° (causa).
  await importarTexto(archivo({ pac: '3', trimestre: '2', cantidad: 10, valor: 100 }));
  await ir('fundamentacion');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'con la causa, el campo está a la vista');

  const texto = 'Se pide para el 2° por la demora del proceso anterior.';
  m.escribir('sgc-pac-justificacion', texto);

  // Desaparece la causa: el trimestre vuelve al del proceso (1°). El campo se
  // oculta, pero lo escrito no se borra.
  await ir('identificacion');
  m.setear('sgc-trimestre', '1');
  await ir('fundamentacion');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, true,
    'sin causa, el campo se oculta');

  // Vuelve la causa: el campo reaparece con lo escrito.
  await ir('identificacion');
  m.setear('sgc-trimestre', '2');
  await ir('fundamentacion');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'al volver la causa, el campo reaparece');
  assert.strictEqual(d.getElementById('sgc-pac-justificacion').value, texto,
    'con lo que se había escrito');
});

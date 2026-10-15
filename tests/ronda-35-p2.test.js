'use strict';

/*
 * ronda-35-p2.test.js
 * RONDA-35 · pieza 2 · "La moneda del proceso del PAC"
 * (ORDEN-RONDA-35 pieza 2).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Un proceso en dólares (22) exporta con "moneda": "USD" y el
 *     requerimiento impreso dice "USD 1.000,00" y "DÓLARES ESTADOSUNIDENSES
 *     MIL", sin "PESOS" ni "$ 1.000,00".
 *  2. Un proceso en pesos (4) exporta con "moneda": "ARS" y el impreso sigue
 *     en "$ 1.000,00" y "PESOS MIL".
 *  3. Con el preventivo por encima del monto del proceso 32, la justificación
 *     del PAC (ORDEN-RONDA-36 pieza 1, ahora en Fundamentación) frena el
 *     avance y "Imprimir": no compone nada y dice por qué (el caso del PDF del
 *     Jefe, proceso 32).
 *  4. Un avance de la ronda 34 con "preventivoUsd" cargado a mano entra, con
 *     el aviso de que el preventivo ahora sale de los valores de referencia.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const LUGAR = 'Depósito de Intendencia, VII Brigada Aérea';

// ORDEN-RONDA-36 pieza 1: el trimestre del archivo tiene que ser el del proceso
// del PAC. Si no, la pieza 1 pide justificación por trimestre y estos tests
// —que son sobre la moneda— dejarían de medir lo que miden.
const TRIMESTRE_DEL_PROCESO = { '4': '1', '8': '2', '22': '3', '32': '3' };

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

// El archivo que baja el generador, con el proceso del PAC ya elegido. Cantidad
// y valor por pieza deciden el total: por defecto 10 × $ 100 = $ 1.000.
function exportadoConPac(pac, opciones) {
  const o = opciones || {};
  const cantidad = o.cantidad === undefined ? 10 : o.cantidad;
  const valor = o.valor === undefined ? 100 : o.valor;
  const estado = o.estado || 'para-abastecimiento';
  const sello = { formato: 'sgc-requerimiento/1', estado: estado };
  return JSON.stringify({
    sello: sello,
    expediente: {
      titulo: 'Resmas A4',
      anio: '2026',
      trimestre: TRIMESTRE_DEL_PROCESO[String(pac.numero)] || '1',
      lugarEntrega: LUGAR,
      pac: o.legacyPreventivoUsd === undefined
        ? pac
        : { numero: pac.numero, preventivoUsd: o.legacyPreventivoUsd, justificacion: '' },
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

async function exportarJson() {
  const v = exportarVista();
  assert.strictEqual(v.boton.disabled, false, 'se puede exportar');
  const antes = m.descargas.length;
  v.boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  return JSON.parse(await m.descargas[m.descargas.length - 1].texto());
}

test('RONDA-35 pieza 2a · el proceso 22 (USD) exporta moneda USD y el impreso lo dice', async () => {
  await entrarComoUsuario();
  await importarTexto(exportadoConPac({ numero: '22', justificacion: '' }));
  await hastaRevision();
  await imprimir();

  const impreso = m.documento.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('USD 1.000,00'),
    'el total general dice USD: ' + impreso.slice(0, 200));
  assert.match(impreso, /DÓLARES ESTADOUNIDENSES MIL/,
    'y la suma en letras dice DÓLARES ESTADOUNIDENSES: ' + impreso.slice(0, 200));
  assert.ok(!/PESOS/.test(impreso), 'y no dice PESOS');
  assert.ok(!impreso.includes('$ 1.000,00'), 'ni el mismo monto en pesos');

  const archivo = await exportarJson();
  assert.strictEqual(archivo.expediente.moneda, 'USD',
    'el JSON exportado dice moneda USD');
  assert.strictEqual(archivo.expediente.pac.numero, '22');
  assert.ok(!('preventivoUsd' in archivo.expediente.pac),
    'y el pac ya no lleva preventivoUsd');
});

test('RONDA-35 pieza 2b · el proceso 4 (ARS) exporta moneda ARS y el impreso sigue en pesos', async () => {
  await entrarComoUsuario();
  await importarTexto(exportadoConPac({ numero: '4', justificacion: '' }));
  await hastaRevision();
  await imprimir();

  const impreso = m.documento.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('$ 1.000,00'),
    'el total general sigue en pesos: ' + impreso.slice(0, 200));
  assert.match(impreso, /PESOS MIL/, 'y la suma en letras dice PESOS: ' + impreso.slice(0, 200));

  const archivo = await exportarJson();
  assert.strictEqual(archivo.expediente.moneda, 'ARS',
    'el JSON exportado dice moneda ARS');
});

test('RONDA-35 pieza 2c · el PAC superado pide la justificación en Fundamentación y frena Imprimir (proceso 32)', async () => {
  await entrarComoUsuario();
  // 560 × 189.285,71 = 106.000.000: supera los $ 762.637,50 del proceso 32.
  await importarTexto(exportadoConPac({ numero: '32', justificacion: '' },
    { cantidad: 560, valor: 189285.71 }));

  // ORDEN-RONDA-36 pieza 1: el monto superado es causa de la justificación del
  // PAC, que vive en Fundamentación; sin ella no se avanza ni se imprime.
  const d = m.documento;
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');

  assert.strictEqual(d.getElementById('sgc-pac-justificacion-campo').hidden, false,
    'con el monto superado aparece el campo de justificación');
  assert.match(d.getElementById('sgc-pac-justificacion-motivos').textContent,
    /proceso 32/, 'y el texto nombra el proceso 32');

  // "Imprimir" no compone nada y el motivo nombra el PAC.
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => d.getElementById('sgc-exportar-msj').hidden === false, 20000,
    'no apareció el motivo');

  const vacio = (d.getElementById('sgc-generador-impresion').textContent || '').trim() === '';
  assert.ok(vacio, 'no se compone ningún documento');
  assert.match(d.getElementById('sgc-exportar-msj').textContent,
    /justificar el preventivo que supera el monto del proceso 32 del PAC/,
    'y el motivo es el del PAC: ' + d.getElementById('sgc-exportar-msj').textContent);

  // Y "Siguiente" tampoco pasa de Fundamentación.
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(d.getElementById('sgc-paso-fundamentacion').hidden, false,
    'sin justificar el PAC no se avanza');
});

test('RONDA-35 pieza 2a · un avance de la 34 con "preventivoUsd" entra, con el aviso', async () => {
  await entrarComoUsuario();
  const avance = exportadoConPac({ numero: '22', justificacion: '' },
    { estado: 'avance', legacyPreventivoUsd: 1000 });
  const respuesta = await importarTexto(avance, 'resmas-avance.json');
  assert.match(respuesta, /preventivo en dólares ahora sale de los valores/i,
    'con el aviso del cambio: ' + respuesta);
  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 1,
    'y el renglón se cargó');
});

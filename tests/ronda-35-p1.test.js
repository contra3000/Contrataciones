'use strict';

/*
 * ronda-35-p1.test.js
 * RONDA-35 · pieza 1 · "Identificación obligatoria también en archivos viejos, y
 * lugar de entrega" (ORDEN-RONDA-35 pieza 1).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Un requerimiento completo de la ronda 33 (sin trimestre, sin PAC y sin
 *     lugar de entrega) entra, pero NO exporta: el motivo pide las tres cosas y
 *     el paso "1 · Identificación" queda marcado "· falta".
 *  2. Elegidos el trimestre, el proceso del PAC y el lugar de entrega, imprime y
 *     exporta: el JSON trae los tres, la EETT dice el lugar que se escribió y el
 *     requerimiento ya no lleva la fila "Lugar" (ORDEN-RONDA-36 pieza 2).
 *  3. Lo mismo con un avance de la ronda 31 (sin trimestre ni PAC): entra y no
 *     exporta hasta completar la Identificación.
 *  4. Con el lugar de entrega vacío, "Siguiente" no pasa y deja el foco en
 *     #sgc-lugar-entrega con campo-con-error.
 *  5. Sin la marca del generador (la aplicación con servidor nunca la pone),
 *     validarIdentificacion de unos datos sin trimestre, pac ni lugarEntrega
 *     sigue siendo válida.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const LUGAR = 'Depósito de Intendencia, Hangar 3';
const CONSTANTE = 'VII Brigada Aérea - Moreno';

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

async function importarTexto(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'archivo.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó');
  return m.msjArchivo().textContent;
}

function r33Completo() {
  return fs.readFileSync(path.join(FIXTURES, 'r33-completo.json'), 'utf8');
}

// Un avance de la ronda 31: sin trimestre ni PAC. Se firma con la huella real
// (el módulo la calcula igual en Node y en el navegador) para que entre por
// donde entra un avance de verdad.
async function avanceViejo() {
  const archivo = {
    sello: {
      formato: 'sgc-requerimiento/1',
      versionGenerador: 'r31-0000000',
      versionCatalogo: '98201747',
      rol: 'generador',
      grado: 'Primer Teniente',
      nombre: 'Juan',
      apellido: 'Contreras',
      numeroControl: 12345,
      fecha: '2026-10-01T12:00:00.000Z',
      version: 3,
      estado: 'avance',
      paso: 1
    },
    expediente: {
      titulo: 'Resmas A4',
      anio: '2026',
      campos: {
        operador: 'Juan Contreras · 12.345',
        dependenciaSolicitante: 'División Usuario',
        justificacion: 'Se necesita reponer insumos.',
        objetivo: ''
      },
      renglones: [
        {
          codigo: '2.3.1-6563.129',
          item: 'Resma papel A4',
          cantidad: 3,
          unidad: 'UN',
          aclaracion: '',
          valoresReferencia: []
        }
      ],
      presupuestos: []
    }
  };
  archivo.sello.huella = await SGC().generadorIntercambio.huellaDe(archivo);
  return JSON.stringify(archivo);
}

// Exportar y devolver el JSON descargado, como haría el test por la pantalla.
async function exportar() {
  const antes = m.descargas.length;
  m.documento.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  return JSON.parse(await m.descargas[m.descargas.length - 1].texto());
}

test('RONDA-35 pieza 1a · un requerimiento de la 33 no exporta sin trimestre, PAC ni lugar de entrega, y el paso 1 queda "falta"', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  const respuesta = await importarTexto(r33Completo());
  assert.match(respuesta, /Requerimiento importado/, 'el archivo entra: ' + respuesta);
  assert.strictEqual(pasoVisible(), 'renglones',
    'un requerimiento exportado abre en el paso de renglones');

  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'pasó a fundamentación');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'revision', 'pasó a la revisión');

  d.getElementById('sgc-btn-imprimir').click();
  const exportarBtn = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportarBtn.disabled, true, 'sin la Identificación no se exporta');
  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(msj.hidden, false, 'el motivo se dice');
  assert.match(msj.textContent, /Elegí el trimestre para el que se pide/i,
    'nombra el trimestre: ' + msj.textContent);
  assert.match(msj.textContent, /Elegí el proceso del PAC 2026/i,
    'nombra el proceso del PAC: ' + msj.textContent);
  assert.match(msj.textContent, /Escribí el lugar de entrega/i,
    'y el lugar de entrega: ' + msj.textContent);

  const li = d.getElementById('sgc-pasos').querySelector('[data-paso="identificacion"]');
  assert.match(li.textContent, /falta/, 'el paso 1 queda marcado "· falta": ' + li.textContent);
});

test('RONDA-35 pieza 1b · con trimestre, PAC y lugar, imprime y exporta: el JSON trae los tres', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(r33Completo());

  d.getElementById('sgc-anterior').click();
  assert.strictEqual(pasoVisible(), 'identificacion', 'volvió a Identificación');
  m.elegirPac('1');
  assert.strictEqual(d.getElementById('sgc-trimestre').value, '1',
    'el proceso 1 trae su trimestre');
  m.escribir('sgc-lugar-entrega', LUGAR);

  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'renglones', 'la Identificación completa deja pasar');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'pasó a fundamentación');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'revision', 'pasó a la revisión');

  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'los documentos se compusieron');

  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, false,
    'con los documentos y la Identificación se exporta');
  const archivo = await exportar();
  assert.strictEqual(archivo.expediente.trimestre, '1', 'el JSON trae el trimestre');
  assert.strictEqual(archivo.expediente.pac.numero, '1', 'el JSON trae el proceso del PAC');
  assert.strictEqual(archivo.expediente.lugarEntrega, LUGAR, 'el JSON trae el lugar de entrega');

  const impreso = d.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes(LUGAR),
    'la EETT dice el lugar que se escribió: ' + impreso);
  // ORDEN-RONDA-36 pieza 2: el requerimiento del generador ya no lleva la fila
  // "Lugar"; la constante salió de config/aplicacion.json.
  assert.strictEqual(impreso.includes(CONSTANTE), false,
    'el requerimiento ya no imprime la constante de config: ' + impreso);
});

test('RONDA-35 pieza 1c · un avance de la 31, sin trimestre ni PAC, entra y no exporta hasta completar la Identificación', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  const respuesta = await importarTexto(await avanceViejo(), 'resmas-avance.json');
  assert.match(respuesta, /Avance importado/, 'el avance entra: ' + respuesta);

  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'pasó a fundamentación');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'revision', 'pasó a la revisión');

  d.getElementById('sgc-btn-imprimir').click();
  const exportarBtn = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportarBtn.disabled, true, 'sin la Identificación no se exporta');
  const msj = d.getElementById('sgc-exportar-msj').textContent;
  assert.match(msj, /trimestre/i, 'el motivo pide el trimestre: ' + msj);
  assert.match(msj, /PAC/, 'y el PAC: ' + msj);
  assert.match(msj, /lugar de entrega/i, 'y el lugar de entrega: ' + msj);
});

test('RONDA-35 pieza 1d · sin lugar de entrega, "Siguiente" no pasa y deja el foco en el campo', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  m.escribir('sgc-titulo', 'Sin lugar');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'X');
  m.elegirPac('1');

  d.getElementById('sgc-siguiente').click();

  assert.strictEqual(pasoVisible(), 'identificacion', 'no se avanzó de paso');
  const campo = d.getElementById('sgc-lugar-entrega');
  const error = d.getElementById('sgc-error-lugar-entrega');
  assert.strictEqual(error.hidden, false, 'el motivo se dice en el campo');
  assert.strictEqual(error.textContent, 'Escribí el lugar de entrega',
    'con las palabras de la orden: ' + error.textContent);
  assert.strictEqual(campo.classList.contains('campo-con-error'), true,
    'el campo queda marcado con la clase campo-con-error');
  assert.strictEqual(d.activeElement, campo, 'y queda enfocado');
});

test('RONDA-35 pieza 1e · sin la marca (aplicación con servidor), la Identificación sin trimestre, PAC ni lugar sigue siendo válida', () => {
  const val = SGC().core.validacion;
  val.exigirIdentificacionCompleta(false);
  try {
    const r = val.validarIdentificacion({
      titulo: 'Resmas A4',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      operador: 'ana.perez@faa.mil.ar'
    });
    assert.strictEqual(r.valido, true,
      'sin la marca, lo que no está no se exige: ' + JSON.stringify(r.errores));
  } finally {
    val.exigirIdentificacionCompleta(true);
  }

  const conMarca = val.validarIdentificacion({
    titulo: 'Resmas A4',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    operador: 'ana.perez@faa.mil.ar'
  });
  assert.strictEqual(conMarca.valido, false,
    'y con la marca del generador, sí: hacen falta trimestre, PAC y lugar de entrega');
});

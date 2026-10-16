'use strict';

/*
 * ronda-37-p1.test.js
 * RONDA-37 · pieza 1 · "El requerimiento dice el lugar de entrega"
 * (ORDEN-RONDA-37 pieza 1).
 *
 * La pregunta del auditor 36: sin "Lugar", el requerimiento que se firma no
 * decía dónde se entrega. La decisión del Jefe del 16/10: el requerimiento
 * repite el lugar de entrega que escribió la persona, el mismo texto que la
 * EETT (sale del mismo campo, no pueden contradecirse).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Con el lugar de entrega "Depósito de Intendencia, Hangar 3", el
 *     requerimiento impreso tiene la fila "Lugar de entrega" con ese texto, y
 *     la EETT también.
 *  2. En ningún documento aparece la constante "VII Brigada Aérea - Moreno".
 *  3. Control: el requerimiento que arma la aplicación con servidor sigue
 *     saliendo IDÉNTICO byte a byte a como salía en bf3ba2d (no trae
 *     lugarEntrega y no debe agregar la fila).
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

// Las etiquetas (<dt>) del bloque de datos de un documento del stub.
function etiquetasDe(raiz) {
  return raiz.querySelectorAll('dt').map((dt) => dt.textContent);
}

// El valor (<dd>) que acompaña a una etiqueta, por su posición en el <dl>.
function valorDe(raiz, etiqueta) {
  const dts = raiz.querySelectorAll('dt');
  const dds = raiz.querySelectorAll('dd');
  for (let i = 0; i < dts.length; i++) {
    if (dts[i].textContent === etiqueta) {
      return dds[i] ? dds[i].textContent : null;
    }
  }
  return null;
}

test('RONDA-37 pieza 1a · el requerimiento dice el lugar de entrega que escribió la persona, igual que la EETT', async () => {
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

  // En la impresión, el requerimiento es la primera hoja y la EETT la segunda.
  const seccion = d.getElementById('sgc-generador-impresion');
  const req = seccion.children[0];
  const eett = seccion.children[1];
  assert.ok(req, 'el requerimiento quedó compuesto');
  assert.ok(eett, 'la EETT quedó compuesta');

  assert.strictEqual(valorDe(req, 'Lugar de entrega'), LUGAR,
    'el requerimiento dice el lugar de entrega que escribió la persona: ' +
    JSON.stringify(etiquetasDe(req)));
  assert.strictEqual(valorDe(eett, 'Lugar de entrega'), LUGAR,
    'la EETT dice el mismo lugar de entrega');
  assert.strictEqual(seccion.textContent.split(CONSTANTE).length - 1, 0,
    'ningún documento imprime la constante que salió de config: ' + seccion.textContent);
});

test('RONDA-37 pieza 1b · control: el requerimiento de la aplicación con servidor sale idéntico a antes', () => {
  // El MISMO orden de carga del script que capturó el antes (baseline-r34.js).
  // Después de arrancar la montura los módulos ya están en el caché de require,
  // así que estas líneas son inocuas: sirven de documento de lo que se compara.
  require('../app/js/core/namespaces.js');
  require('../app/js/core/config.js');
  require('../app/js/core/roles.js');
  require('../app/js/core/cotas-encabezado.js');
  require('../app/js/core/utils.js');
  require('../app/js/core/autorizacion.js');
  require('../app/js/core/auditoria.js');
  require('../app/js/core/migraciones.js');
  require('../app/js/core/requerimiento.js');
  require('../app/js/core/anexo-eett.js');
  require('../app/js/core/validacion.js');
  require('../app/js/core/estados.js');
  require('../app/js/adapters/repo.js');
  require('../app/js/renders/documento.js');
  require('../app/js/renders/especificacion-tecnica.js');
  require('../app/js/renders/requerimiento.js');

  const sgc = SGC();
  const CONTEXTO = {
    timestamp: '2026-08-14T10:00:00.000Z',
    email: 'ana.perez@faa.mil.ar',
    rol: 'generador',
    equipo: 'PC-PRUEBA-01'
  };
  const base = {
    titulo: 'Resmas A4',
    anio: '2026',
    solicitante: { nombre: 'Ana', apellido: 'Pérez', email: 'ana.perez@faa.mil.ar', sector: 'usuario' },
    catalogoVersion: '2026-10',
    campos: {
      operador: 'ana.perez@faa.mil.ar',
      dependenciaSolicitante: 'División Usuario',
      justificacion: 'Se necesita reponer insumos de papelería.',
      objetivo: ''
    },
    renglones: [
      { codigo: '2.3.1-6563.129', item: 'Resma papel A4', cantidad: 10, unidad: 'UN', aclaracion: '' }
    ],
    identificacion: {
      numero: '8',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14'
  };
  const exp = sgc.adapters.repo.construirExpediente(base, CONTEXTO, '2026-008');
  const html = sgc.renders.requerimiento.componer(exp);

  const foto = fs.readFileSync(
    path.join(RAIZ, 'tests', 'fixtures', 'requerimiento-servidor-antes-ronda34.html'),
    'utf8');
  assert.strictEqual(html, foto,
    'la app con servidor sigue generando el mismo requerimiento, byte a byte');
  assert.strictEqual(html.includes('Lugar de entrega'), false,
    'sin lugarEntrega, el requerimiento del servidor no agrega la fila');
});

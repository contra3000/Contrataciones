'use strict';

/*
 * ronda-34-p1.test.js
 * RONDA-34 · pieza 1 · "Trimestre y los campos de los documentos"
 * (ORDEN-RONDA-34 pieza 1).
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. "Siguiente" no pasa sin elegir el trimestre para el que se pide: el mot
 *     vive en el campo, que queda marcado y enfocado.
 *  2. Elegido el trimestre, los documentos piden como decidió el Jefe el
 *     13/10: Expediente "—", Vigencia el último día del trimestre, y en
 *     la EETT la Finalidad es la misma justificación. (ORDEN-RONDA-36 pieza 2:
 *     el requerimiento ya no muestra la fila "Lugar".)
 *  3. El JSON exportado lleva el trimestre y, al reimportarlo, el campo lo
 *     muestra de nuevo.
 *  4. Un archivo de la ronda 33 (sin trimestre) entra igual: el campo queda
 *     para elegir, sin rechazar nada.
 *  5. Control: el requerimiento que arma la aplicación con servidor sigue
 *     saliendo IDÉNTICO byte a byte a como salía antes de esta pieza.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
// ORDEN-RONDA-35 pieza 1: el archivo de estas pruebas trae el lugar de entrega
// que escribe la persona. ORDEN-RONDA-36 pieza 1: el proceso del PAC tiene que
// ser coherente con el trimestre que se prueba —el 2— para que no haya causa
// de justificación: el proceso 8 es del 2° trimestre y su monto (4.601.377,15)
// no lo supera el preventivo de estos renglones.
const LUGAR_ENTREGA = 'Depósito de Intendencia, VII Brigada Aérea';

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

// El archivo que baja el generador: sello presente, expediente con todo lo que
// la importación le va a exigir, y sobre todo el trimestre del que esta pieza
// se ocupa. La huella no se pone: entra como un archivo de antes de que se
// firmara (los examina la ronda 30 con su propia pieza).
function exportadoCompleto(trimestre) {
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: {
      titulo: 'Resmas A4',
      anio: '2026',
      trimestre: trimestre,
      lugarEntrega: LUGAR_ENTREGA,
      pac: { numero: '8', justificacion: '' },
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
          cantidad: 10,
          unidad: 'UN',
          aclaracion: '',
          valoresReferencia: [
            { presupuestoId: 'p1', base: 'unitario', valor: 4200 },
            { presupuestoId: 'p2', base: 'unitario', valor: 4500 }
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

// La plantilla de la ronda 33: sin `trimestre`, que es lo que esta pieza pide
// que siga entrando.
function plantillaVieja() {
  return JSON.stringify({
    formato: 'sgc-requerimiento/1',
    titulo: 'Resmas A4',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: justificacion,
    objetivo: '',
    renglones: [
      { codigo: '', buscar: 'papel', cantidad: 3, unidad: 'UN', aclaracion: 'Papel obra' }
    ]
  });
}

async function importarTexto(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'archivo.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó');
  return m.msjArchivo().textContent;
}

// Importa un requerimiento ya exportado y lo deja en el paso de revisión, que
// es donde se imprime y se exporta. Devuelve el <select> del trimestre.
async function revisarImportadoDe(trimestre) {
  await entrarComoUsuario();
  await importarTexto(exportadoCompleto(trimestre));
  const d = m.documento;
  assert.strictEqual(d.getElementById('sgc-paso-renglones').hidden, false,
    'el archivo importado abre en el paso de renglones');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  return d;
}

function apariciones(texto, sub) {
  return texto.split(sub).length - 1;
}

test('RONDA-34 pieza 1a · sin trimestre elegido, "Siguiente" no pasa y el campo queda marcado', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  assert.strictEqual(d.getElementById('sgc-trimestre').value, '',
    'recién abierto el trimestre está sin elegir');

  d.getElementById('sgc-siguiente').click();

  const campo = d.getElementById('sgc-trimestre');
  assert.strictEqual(d.getElementById('sgc-paso-identificacion').hidden, false,
    'no se avanzó de paso');
  const error = d.getElementById('sgc-error-trimestre');
  assert.strictEqual(error.hidden, false, 'el motivo se dice en el campo');
  assert.strictEqual(error.textContent, 'Elegí el trimestre para el que se pide',
    'con las palabras de la orden: ' + error.textContent);
  assert.strictEqual(campo.classList.contains('campo-con-error'), true,
    'el campo queda marcado con la clase campo-con-error');
  assert.strictEqual(d.activeElement, campo, 'y queda enfocado');
});

test('RONDA-34 pieza 1b · elegido el 2° trimestre, los documentos dicen la vigencia, el lugar y la finalidad del Jefe', async () => {
  const d = await revisarImportadoDe('2');

  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'los documentos se compusieron');

  const impreso = d.getElementById('sgc-generador-impresion').textContent;
  assert.ok(impreso.includes('30/06/2026'),
    'la vigencia es el último día del 2° trimestre del 2026: ' + impreso);
  // ORDEN-RONDA-36 pieza 2: el requerimiento del generador ya no lleva la fila
  // "Lugar" (la constante salió de config/aplicacion.json); el lugar de entrega
  // queda sólo en la EETT.
  assert.strictEqual(apariciones(impreso, 'VII Brigada Aérea - Moreno'), 0,
    'el requerimiento ya no imprime la constante de config: ' + impreso);
  assert.ok(impreso.includes(LUGAR_ENTREGA),
    'y la EETT imprime el lugar de entrega que escribió la persona: ' + impreso);
  assert.strictEqual(apariciones(impreso, justificacion), 2,
    'la justificación sale en la EETT como Fundamentación y como Finalidad');
  assert.ok(!impreso.includes('generador-'),
    'lo impreso nunca muestra el identificador interno del generador');
});

test('RONDA-34 pieza 1c · el JSON exportado lleva el trimestre y al reimportarlo el campo lo muestra', async () => {
  const d = await revisarImportadoDe('2');

  // El paso 4 no exporta hasta imprimir: el documento de la EETT es un
  // entregable obligatorio (por el núcleo, que se exige a sí mismo).
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'los documentos se compusieron');

  const antes = m.descargas.length;
  const exportar = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportar.disabled, false, 'con los documentos compuestos se exporta');
  exportar.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());

  assert.strictEqual(archivo.sello.formato, 'sgc-requerimiento/1',
    'sigue siendo el formato de siempre');
  assert.strictEqual(archivo.expediente.trimestre, '2',
    'el trimestre viaja en el expediente, junto al año');

  // Se cierra y se vuelve a entrar: el archivo se reimporta y el campo muestra
  // lo que traía, directamente.
  await entrarComoUsuario();
  const respuesta = await importarTexto(
    await m.descargas[m.descargas.length - 1].texto(), 'requerimiento-2026.json');
  assert.match(respuesta, /Requerimiento importado/, 'el archivo vuelve a entrar: ' + respuesta);
  assert.strictEqual(m.documento.getElementById('sgc-trimestre').value, '2',
    'el select muestra el trimestre que traía el archivo');
});

test('RONDA-34 pieza 1d · un archivo de la ronda 33, sin trimestre, entra y deja el campo para elegir', async () => {
  await entrarComoUsuario();
  await importarTexto(plantillaVieja());

  const campo = m.documento.getElementById('sgc-trimestre');
  assert.strictEqual(campo.value, '', 'el campo queda sin elegir, no rechaza');
  assert.strictEqual(SGC().views.wizard.datos().identificacion.trimestre, '',
    'tras el primer "Siguiente" pasa a ser obligatorio, como recién importado');

  m.documento.getElementById('sgc-siguiente').click();

  assert.strictEqual(m.documento.getElementById('sgc-paso-renglones').hidden, false,
    'el avance se frena por el renglón por buscar, que es lo que la ronda 33 pide');
  assert.ok(m.documento.getElementById('sgc-error-trimestre').hidden,
    'y el motivo NO es el trimestre: el campo sigue disponible para elegir');
});

test('RONDA-34 pieza 1e · control: el requerimiento de la aplicación con servidor sale idéntico a antes', async () => {
  // El MISMO orden de carga del script que capturó el antes (baseline-r34.js):
  // compone el expediente del servidor tal cual y lo compara byte a byte contra
  // la foto tomada antes de tocar nada de esta pieza.
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
      { codigo: CODIGO_PAPELERIA, item: ITEM_PAPELERIA, cantidad: 10, unidad: 'UN', aclaracion: '' }
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
});
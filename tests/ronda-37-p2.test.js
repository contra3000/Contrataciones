'use strict';

/*
 * ronda-37-p2.test.js
 * RONDA-37 · pieza 2 · "La justificación del PAC, al día" (ORDEN-RONDA-37
 * pieza 2).
 *
 * El problema que cuida: la justificación del PAC se escribe por una causa (el
 * monto superado, el trimestre, el año, "No autorizado"). Si después cambia la
 * causa, lo escrito puede dejar de cubrir lo que hay que justificar —o cubrir de
 * más—, y nadie se entera: hasta ahora seguía exportándose igual. Ahora, cuando
 * las causas cambian desde que se escribió (o desde que se la dio por buena), se
 * pide revisarla.
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. Sin causa y sin justificación, todo sigue igual: no pide revisar, exporta
 *     y el PAC exportado no lleva claves.
 *  2. Escribir con una causa deja la justificación al día (no pide revisar) y
 *     las claves viajan en el JSON.
 *  3. Si la causa cambia después de imprimir: avisa, marca el campo, muestra el
 *     botón, frena "Siguiente" y "Exportar" con el motivo, descarta el documento
 *     compuesto (quedaba viejo) y el paso "3 · Fundamentación" queda "· falta".
 *  4. Confirmar que la justificación sigue valiendo la pone al día: se va el
 *     aviso, se desmarca el campo y exporta con las claves de ahora.
 *  5. Reescribirla también la pone al día, sin tocar el botón.
 *  6. Un avance de la ronda 36 —justificación escrita, sin claves— pide revisar,
 *     frena y, al confirmar, exporta.
 *  7. Ida y vuelta: el JSON exportado lleva las claves y, reimportado, no pide
 *     revisar la justificación.
 *  8. Control: el requerimiento que arma la aplicación con servidor sigue
 *     saliendo IDÉNTICO byte a byte a como salía antes de esta pieza.
 *
 * Los montos salen de config/pac.json: el proceso 4 (Insumos médicos VIIBA)
 * tiene $ 1.029.094,70; el 1, $ 63.617.500; el PAC es del año 2026.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_PAC = 'El monto del proceso 4 quedó corto por la inflación del trimestre.';
const OTRA_JUSTIFICACION = 'El pedido no estaba previsto en el PAC 2026.';
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

// El archivo que baja el generador. Cantidad y valor deciden el preventivo: por
// defecto 10 × $ 100 = $ 1.000; con 20000 × $ 100 = $ 2.000.000, el proceso 4
// ($ 1.029.094,70) queda superado.
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
  const antes = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0,
    20000, 'los documentos se compusieron');
  return antes;
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
    error: d.getElementById('sgc-error-pac-justificacion'),
    boton: d.getElementById('sgc-btn-exportar'),
    msj: d.getElementById('sgc-exportar-msj'),
    impreso: d.getElementById('sgc-generador-impresion')
  };
}

test('RONDA-37 pieza 2a · sin causa y sin justificación nada pide revisar, exporta, y el PAC no lleva claves', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Proceso 1 ($ 63.617.500), 1° trimestre, año 2026, $ 1.000: ninguna causa.
  await importarTexto(archivo({ pac: '1', cantidad: 10, valor: 100 }));
  await ir('fundamentacion');

  const v = vista();
  assert.strictEqual(v.campo.hidden, true, 'sin causa el campo no aparece');
  assert.strictEqual(v.aviso.textContent, '', 'y no hay aviso que revisar');
  assert.strictEqual(v.aviso.hidden, true, 'el aviso está oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'ni botón de confirmar');

  await ir('revision');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false, 'sin causa, exporta');
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.pac.numero, '1', 'el JSON lleva el proceso 1');
  assert.strictEqual(salida.expediente.pac.causas, undefined,
    'sin causas no viajan claves: ' + JSON.stringify(salida.expediente.pac));
});

test('RONDA-37 pieza 2b · escribir con una causa deja la justificación al día y las claves viajan en el JSON', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Proceso 4 con $ 2.000.000: el preventivo supera el monto (causa "monto").
  await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');

  const v = vista();
  assert.strictEqual(v.campo.hidden, false, 'con la causa, el campo está a la vista');
  assert.strictEqual(v.aviso.textContent, '', 'recién importado no hay aviso: la justificación está vacía');

  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  assert.strictEqual(v.aviso.textContent, '', 'lo que se escribe queda al día: no pide revisar');
  assert.strictEqual(v.aviso.hidden, true, 'el aviso está oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'y no hay botón de confirmar');
  assert.strictEqual(v.textarea.classList.contains('campo-con-error'), false,
    'el campo no queda marcado');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'paso de revisión visible');
  await imprimir();
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.pac.justificacion, JUSTIFICACION_PAC,
    'el JSON lleva la justificación');
  assert.deepStrictEqual(salida.expediente.pac.causas, ['monto'],
    'y las causas que cubría: ' + JSON.stringify(salida.expediente.pac.causas));
});

test('RONDA-37 pieza 2c · si la causa cambia después de imprimir: avisa, marca, frena y descarta el documento', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  // Sin causa (proceso 1), con los valores que después van a superar al 4.
  await importarTexto(archivo({ pac: '1', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  await ir('revision');
  await imprimir();

  const v = vista();
  assert.notStrictEqual(v.impreso.textContent.trim(), '',
    'antes del cambio el documento está compuesto');

  // La causa cambia: ahora el proceso es el 4 y el preventivo lo supera.
  await ir('identificacion');
  m.elegirPac('4');

  assert.strictEqual(v.campo.hidden, false, 'con la causa nueva el campo sigue a la vista');
  assert.match(v.campo.textContent, /cambiaron las causas/i,
    'el aviso pide revisar la justificación: ' + v.campo.textContent);
  assert.strictEqual(v.aviso.hidden, false, 'el aviso está a la vista');
  assert.strictEqual(v.confirmar.hidden, false, 'y aparece el botón para darla por buena');
  assert.strictEqual(v.textarea.classList.contains('campo-con-error'), true,
    'el campo queda marcado');

  assert.strictEqual(v.impreso.textContent.trim(), '',
    'el documento compuesto se descartó: mostraba una justificación vieja');

  assert.strictEqual(v.boton.disabled, true, 'con la revisión pendiente no exporta');
  assert.match(v.msj.textContent, /cambiaron las causas/i,
    'y el motivo lo dice: ' + v.msj.textContent);

  // "Siguiente" tampoco pasa de Fundamentación.
  await ir('fundamentacion');
  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'con la revisión pendiente no se avanza');
  assert.match(v.error.textContent, /cambiaron las causas/i,
    'el motivo se dice junto al campo: ' + v.error.textContent);
  const li = d.getElementById('sgc-pasos').querySelector('[data-paso="fundamentacion"]');
  assert.match(li.textContent, /falta/,
    'el paso "3 · Fundamentación" queda marcado "· falta": ' + li.textContent);
});

test('RONDA-37 pieza 2d · confirmar que la justificación sigue valiendo la pone al día y exporta con las claves de ahora', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);

  // La causa cambia a "No autorizado en el PAC".
  m.elegirPac('no-autorizado');
  const v = vista();
  assert.strictEqual(v.aviso.hidden, false, 'el aviso pide revisar');

  v.confirmar.click();
  assert.strictEqual(v.aviso.textContent, '', 'al confirmar, el aviso se va');
  assert.strictEqual(v.aviso.hidden, true, 'y queda oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'el botón se va con él');
  assert.strictEqual(v.textarea.classList.contains('campo-con-error'), false,
    'y el campo se desmarca');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'con la revisión hecha, avanza');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false, 'y exporta');
  const salida = await exportarJson();
  assert.strictEqual(salida.expediente.pac.numero, 'no-autorizado',
    'el JSON lleva el proceso nuevo');
  assert.deepStrictEqual(salida.expediente.pac.causas, ['fuera-del-pac'],
    'y las causas de ahora: ' + JSON.stringify(salida.expediente.pac.causas));
});

test('RONDA-37 pieza 2e · reescribir la justificación también la pone al día', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  m.elegirPac('no-autorizado');

  const v = vista();
  assert.strictEqual(v.aviso.hidden, false, 'con la causa cambiada, pide revisar');

  m.escribir('sgc-pac-justificacion', OTRA_JUSTIFICACION);
  assert.strictEqual(v.aviso.textContent, '', 'al reescribir, el aviso se va sin tocar el botón');
  assert.strictEqual(v.confirmar.hidden, true, 'y el botón no hace falta');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'con la revisión hecha, avanza');
});

test('RONDA-37 pieza 2f · un avance de la 36 con justificación y sin claves pide revisar, frena y, al confirmar, exporta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  const texto = fs.readFileSync(path.join(FIXTURES, 'r36-avance-justificado.json'), 'utf8');
  const respuesta = await importarTexto(texto, 'r36-avance-justificado.json');
  assert.match(respuesta, /Avance importado/, 'el avance entra: ' + respuesta);
  assert.strictEqual(pasoVisible(), 'revision', 'y abre donde quedó, en la revisión');

  const v = vista();
  assert.strictEqual(v.boton.disabled, true, 'con la revisión pendiente no exporta');
  assert.match(v.msj.textContent, /cambiaron las causas/i,
    'y el motivo lo dice: ' + v.msj.textContent);

  await ir('fundamentacion');
  assert.strictEqual(v.campo.hidden, false, 'el campo de la justificación está a la vista');
  assert.strictEqual(v.textarea.value,
    'Se suman dos trimestres por la demora del proceso anterior.',
    'con la justificación que traía');
  assert.match(v.campo.textContent, /cambiaron las causas/i,
    'y el aviso pide revisarla');

  v.confirmar.click();
  assert.strictEqual(v.aviso.textContent, '', 'al confirmar, se va el aviso');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'con la revisión hecha, avanza');
  await imprimir();
  assert.strictEqual(v.boton.disabled, false, 'y exporta');
  const salida = await exportarJson();
  assert.deepStrictEqual(salida.expediente.pac.causas, ['monto'],
    'con las claves de ahora: ' + JSON.stringify(salida.expediente.pac.causas));
});

test('RONDA-37 pieza 2g · ida y vuelta: el JSON exportado lleva las claves y, reimportado, no pide revisar', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importarTexto(archivo({ pac: '4', cantidad: 20000, valor: 100 }));
  await ir('fundamentacion');
  m.escribir('sgc-pac-justificacion', JUSTIFICACION_PAC);
  await ir('revision');
  await imprimir();
  const exportado = await exportarJson();
  assert.deepStrictEqual(exportado.expediente.pac.causas, ['monto'],
    'el exportado lleva las causas');

  // Se cierra y se vuelve a entrar: el exportado se reimporta.
  await entrarComoUsuario();
  await importarTexto(JSON.stringify(exportado), 'resmas.json');
  await ir('fundamentacion');

  const v = vista();
  assert.strictEqual(v.textarea.value, JUSTIFICACION_PAC,
    'el campo muestra la justificación que traía');
  assert.strictEqual(v.aviso.textContent, '', 'con las claves guardadas no pide revisar');
  assert.strictEqual(v.aviso.hidden, true, 'el aviso está oculto');
  assert.strictEqual(v.confirmar.hidden, true, 'ni botón de confirmar');

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => pasoVisible() === 'revision', 20000, 'y deja avanzar sin revisar nada');
});

test('RONDA-37 pieza 2h · control: el requerimiento de la aplicación con servidor sale idéntico a antes', () => {
  // El MISMO orden de carga del script que capturó el antes (baseline-r34.js):
  // compone el expediente del servidor tal cual y lo compara byte a byte contra
  // la foto tomada antes de tocar nada.
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
});

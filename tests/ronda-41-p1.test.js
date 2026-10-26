'use strict';

/*
 * ronda-41-p1.test.js
 * RONDA-41 · pieza 1 · "Los presupuestos vienen en la plantilla"
 * (ORDEN-RONDA-41 pieza 1).
 *
 * La plantilla del generador suma los presupuestos con proveedor, fecha, tipo
 * y el valor unitario de cada renglón. Al importarla, cada presupuesto entra
 * como documento "sin PDF" y sus valores quedan citados en el renglón. Hasta
 * que se elija el PDF de cada uno, Imprimir y Exportar frenan. La plantilla de
 * la aplicación con servidor no cambia ni un byte (ADR-044).
 *
 * Todos los casos entran por la pantalla del generador: bajar la plantilla,
 * elegir el archivo, escribir la identificación, elegir los PDF y apretar los
 * botones. Cuando se lee el JSON exportado, es el que se descargó por la
 * pantalla.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const CODIGO_MATAFUEGOS = '3.3.3-1627.36';
const LUGAR = 'Depósito de Intendencia, VII Brigada Aérea';
// Plantilla de la aplicación con servidor en r40-1ebf5ef: sin la marca del
// generador, tiene que salir exactamente igual.
const HUELLA_SERVIDOR =
  '427c0dcc1bfc1f7881e1944b1fa798674855bb3fe9c7ff4d96dedadd666fa8f3';

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

function renglonesDeEjemplo() {
  return [
    { codigo: CODIGO_PAPELERIA, buscar: 'resma papel A4', cantidad: 2, unidad: 'UN', aclaracion: '' },
    { codigo: CODIGO_MATAFUEGOS, buscar: 'matafuego', cantidad: 3, unidad: 'UN', aclaracion: '' }
  ];
}

function plantilla(opciones) {
  const o = opciones || {};
  const cuerpo = {
    formato: 'sgc-requerimiento/1',
    titulo: 'Insumos de papelería y matafuegos',
    anio: '2026',
    dependenciaSolicitante: 'División Usuario',
    justificacion: 'Se necesita reponer insumos.',
    objetivo: '',
    renglones: o.renglones || renglonesDeEjemplo()
  };
  if (o.presupuestos !== undefined) {
    cuerpo.presupuestos = o.presupuestos;
  }
  return JSON.stringify(cuerpo);
}

function dosPresupuestos(fecha) {
  return [
    {
      proveedor: 'Matafuegos Sur',
      fecha: fecha || '2026-02-12',
      tipo: 'presupuesto',
      valores: [{ renglon: 1, unitario: 1000 }, { renglon: 2, unitario: 2000 }]
    },
    {
      proveedor: 'Librería Norte',
      fecha: '2026-02-13',
      tipo: 'presupuesto',
      valores: [{ renglon: 1, unitario: 1100 }, { renglon: 2, unitario: 2100 }]
    }
  ];
}

async function importar(texto, nombre) {
  m.elegirArchivo(texto, nombre || 'plantilla.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el generador no contestó al archivo');
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
    d.getElementById(destino).click();
    await m.esperar(() => pasoVisible() !== actual, 10000,
      'el paso no se movió desde ' + actual);
  }
  throw new Error('no se llegó al paso ' + id);
}

function documentos() {
  return SGC().generadorPresupuestos.listar();
}

function valoresDeRenglones() {
  return SGC().generadorValores.renglonesConValores();
}

test('RONDA-41 pieza 1a-1 · la plantilla del generador trae presupuestos y la regla 6 nueva', async () => {
  await entrarComoUsuario();

  const descarga = await m.bajarPlantilla();
  const plantillaBajada = JSON.parse(await descarga.texto());

  assert.ok(Array.isArray(plantillaBajada.presupuestos),
    'la plantilla trae el arreglo de presupuestos: ' + JSON.stringify(plantillaBajada.presupuestos));
  assert.strictEqual(plantillaBajada.presupuestos.length, 1,
    'trae el presupuesto de ejemplo');
  const ejemplo = plantillaBajada.presupuestos[0];
  assert.strictEqual(ejemplo.proveedor, 'Librería Sur', 'con su proveedor');
  assert.strictEqual(ejemplo.fecha, '2026-02-12', 'con su fecha');
  assert.strictEqual(ejemplo.tipo, 'presupuesto', 'con su tipo');
  assert.deepStrictEqual(ejemplo.valores, [{ renglon: 1, unitario: 4500 }],
    'y el valor unitario del renglón');

  assert.match(plantillaBajada.instrucciones, /6\) presupuestos: uno por cada presupuesto u orden de compra adjunta/,
    'la regla 6 habla de los presupuestos: ' + plantillaBajada.instrucciones);
  assert.match(plantillaBajada.instrucciones, /"precio-plaza"/,
    'y dice los dos tipos posibles');
  assert.doesNotMatch(plantillaBajada.instrucciones,
    /Los precios y los presupuestos no van en este JSON/,
    'la regla vieja ya no está');
});

test('RONDA-41 pieza 1a-2 · la plantilla del servidor, sin la marca, sale igual byte a byte que en 1ebf5ef', async () => {
  const validacion = SGC().core.validacion;
  const marca = validacion.exigirIdentificacionCompleta();
  validacion.exigirIdentificacionCompleta(false);
  const texto = JSON.stringify(SGC().views.fasttrack.modelo(), null, 2);
  validacion.exigirIdentificacionCompleta(marca);

  assert.strictEqual(crypto.createHash('sha256').update(texto, 'utf8').digest('hex'),
    HUELLA_SERVIDOR, 'la plantilla del servidor no cambió');
  assert.strictEqual(texto.includes('"presupuestos"'), false,
    'sin la marca no viajan presupuestos');
  assert.match(texto, /Los precios y los presupuestos no van en este JSON/,
    'y la regla 6 sigue siendo la del servidor');
});

test('RONDA-41 pieza 1b-3 · dos presupuestos con los dos renglones: dos documentos "falta el PDF" y los cuatro valores en sus renglones', async () => {
  await entrarComoUsuario();

  const msj = await importar(plantilla({ presupuestos: dosPresupuestos() }));
  assert.match(msj, /Plantilla importada/, 'la plantilla entra: ' + msj);

  const docs = documentos();
  assert.strictEqual(docs.length, 2, 'entran los dos documentos de referencia');
  assert.ok(docs.every((p) => p.sinPdf === true), 'los dos quedan sin PDF');
  assert.ok(docs.every((p) => p.nombreOriginal === undefined),
    'sin nombre de archivo todavía');

  const lista = m.documento.getElementById('sgc-presup-lista').textContent;
  assert.match(lista, /Matafuegos Sur · 12\/02\/2026 · Presupuesto · falta el PDF/,
    'la lista nombra a Matafuegos Sur y que falta el PDF: ' + lista);
  assert.match(lista, /Librería Norte · 13\/02\/2026 · Presupuesto · falta el PDF/,
    'y a Librería Norte: ' + lista);

  const renglones = valoresDeRenglones();
  assert.strictEqual(renglones.length, 2, 'entran los dos renglones');
  const valores = renglones[0].valoresReferencia.concat(renglones[1].valoresReferencia);
  assert.strictEqual(valores.length, 4, 'los cuatro valores quedaron citados');
  assert.ok(valores.every((v) => v.base === 'unitario'),
    'todos con base unitario: ' + JSON.stringify(valores));
  assert.deepStrictEqual(renglones[0].valoresReferencia.map((v) => v.valor), [1000, 1100],
    'el renglón 1 cita los dos presupuestos');
  assert.deepStrictEqual(renglones[1].valoresReferencia.map((v) => v.valor), [2000, 2100],
    'el renglón 2 también');
});

test('RONDA-41 pieza 1d-4 · sin los PDF no imprime ni exporta, y el motivo nombra a los dos proveedores', async () => {
  await entrarComoUsuario();
  await importar(plantilla({ presupuestos: dosPresupuestos() }));
  await ir('revision');

  const boton = m.documento.getElementById('sgc-btn-exportar');
  const msj = m.documento.getElementById('sgc-exportar-msj');
  assert.strictEqual(boton.disabled, true, 'sin los PDF no exporta');
  assert.match(msj.textContent,
    /elegir el PDF de los documentos de referencia: Matafuegos Sur, Librería Norte/,
    'el motivo nombra a los dos proveedores: ' + msj.textContent);

  const marcado = m.documento.getElementById('sgc-pasos')
    .querySelector('[data-paso="renglones"]');
  assert.match(marcado.textContent, /falta/,
    '"2 · Renglones" queda en falta: ' + marcado.textContent);

  const antes = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  m.documento.getElementById('sgc-btn-imprimir').click();
  assert.strictEqual(SGC().generadorDocumentos.expedienteLocal().entregables.length, antes,
    'Imprimir no compone ningún documento');
});

test('RONDA-41 pieza 1c-5 · con el PDF de cada uno exporta, y cada documento viaja con nombre y huella', async () => {
  await entrarComoUsuario();
  await importar(plantilla({ presupuestos: dosPresupuestos() }));

  await ir('identificacion');
  m.elegirPac('1');
  m.elegirModalidad('comun');
  m.escribir('sgc-lugar-entrega', LUGAR);
  await ir('renglones');

  const docs = documentos();
  m.elegirPdfDe(docs[0].id, 'presupuesto-matafuegos.pdf', 'PDF de Matafuegos Sur');
  m.elegirPdfDe(docs[1].id, 'presupuesto-libreria.pdf', 'PDF de Librería Norte');
  await m.esperar(() => documentos().every((p) => typeof p.sha256 === 'string' &&
    p.sha256.length === 64), 20000, 'no se sellaron los dos PDF');

  await ir('revision');
  const antesEntregables = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  m.documento.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length >
    antesEntregables, 20000, 'los documentos se compusieron');

  const boton = m.documento.getElementById('sgc-btn-exportar');
  assert.strictEqual(boton.disabled, false, 'con los dos PDF exporta');

  const antes = m.descargas.length;
  boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el JSON no se descargó');
  const salida = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  const exportados = salida.expediente.presupuestos;
  assert.strictEqual(exportados.length, 2, 'viajan los dos documentos');
  for (const doc of exportados) {
    assert.ok(doc.nombreOriginal, 'cada uno trae su nombreOriginal: ' + JSON.stringify(doc));
    assert.match(doc.sha256, /^[0-9a-f]{64}$/, 'y su SHA-256: ' + JSON.stringify(doc));
    assert.notStrictEqual(doc.sinPdf, true, 'ya no dice "sin PDF"');
  }
  const valores = salida.expediente.renglones[0].valoresReferencia;
  assert.strictEqual(valores.length, 2, 'el renglón 1 cita los dos presupuestos');
  assert.ok(valores.every((v) => v.base === 'unitario'),
    'con base unitario: ' + JSON.stringify(valores));
  assert.ok(valores.some((v) => v.presupuestoId === exportados[0].id),
    'y cita el id de su presupuesto');
});

test('RONDA-41 pieza 1b-6 · la fecha 02/10/2026 sale 2026-10-02', async () => {
  await entrarComoUsuario();
  await importar(plantilla({
    presupuestos: [{
      proveedor: 'Matafuegos Sur',
      fecha: '02/10/2026',
      tipo: 'presupuesto',
      valores: [{ renglon: 1, unitario: 1000 }]
    }]
  }));

  const doc = documentos()[0];
  assert.strictEqual(doc.fecha, '2026-10-02',
    'la fecha se guarda en ISO: ' + doc.fecha);
  assert.match(m.documento.getElementById('sgc-presup-lista').textContent,
    /02\/10\/2026/, 'y en pantalla se lee como siempre');
});

test('RONDA-41 pieza 1c-7 · un avance con documentos sin PDF vuelve sin PDF y con sus valores', async () => {
  await entrarComoUsuario();
  await importar(plantilla({ presupuestos: dosPresupuestos() }));

  const antes = m.descargas.length;
  m.documento.getElementById('sgc-guardar-avance').click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el avance no se descargó');
  const avance = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.ok(avance.expediente.presupuestos.every((p) => p.sinPdf === true),
    'el avance lleva los documentos sin PDF');
  assert.strictEqual(avance.expediente.renglones[0].valoresReferencia.length, 2,
    'y sus valores');

  await entrarComoUsuario();
  const msj = await importar(JSON.stringify(avance), 'avance.json');
  assert.match(msj, /Avance importado/, 'el avance entra: ' + msj);

  const docs = documentos();
  assert.strictEqual(docs.length, 2, 'vuelven los dos documentos');
  assert.ok(docs.every((p) => p.sinPdf === true), 'los dos siguen sin PDF');
  const valores = valoresDeRenglones()[0].valoresReferencia;
  assert.strictEqual(valores.length, 2, 'y sus valores siguen citados');
});

test('RONDA-41 pieza 1b-8 · un renglón cotizado una sola vez: la plantilla entra y el renglón pide su segundo valor', async () => {
  await entrarComoUsuario();
  const msj = await importar(plantilla({
    presupuestos: [{
      proveedor: 'Librería Norte',
      fecha: '2026-02-13',
      tipo: 'presupuesto',
      valores: [{ renglon: 1, unitario: 1100 }]
    }]
  }));
  assert.match(msj, /Plantilla importada/, 'la plantilla entra con un solo valor: ' + msj);

  const texto = m.documento.getElementById('sgc-req-valores').textContent.replace(/\s+/g, ' ');
  assert.match(texto, /Renglón 1/, 'el aviso nombra el renglón: ' + texto);
  assert.match(texto, /2 de fuentes distintas/, 'y pide el segundo valor: ' + texto);
});

test('RONDA-41 pieza 1b-9 · el renglón 9 que no existe y el valor "$ 5.400": entra lo demás y el aviso los nombra', async () => {
  await entrarComoUsuario();
  const msj = await importar(plantilla({
    presupuestos: [
      {
        proveedor: 'Matafuegos Sur',
        fecha: '2026-02-12',
        tipo: 'presupuesto',
        valores: [{ renglon: 1, unitario: 1000 }, { renglon: 9, unitario: 2000 }]
      },
      {
        proveedor: 'Librería Norte',
        fecha: '2026-02-13',
        tipo: 'presupuesto',
        valores: [{ renglon: 1, unitario: '$ 5.400' }]
      }
    ]
  }));

  assert.match(msj, /Plantilla importada/, 'la plantilla entra: ' + msj);
  assert.match(msj, /Matafuegos Sur/, 'el aviso nombra a Matafuegos Sur: ' + msj);
  assert.match(msj, /renglón 9/, 'y el renglón que no existe: ' + msj);
  assert.match(msj, /2000/, 'con su valor: ' + msj);
  assert.match(msj, /Librería Norte/, 'el aviso nombra a Librería Norte: ' + msj);
  assert.match(msj, /\$ 5\.400/, 'y el valor que no es un número: ' + msj);

  const valores = valoresDeRenglones()[0].valoresReferencia;
  assert.strictEqual(valores.length, 1, 'entra el valor válido que quedaba');
  assert.strictEqual(valores[0].valor, 1000, 'y es el 1000 de Matafuegos Sur');
});

test('RONDA-41 pieza 1b-10 · una plantilla sin presupuestos entra como hoy', async () => {
  await entrarComoUsuario();
  const msj = await importar(plantilla());
  assert.match(msj, /Plantilla importada/, 'la plantilla vieja entra: ' + msj);

  assert.deepStrictEqual(documentos(), [], 'no aparece ningún documento de referencia');
  assert.deepStrictEqual(m.documento.getElementById('sgc-presup-lista').textContent, '',
    'y la lista queda vacía');
  assert.strictEqual(valoresDeRenglones()[0].valoresReferencia.length, 0,
    'sin valores citados');
});

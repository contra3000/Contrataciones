'use strict';

/*
 * ronda-42-p2.test.js
 * ORDEN-RONDA-42 · pieza 2 · "El consolidado en el núcleo, y el ANEXO I con
 * los renglones sumados" (7b y el ítem 36, ADR-043).
 *
 * El núcleo nuevo se compara contra el servidor, que es el oráculo de la regla.
 * La pantalla se prueba por el generador: se eligen los fixtures del Jefe en
 * #sgc-abast-archivos y se mira el consolidado y el ANEXO I impreso.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');
const sco = require('../server/sco.js');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

function fixture(nombre) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', nombre), 'utf8');
}

function datos(nombre) {
  return JSON.parse(fixture(nombre)).expediente;
}

async function entrarComoAbastecimiento() {
  await m.correr();
  m.completarIdentidad();
  m.setear('sgc-generador-nombre', 'Ana');
  m.elegirRol('abastecimiento');
  return m.documento.getElementById('sgc-abastecimiento');
}

function lista() {
  return m.documento.getElementById('sgc-abast-lista');
}

function msj() {
  return m.documento.getElementById('sgc-abast-msj');
}

function tabla() {
  return m.documento.getElementById('sgc-abast-consolidado');
}

function filasConsolidado() {
  return tabla().querySelector('tbody').children;
}

function celdas(fila) {
  return fila.children.map(function (td) { return td.textContent; });
}

function filaDe(codigo, unidad) {
  for (const fila of filasConsolidado()) {
    const valores = celdas(fila);
    if (valores[0] === codigo && (unidad === undefined || valores[3] === unidad)) {
      return valores;
    }
  }
  return null;
}

function filasDe(codigo) {
  const salida = [];
  for (const fila of filasConsolidado()) {
    const valores = celdas(fila);
    if (valores[0] === codigo) {
      salida.push(valores);
    }
  }
  return salida;
}

async function elegir(listaDeArchivos) {
  m.elegirRequerimientos(listaDeArchivos);
  await m.esperar(() => {
    const aviso = msj();
    return lista().children.length > 0 || (aviso && aviso.hidden === false);
  }, 20000, 'la pantalla no contestó a los archivos');
}

async function elegirLosDosArs() {
  await entrarComoAbastecimiento();
  await elegir([
    { nombre: 'r42-req-goe.json', contenido: fixture('r42-req-goe.json') },
    { nombre: 'r42-req-gb7.json', contenido: fixture('r42-req-gb7.json') }
  ]);
}

function escribirExpediente(datosDir, id, renglones) {
  const carpeta = path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, 'datos.json'),
    JSON.stringify({ datos: { renglones: renglones } }), 'utf8');
}

test('RONDA-42 pieza 2c-1 · consolidacion.renglones es la misma regla que server/sco.js, con la descripción del ítem', () => {
  const goe = datos('r42-req-goe.json');
  const gb7 = datos('r42-req-gb7.json');
  const datosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r42-consolidado-'));
  try {
    escribirExpediente(datosDir, '2026-0001', goe.renglones);
    escribirExpediente(datosDir, '2026-0002', gb7.renglones);

    const esperado = sco.renglonesConsolidados(datosDir, {
      expedientes: ['2026-0001', '2026-0002']
    });
    const obtenido = SGC().core.consolidacion.renglones([
      { etiqueta: 'GOE', renglones: goe.renglones },
      { etiqueta: 'Grupo Base 7', renglones: gb7.renglones }
    ]);

    assert.strictEqual(obtenido.length, esperado.length,
      'mismas filas que el servidor: ' + JSON.stringify(obtenido));
    const etiquetaDe = { '2026-0001': 'GOE', '2026-0002': 'Grupo Base 7' };
    for (let i = 0; i < esperado.length; i++) {
      const servidor = esperado[i];
      const nucleo = obtenido[i];
      assert.strictEqual(nucleo.codigo, servidor.codigo, 'mismo código y orden');
      assert.strictEqual(nucleo.unidad, servidor.unidad, 'misma unidad y orden');
      assert.strictEqual(nucleo.cantidad, servidor.cantidad, 'misma cantidad sumada');
      assert.deepStrictEqual(nucleo.desglose, servidor.desglose.map(function (d) {
        return { expediente: etiquetaDe[d.expediente], cantidad: d.cantidad };
      }), 'mismo desglose');
      assert.strictEqual(servidor.descripcion, '',
        'el servidor sigue guardando la descripción vacía: es lo que el núcleo corrige');
      const fuente = [...goe.renglones, ...gb7.renglones].find(function (r) {
        return r.codigo === nucleo.codigo && r.unidad === nucleo.unidad;
      });
      assert.strictEqual(nucleo.descripcion, fuente.item,
        'la descripción del núcleo es el ítem del renglón');
    }
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('RONDA-42 pieza 2c-2 · el 3.3.3 es un solo renglón con 15 y el desglose de las dos dependencias', async () => {
  await elegirLosDosArs();

  assert.strictEqual(tabla().hidden, false, 'el consolidado se muestra');
  const filas = filasDe('3.3.3-1627.36');
  assert.strictEqual(filas.length, 1, 'un solo renglón para el 3.3.3');
  assert.strictEqual(filas[0][2], '15', 'la cantidad sumada es 15');
  assert.strictEqual(filas[0][3], 'UN', 'con su unidad');
  assert.strictEqual(filas[0][4], 'GOE: 10 · Grupo Base 7: 5', 'y el desglose de cada una');
  assert.ok(filas[0][1] && filas[0][1].indexOf('MANT. Y REPAR. MATAFUEGO') !== -1,
    'la descripción no está vacía: ' + filas[0][1]);
});

test('RONDA-42 pieza 2c-3 · el 2.3.1 va en dos renglones, UN 5 y CAJA 3, con el aviso de unidades', async () => {
  await elegirLosDosArs();

  const filas = filasDe('2.3.1-6563.129');
  assert.strictEqual(filas.length, 2, 'dos renglones por unidad: ' + JSON.stringify(filas));
  const porUnidad = {};
  filas.forEach(function (f) { porUnidad[f[3]] = f[2]; });
  assert.strictEqual(porUnidad.UN, '5', 'UN 5');
  assert.strictEqual(porUnidad.CAJA, '3', 'CAJA 3');

  const aviso = m.documento.getElementById('sgc-abast-unidades');
  assert.strictEqual(aviso.hidden, false, 'el aviso de unidades se ve');
  assert.strictEqual(aviso.textContent,
    'el 2.3.1-6563.129 viene en UN y en CAJA: van en renglones separados',
    'con el texto exacto de la orden');
});

test('RONDA-42 pieza 2c-4 · sumar un requerimiento en USD esconde el consolidado, avisa e inhabilita Imprimir', async () => {
  await elegirLosDosArs();
  m.elegirRequerimientos([{ nombre: 'r42-req-usd.json', contenido: fixture('r42-req-usd.json') }]);
  await m.esperar(() => lista().children.length === 3 && msj().hidden === false,
    20000, 'la pantalla no contestó al requerimiento en USD');

  assert.strictEqual(tabla().hidden, true, 'el consolidado se va');
  assert.strictEqual(msj().hidden, false, 'el aviso de monedas se ve');
  assert.match(msj().textContent,
    /No se juntan requerimientos en pesos y en dólares en una misma SCo/,
    'con el texto de la orden: ' + msj().textContent);
  assert.match(msj().textContent, /En ARS: Matafuegos y papel GOE · Matafuegos Grupo Base 7\./,
    'nombra los que están en pesos: ' + msj().textContent);
  assert.match(msj().textContent, /En USD: Herramientas en dólares\./,
    'y los que están en dólares: ' + msj().textContent);
  assert.strictEqual(m.documento.getElementById('sgc-abast-imprimir').disabled, true,
    'Imprimir queda deshabilitado');

  lista().children[2].querySelector('[data-quitar-req]').click();

  assert.strictEqual(tabla().hidden, false, 'quitado el de USD, el consolidado vuelve');
  assert.strictEqual(msj().hidden, true, 'y el aviso de monedas se va');
  assert.strictEqual(m.documento.getElementById('sgc-abast-imprimir').disabled, false,
    'Imprimir se habilita');
  assert.strictEqual(filaDe('3.3.3-1627.36')[2], '15', 'y la suma sigue');
});

test('RONDA-42 pieza 2c-5 · "Imprimir ANEXO I" trae el ANEXO 1, la SCo a asignar y el renglón con 15 y su desglose', async () => {
  await elegirLosDosArs();

  const boton = m.documento.getElementById('sgc-abast-imprimir');
  assert.strictEqual(boton.disabled, false, 'con requerimientos, Imprimir está habilitado');
  boton.click();

  const texto = m.documento.getElementById('sgc-generador-impresion').textContent;
  assert.ok(texto.indexOf('ANEXO 1') !== -1, 'dice ANEXO 1: ' + texto);
  assert.ok(texto.indexOf('SCo: a asignar') !== -1, 'dice la SCo a asignar');
  assert.ok(texto.indexOf('3.3.3-1627.36') !== -1, 'trae el renglón');
  assert.ok(texto.indexOf('15') !== -1, 'con la cantidad sumada');
  assert.ok(texto.indexOf('GOE: 10 · Grupo Base 7: 5') !== -1, 'y su desglose');
  assert.ok(texto.indexOf('undefined') === -1, 'sin undefined: ' + texto);
});

test('RONDA-42 pieza 2c-5b · el ANEXO 1 no dice undefined ni en el generador ni con un expediente del servidor', async () => {
  await elegirLosDosArs();
  m.documento.getElementById('sgc-abast-imprimir').click();

  const delGenerador = m.documento.getElementById('sgc-generador-impresion').textContent;
  assert.ok(delGenerador.indexOf(
    'Unidad solicitante: GOE · Grupo Base 7 — Expediente Nº SCo a asignar') !== -1,
  'el encabezado del generador trae la unidad y el número: ' + delGenerador);
  assert.ok(delGenerador.indexOf('undefined') === -1,
    'el del generador no dice undefined: ' + delGenerador);

  const contenedor = m.documento.createElement('div');
  SGC().renders.anexoUno.montar(contenedor, {
    expedienteId: '2026-0001',
    datos: {
      numero: '12/2026',
      titulo: 'Análisis de Abastecimiento',
      identificacion: { unidadSolicitante: 'GOE', numero: '12/2026' },
      anexo1: { objeto: 'Compra de insumos' },
      renglones: []
    }
  });
  const delServidor = contenedor.textContent;
  assert.ok(delServidor.indexOf('Unidad solicitante: GOE — Expediente Nº 12/2026') !== -1,
    'el encabezado del servidor trae la unidad y el número: ' + delServidor);
  assert.ok(delServidor.indexOf('Expediente 2026-0001') !== -1,
    'el pie trae el id del expediente: ' + delServidor);
  assert.ok(delServidor.indexOf('undefined') === -1,
    'el del servidor tampoco dice undefined: ' + delServidor);
});

test('RONDA-42 pieza 2c-6 · quitar el requerimiento del Grupo Base 7 deja el 3.3.3 con 10', async () => {
  await elegirLosDosArs();
  assert.strictEqual(filaDe('3.3.3-1627.36')[2], '15', 'antes de quitar, suma 15');

  lista().children[1].querySelector('[data-quitar-req]').click();

  assert.strictEqual(filaDe('3.3.3-1627.36')[2], '10', 'después de quitar, queda 10');
  assert.strictEqual(filaDe('3.3.3-1627.36')[4], 'GOE: 10', 'con el desglose del que queda');
});

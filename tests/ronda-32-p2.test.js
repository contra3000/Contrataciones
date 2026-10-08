'use strict';

/*
 * ronda-32-p2.test.js
 * RONDA-32 · pieza 2 · "Una plantilla que sirva para llenarla con un asistente
 * de IA" (ORDEN-RONDA-32 pieza 2).
 *
 * La pregunta del Jefe: importó un JSON que armó con un LLM y los renglones
 * salieron sin la descripción. La causa era el defecto de la pieza 1 (el item
 * del archivo mandaba, y se arregló). Esta pieza agrega lo que ayuda a que un
 * asistente la llene bien, por la pantalla:
 *
 *  - la plantilla baja con "instrucciones" (un texto para el asistente) y DOS
 *    renglones: un modelo creíble de papelería con un código real del catálogo
 *    vigente (98201747) y un renglón con el código vacío, que muestra cómo se
 *    deja el código que no se sabe;
 *  - importada con el código del segundo completado, entra sin errores;
 *  - con el segundo vacío, sale "Renglón 2: falta el código del catálogo" y no
 *    se carga nada;
 *  - importar() ignora "instrucciones" explícitamente.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

// Un renglón real de papelería del catálogo vigente (98201747), el mismo que
// el renglón modelo de modelo().
const CODIGO_PAPELERIA = '2.3.1-6563.129';

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

async function bajar() {
  const descarga = await m.bajarPlantilla();
  return JSON.parse(await descarga.texto());
}

async function importar(objeto) {
  // importarModelo (wizard.js) pone el mensaje en hidden apenas arranca, y
  // leerArchivo importa en cadena de promesas: el flip hidden true -> false
  // es la señal de que la importación (éxito o error) terminó.
  m.elegirArchivo(JSON.stringify(objeto), 'plantilla.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó a la plantilla');
  return m.msjArchivo().textContent;
}

function renglonesComparables() {
  return SGC().catalogo.renglones.obtener().map(function (r) {
    return { codigo: r.codigo, item: r.item, cantidad: r.cantidad, unidad: r.unidad, aclaracion: r.aclaracion };
  });
}

test('RONDA-32 pieza 2 · la plantilla baja con "instrucciones" y dos renglones', async () => {
  await entrarComoUsuario();

  const plantilla = await bajar();

  // Las instrucciones: el texto que se le pega al asistente junto con la
  // plantilla. Largo, aquí se exige que diga lo esencial.
  assert.strictEqual(typeof plantilla.instrucciones, 'string',
    'la plantilla trae el campo instrucciones');
  assert.ok(plantilla.instrucciones.length > 100,
    'las instrucciones tienen que decirle al asistente qué hacer, no ser un saludo');
  assert.ok(/no inventes códigos/i.test(plantilla.instrucciones),
    'le dice que no invente códigos de catálogo');
  assert.ok(/la pone .*el catálogo ONC/i.test(plantilla.instrucciones),
    'le dice que no escriba la descripción del ítem');
  assert.ok(/aclaración/.test(plantilla.instrucciones) && /256/.test(plantilla.instrucciones),
    'le dice el tope de la aclaración y que no repita ni nombre marcas');
  assert.ok(/cantidad es un número/.test(plantilla.instrucciones),
    'le dice que la cantidad es un número');
  assert.ok(/la misma forma/.test(plantilla.instrucciones),
    'le pide que devuelva sólo el JSON, con la misma forma');

  // Dos renglones: un modelo de papelería con un código real y uno vacío.
  assert.ok(Array.isArray(plantilla.renglones) && plantilla.renglones.length === 2,
    'la plantilla trae dos renglones: ' + JSON.stringify(plantilla.renglones));
  assert.strictEqual(plantilla.renglones[0].codigo, CODIGO_PAPELERIA,
    'el modelo es de papelería, con un código real del catálogo vigente');
  assert.strictEqual(plantilla.renglones[1].codigo, '',
    'el segundo renglón muestra cómo se deja el código que no se sabe');

  assert.deepStrictEqual(m.red.llamadas, [],
    'bajar la plantilla no pide nada por red: ' + m.red.llamadas.join(', '));
});

test('RONDA-32 pieza 2 · con el código del segundo completado, entra sin errores', async () => {
  await entrarComoUsuario();

  const plantilla = await bajar();
  plantilla.renglones[1].codigo = plantilla.renglones[0].codigo;

  const msj = await importar(plantilla);
  assert.match(msj, /Plantilla importada/, 'contesta que la importó: ' + msj);
  assert.ok(!/No se pudo importar/.test(msj), 'una plantilla con los códigos no se rechaza');

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, 2, 'entran los dos renglones');
  assert.ok(renglones.every(function (r) { return r.item && r.item !== r.codigo; }),
    'ambos salen con la descripción ONC del catálogo, no con el código: ' +
      JSON.stringify(renglones.map(function (r) { return r.codigo + ' → ' + r.item; })));
});

test('RONDA-32 pieza 2 · con el segundo vacío, sale el mensaje del renglón 2 y no se carga nada', async () => {
  await entrarComoUsuario();

  const plantilla = await bajar();
  assert.strictEqual(plantilla.renglones[1].codigo, '',
    'el renglón 2 baja con el código vacío');

  const msj = await importar(plantilla);
  assert.match(msj, /Renglón 2: falta el código del catálogo/,
    'el mensaje nombra el renglón 2 y qué le falta: ' + msj);
  assert.strictEqual(SGC().catalogo.renglones.obtener().length, 0,
    'un renglón sin código no carga nada');
});

test('RONDA-32 pieza 2 · importar() ignora "instrucciones" explícitamente', async () => {
  await entrarComoUsuario();

  const plantilla = await bajar();
  assert.ok(plantilla.instrucciones, 'la plantilla trae instrucciones');
  plantilla.renglones[1].codigo = plantilla.renglones[0].codigo;

  const conInstrucciones = JSON.parse(JSON.stringify(plantilla));
  const msjCon = await importar(conInstrucciones);
  assert.match(msjCon, /Plantilla importada/,
    'la plantilla CON instrucciones entra sin problemas: ' + msjCon);
  assert.ok(!/instrucciones/.test(msjCon),
    'y el campo instrucciones no genera ningún aviso: ' + msjCon);
  const con = renglonesComparables();
  assert.strictEqual(con.length, 2, 'quedan los dos renglones');

  // La misma plantilla sin el campo da exactamente lo mismo: ese campo no se
  // importa, no cambia nada de lo que entra.
  const sinInstrucciones = JSON.parse(JSON.stringify(plantilla));
  delete sinInstrucciones.instrucciones;
  const msjSin = await importar(sinInstrucciones);
  assert.match(msjSin, /Plantilla importada/, 'sin instrucciones también entra: ' + msjSin);
  assert.deepStrictEqual(renglonesComparables(), con,
    'el campo instrucciones no cambia lo importado');
});
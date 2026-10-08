'use strict';

/*
 * ronda-32-p1.test.js
 * RONDA-32 · pieza 1 · "El arreglo h1, y la versión en el paquete"
 * (ORDEN-RONDA-32 pieza 1).
 *
 * El parche h1 lo aplicó `git apply ordenes/PARCHE-H1-plantilla-y-rojo.patch`
 * y entra exacto; acá se prueba lo que el parche arregla, por la pantalla:
 *
 *  - a) bajar la plantilla vacía e importarla sin tocarla: la descripción del
 *    renglón es la del catálogo (ONC), no el código; y lo mismo con un "item"
 *    inventado en la plantilla: manda el catálogo, y sin aviso.
 *  - b) el campo con error se ve en rojo. Node no tiene layout, así que el
 *    "getComputedStyle" del Jefe (rgb(179, 38, 30)) no se puede calcular acá:
 *    se afirma lo mismo del archivo fuente — tokens.css define el rojo en
 *    --color-error (pedido del Jefe, h1) y campo-con-error lo usa.
 *  - c) el paso pendiente dice "· falta" con espacio: el <li> lee
 *    "2 · Renglones · falta" y no "2 · Renglones· falta" (pieza 1b).
 *
 * La otra mitad de la pieza 1 (la versión del paquete, r32-…, VERSION.txt y el
 * LEEME) se prueba en ronda-28-c5.test.js, que ya arma el paquete en un
 * temporal con la herramienta real.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');

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
  const modelo = await SGC().catalogo.carga.resolverCodigo('2.9.6-1115.1');
  assert.ok(modelo, 'el catálogo de la prueba tiene el ítem de la plantilla');
}

async function importarPlantilla(contenido) {
  m.elegirArchivo(contenido, 'plantilla.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el asistente no contestó a la plantilla');
  return m.msjArchivo().textContent;
}

test('RONDA-32 pieza 1a · la plantilla importada deja la descripción del ítem al catálogo', async () => {
  await entrarComoUsuario();

  // La plantilla se baja y se vuelve a subir SIN tocarla: la descripción del
  // renglón tiene que ser la del catálogo, nunca el código.
  const descarga = await m.bajarPlantilla();
  const plantilla = JSON.parse(await descarga.texto());
  const codigo = plantilla.renglones[0].codigo;
  assert.strictEqual(typeof codigo, 'string', 'el renglón modelo trae su código');

  const msj = await importarPlantilla(JSON.stringify(plantilla));
  assert.match(msj, /Plantilla importada/i, 'el asistente contesta que la importó: ' + msj);

  const renglones = SGC().catalogo.renglones.obtener();
  assert.strictEqual(renglones.length, plantilla.renglones.length,
    'los renglones de la plantilla quedan en el formulario');
  const item = renglones[0].item;
  assert.ok(item && item !== codigo && item.length > 10,
    'la descripción del renglón es la del catálogo, no el código: ' + item);
  assert.ok(!/Queda la del archivo/.test(msj) && !/el archivo dice/.test(msj),
    'importar la plantilla sin item no avisa nada: ' + msj);

  // Con un "item" inventado en la plantilla (lo que un asistente podría elucubrar):
  // manda el catálogo igual, y sin aviso.
  const inventada = JSON.parse(JSON.stringify(plantilla));
  inventada.renglones[0].item = 'texto inventado por un asistente';
  const msj2 = await importarPlantilla(JSON.stringify(inventada));
  assert.match(msj2, /Plantilla importada/i, 'una plantilla con item inventado también entra: ' + msj2);
  const renglones2 = SGC().catalogo.renglones.obtener();
  assert.notStrictEqual(renglones2[0].item, 'texto inventado por un asistente',
    'no queda lo inventado: ' + renglones2[0].item);
  assert.strictEqual(renglones2[0].item, item,
    'la descripción que manda es la del catálogo (la misma de la plantilla sin tocar)');
  assert.ok(!/Queda la del archivo/.test(msj2) && !/el archivo dice/.test(msj2),
    'y tampoco avisa que manda el catálogo: ' + msj2);
});

test('RONDA-32 pieza 1a h1 · el error se ve en rojo (--color-error #b3261e)', () => {
  const tokens = fs.readFileSync(path.join(RAIZ, 'app', 'css', 'tokens.css'), 'utf8');
  assert.ok(/--color-error:\s*#b3261e/.test(tokens),
    'tokens.css define el rojo del error en --color-error (pedido del Jefe, arreglo h1): ' +
      tokens.split('\n').filter((l) => /color-error/.test(l)).join(' | '));
  assert.ok(!/--color-error:\s*var\(--ink-900\)/.test(tokens),
    'el error ya no es casi negro: ' +
      tokens.split('\n').filter((l) => /color-error/.test(l)).join(' | '));

  const main = fs.readFileSync(path.join(RAIZ, 'app', 'css', 'main.css'), 'utf8');
  const regla = /\.campo-con-error[^}]*}/.exec(main);
  assert.ok(regla, 'main.css tiene la regla .campo-con-error');
  assert.ok(/border-color:\s*var\(--color-error\)/.test(regla[0]),
    'el campo marcado usa --color-error para el borde');
});

test('RONDA-32 pieza 1b · el paso pendiente dice "· falta" con espacio', async () => {
  await entrarComoUsuario();

  // El mismo paseo de la pieza 2 de la ronda 31: dos renglones sin valores y
  // "Siguiente"; en la barra, el paso "2 · Renglones" queda marcado.
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  m.documento.getElementById('sgc-siguiente').click();
  await m.esperar(() => !m.documento.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');

  const clases = SGC().catalogo.carga.obtenerEstado()
    .clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 2, 'el catálogo real tiene al menos dos clases con ítems');
  for (let indice = 0; indice < 2; indice++) {
    m.escribir('sgc-campo-clases', clases[indice][2]);
    await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
      'opción de la clase renderizada');
    m.mousedown('sgc-opcion-clase-0');
    await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
      'ítems de la clase cargados');
    m.mousedown('sgc-opcion-item-0');
    await m.esperar(() => m.documento.getElementById('sgc-lista-renglones').children.length === indice + 1,
      20000, 'renglón ' + (indice + 1) + ' agregado');
    const fila = m.documento.getElementById('sgc-lista-renglones').children[indice];
    m.escribirEnNodo(fila.querySelector('[aria-label="Unidad de medida"]'), 'UN');
  }

  m.documento.getElementById('sgc-siguiente').click();
  await m.esperar(() => !m.documento.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');

  const nav = m.documento.getElementById('sgc-pasos');
  let liRenglones = null;
  for (const hijo of nav.children) {
    if (hijo.getAttribute('data-paso') === 'renglones') {
      liRenglones = hijo;
    }
  }
  assert.ok(liRenglones, 'existe el paso "2 · Renglones"');
  const comoSeLee = liRenglones.textContent.replace(/\s+/g, ' ').trim();
  assert.match(comoSeLee, /Renglones · falta/,
    'el paso lee "2 · Renglones · falta" y no pegado: "' + comoSeLee + '"');
});
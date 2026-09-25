'use strict';

/*
 * ronda-24-c1.test.js
 * ORDEN-RONDA-24 §1 · botones y entradas que no se veían.
 *
 * 1) Quien no puede originar aterriza en el tablero; quien puede, en el alta.
 * 2) Ninguna regla posterior a `button.primario` cambia el `background-color`
 *    de los botones sin excluir `.primario`: la familia que pisaba el fondo de
 *    los primarios queda cerrada en `main.css`.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const am = require('./helpers/aplicacion-montura.js');
const { importarPadron, cambiarSesion } = require('./helpers/circuito-ronda-21.js');

test('R24-1: el supervisor aterriza en el tablero y el generador en el alta', async function () {
  const m = await am.arrancar({ prefix: 'rp24c1-' });
  try {
    const d = m.documento;
    await m.prepararAdmin();
    const padron = await importarPadron(m);

    await cambiarSesion(m, 'supervisor-contrataciones.c21@test.local',
      padron.clavesDe['supervisor-contrataciones.c21@test.local']);
    assert.strictEqual(d.getElementById('sgc-kanban').hidden, false,
      'R24-1: el supervisor cae en #sgc-kanban');
    assert.strictEqual(d.getElementById('sgc-app').hidden, true,
      'R24-1: el supervisor no ve el alta');
    assert.strictEqual(d.getElementById('sgc-nav-alta').hidden, true,
      'R24-1: el supervisor no ve la navegación de alta');

    await cambiarSesion(m, 'generador.c21@test.local',
      padron.clavesDe['generador.c21@test.local']);
    assert.strictEqual(d.getElementById('sgc-app').hidden, false,
      'R24-1: el generador queda en el alta');
    assert.strictEqual(d.getElementById('sgc-kanban').hidden, true,
      'R24-1: el generador no cae en el tablero');
    assert.strictEqual(d.getElementById('sgc-nav-alta').hidden, false,
      'R24-1: el generador ve la navegación de alta');
  } finally {
    await m.cerrar();
  }
});

test('R24-1: ninguna regla posterior a button.primario pinta botones sin excluir .primario', function () {
  const css = fs.readFileSync(path.join(am.APP_DIR, 'css', 'main.css'), 'utf8');
  const reglas = parsearReglas(css);
  const indicePrimario = reglas.findIndex((r) => r.selector === 'button.primario');
  assert.notStrictEqual(indicePrimario, -1,
    'R24-1: existe la regla `button.primario` en main.css');
  const posteriores = reglas.slice(indicePrimario + 1);
  const infractoras = posteriores.filter((r) =>
    tocaBotones(r.selector) && !excluyePrimario(r.selector) &&
    /\bbackground-color\s*:/.test(r.cuerpo));
  assert.deepStrictEqual(infractoras, [],
    'R24-1: ninguna regla posterior a button.primario cambia el fondo de botones sin excluir .primario');
});

function parsearReglas(css) {
  const reglas = [];
  (function recorrer(desde, hasta) {
    let i = desde;
    while (i < hasta) {
      const inicioLlave = css.indexOf('{', i);
      if (inicioLlave === -1 || inicioLlave >= hasta) {
        return;
      }
      const selector = css.slice(i, inicioLlave).trim();
      let prof = 1;
      let j = inicioLlave + 1;
      while (j < hasta && prof > 0) {
        if (css[j] === '{') {
          prof++;
        } else if (css[j] === '}') {
          prof--;
        }
        j++;
      }
      if (selector.charAt(0) === '@') {
        recorrer(inicioLlave + 1, j - 1);
      } else {
        reglas.push({ selector, cuerpo: css.slice(inicioLlave + 1, j - 1) });
      }
      i = j;
    }
  }(0, css.length));
  return reglas;
}

function tocaBotones(selector) {
  // `button` como selector de tipo (precedido por inicio o un combinator,
  // seguido por un separador o un pseudo/atributo), no dentro de un nombre.
  return /(^|[\s>+~,(])button(?=$|[\s>+~:.#[(])/.test(selector);
}

function excluyePrimario(selector) {
  return selector.indexOf('.primario') !== -1;
}
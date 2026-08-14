'use strict';

/*
 * check-compat.test.js
 * Suite adversaria del guardián (ORDEN-RONDA-02 §2.1).
 *
 * Para cada ítem de la lista de veto genera un archivo temporal con esa
 * violación, corre tools/check-compat.js contra él y verifica que la detecta.
 * También verifica los falsos positivos: una violación escrita dentro de un
 * comentario o de un literal de cadena NO debe reportarse — salvo las URLs
 * absolutas, que se reportan SIEMPRE, también dentro de un literal de cadena
 * (ORDEN-RONDA-03 §2.1).
 *
 * Cada caso usa un directorio temporal propio, creado y eliminado dentro de
 * la suite, con archivos de menos de 50 líneas y un límite de tiempo explícito
 * de 5 segundos por ejecución.
 */

const test = require('node:test');
const before = require('node:test').before;
const after = require('node:test').after;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const GUARDIAN = path.join(RAIZ, 'tools', 'check-compat.js');
const NODE = process.execPath;
const TIMEOUT_MS = 5000;
const MAX_LINEAS = 50;

let raizTmp;
before(() => {
  raizTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-checkcompat-'));
});
after(() => {
  fs.rmSync(raizTmp, { recursive: true, force: true });
});

function crearCaso(nombre, archivos) {
  const dir = path.join(raizTmp, nombre);
  fs.mkdirSync(dir, { recursive: true });
  for (const rel of Object.keys(archivos)) {
    const contenido = archivos[rel];
    assert.ok(contenido.split('\n').length <= MAX_LINEAS,
      nombre + ': el archivo debe tener menos de ' + MAX_LINEAS + ' líneas');
    const ruta = path.join(dir, rel);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, contenido, 'utf8');
  }
  return dir;
}

function correrGuardián(dir) {
  const inicio = process.hrtime.bigint();
  let resultado;
  try {
    execFileSync(NODE, [GUARDIAN, dir], { timeout: TIMEOUT_MS, stdio: 'pipe' });
    resultado = { salida: 0, salidaTexto: '' };
  } catch (e) {
    const sinEstado = e.status === undefined || e.status === null;
    if (sinEstado && e.signal) {
      resultado = { salida: 'timeout', salidaTexto: 'sin respuesta (señal ' + e.signal + ')' };
    } else if (sinEstado) {
      resultado = { salida: 'error', salidaTexto: String(e.message) };
    } else {
      resultado = {
        salida: e.status,
        salidaTexto: String(e.stderr || e.stdout || e.message || '')
      };
    }
  }
  const ms = Number((process.hrtime.bigint() - inicio) / BigInt(1000000));
  return { salida: resultado.salida, salidaTexto: resultado.salidaTexto, ms: ms };
}

function comprobarLimiteTiempo(r) {
  assert.notEqual(r.salida, 'timeout', 'el guardián no respondió a tiempo: ' + r.salidaTexto);
  assert.ok(r.ms < TIMEOUT_MS,
    'el guardián tardó ' + r.ms + ' ms sobre un archivo pequeño; límite ' + TIMEOUT_MS + ' ms');
}

// ---------------------------------------------------------------------------
// Casos positivos: la violación debe detectarse (exit 1 con el motivo).
// ---------------------------------------------------------------------------
const CASOS_POSITIVOS = [
  {
    nombre: 'js-array-toSorted',
    fragmento: /toSorted/,
    archivos: { 'a.js': 'const ordenado = lista.toSorted();\n' }
  },
  {
    nombre: 'js-array-toSpliced',
    fragmento: /toSpliced/,
    archivos: { 'a.js': 'const recortado = lista.toSpliced(1, 1);\n' }
  },
  {
    nombre: 'js-array-with',
    fragmento: /Array\.prototype\.with/,
    archivos: { 'a.js': 'const nuevo = lista.with(0, 9);\n' }
  },
  {
    nombre: 'js-object-groupBy',
    fragmento: /Object\.groupBy/,
    archivos: { 'a.js': 'const m = Object.groupBy(items, (i) => i.tipo);\n' }
  },
  {
    nombre: 'js-map-groupBy',
    fragmento: /Map\.groupBy/,
    archivos: { 'a.js': 'const m = Map.groupBy(items, (i) => i.tipo);\n' }
  },
  {
    nombre: 'js-promise-withResolvers',
    fragmento: /Promise\.withResolvers/,
    archivos: { 'a.js': 'const { promise, resolve } = Promise.withResolvers();\n' }
  },
  {
    nombre: 'js-import',
    fragmento: /import \(módulos/,
    archivos: { 'a.js': "import { sumar } from 'utilidades';\n" }
  },
  {
    nombre: 'js-export',
    fragmento: /export \(módulos/,
    archivos: { 'a.js': 'export const total = 42;\n' }
  },
  {
    nombre: 'js-regex-flag-v',
    fragmento: /flag "v"/,
    archivos: { 'a.js': 'const re = /[a-z]+/v;\n' }
  },
  {
    nombre: 'css-anidamiento',
    fragmento: /anidamiento CSS/,
    archivos: { 'a.css': '.tarjeta {\n  &:hover {\n    color: red;\n  }\n}\n' }
  },
  {
    nombre: 'css-text-wrap-balance',
    fragmento: /text-wrap/,
    archivos: { 'a.css': 'p {\n  text-wrap: balance;\n}\n' }
  },
  {
    nombre: 'css-user-valid',
    fragmento: /:user-valid/,
    archivos: { 'a.css': 'input:user-valid {\n  border-color: green;\n}\n' }
  },
  {
    nombre: 'css-user-invalid',
    fragmento: /:user-invalid/,
    archivos: { 'a.css': 'input:user-invalid {\n  border-color: red;\n}\n' }
  },
  {
    nombre: 'css-url-https',
    fragmento: /URL absoluta/,
    archivos: { 'a.css': '@import url(https://hoja.externa.example/estilos.css);\n' }
  },
  {
    nombre: 'css-url-http',
    fragmento: /URL absoluta/,
    archivos: { 'a.css': 'div {\n  background: url(http://intranet.ejemplo.example/img.png);\n}\n' }
  },
  {
    nombre: 'html-popover',
    fragmento: /popover/,
    archivos: { 'a.html': '<button id="ayuda" popover>Ayuda</button>\n' }
  },
  {
    nombre: 'html-type-module',
    fragmento: /type="module"/,
    archivos: {
      'a.html': '<!DOCTYPE html>\n<html>\n<head>\n<script type="module">\nconsole.log("hola");\n</script>\n</head>\n</html>\n'
    }
  },
  {
    nombre: 'html-script-import-export',
    fragmento: /export \(módulos/,
    archivos: { 'a.html': "<script>\nimport { a } from 'b';\nexport { a };\n</script>\n" }
  },
  {
    nombre: 'css-url-con-comillas',
    fragmento: /URL absoluta/,
    archivos: { 'a.css': 'body {\n  background: url("https://cdn.ejemplo.example/fondo.png");\n}\n' }
  },
  {
    nombre: 'js-string-fetch-url',
    fragmento: /URL absoluta/,
    archivos: { 'a.js': "fetch('https://api.ejemplo.example/datos');\n" }
  },
  {
    nombre: 'js-string-url',
    fragmento: /URL absoluta/,
    archivos: { 'a.js': 'var base = "https://servidor.ejemplo.example";\n' }
  },
  {
    nombre: 'js-template-string-url',
    fragmento: /URL absoluta/,
    archivos: { 'a.js': 'var u = `https://plantilla.ejemplo.example/x`;\n' }
  },
  {
    nombre: 'html-string-url',
    fragmento: /URL absoluta/,
    archivos: { 'a.html': '<img src="https://cdn.ejemplo.example/logo.png" alt="logo">\n' }
  }
];

// ---------------------------------------------------------------------------
// Casos negativos: una violación dentro de un comentario o de un literal de
// cadena NO debe reportarse (exit 0).
// ---------------------------------------------------------------------------
const CASOS_NEGATIVOS = [
  {
    nombre: 'js-comentario-toSorted',
    archivos: { 'a.js': '// .toSorted() existe desde Chrome 110\nconst ok = true;\n' }
  },
  {
    nombre: 'js-comentario-bloque-groupBy',
    archivos: { 'a.js': '/* Object.groupBy es de Chrome 117 */\nconst ok = true;\n' }
  },
  {
    nombre: 'js-string-toSorted',
    archivos: { 'a.js': 'var nota = "a.toSorted() no se usa";\n' }
  },
  {
    nombre: 'js-comentario-url',
    archivos: { 'a.js': '// ver https://documentacion.ejemplo.example/guia\n' }
  },
  {
    nombre: 'js-comentario-import-export',
    archivos: { 'a.js': '// importar y exportar no aplican en este archivo\n' }
  },
  {
    nombre: 'js-string-import',
    archivos: { 'a.js': 'var texto = "import modulo";\n' }
  },
  {
    nombre: 'js-string-flag-v',
    archivos: { 'a.js': 'var re = "/[a-z]+/v";\n' }
  },
  {
    nombre: 'css-comentario-text-wrap',
    archivos: { 'a.css': '/* text-wrap: balance no se usa */\nbody { color: black; }\n' }
  },
  {
    nombre: 'css-comentario-url',
    archivos: { 'a.css': '/* fuente: https://ejemplo.example */\n' }
  },
  {
    nombre: 'html-comentario-popover',
    archivos: { 'a.html': '<!-- atributo popover disponible -->\n<div>hola</div>\n' }
  },
  {
    nombre: 'html-string-popover',
    archivos: { 'a.html': '<div data-ejemplo="popover">hola</div>\n' }
  }
];

for (const caso of CASOS_POSITIVOS) {
  test(caso.nombre + ' (se detecta)', () => {
    const dir = crearCaso(caso.nombre, caso.archivos);
    const r = correrGuardián(dir);
    comprobarLimiteTiempo(r);
    assert.equal(r.salida, 1, 'debe fallar con exit 1. Salida: ' + r.salidaTexto);
    assert.match(r.salidaTexto, caso.fragmento,
      'el motivo debe aparecer en la salida');
  });
}

for (const caso of CASOS_NEGATIVOS) {
  test(caso.nombre + ' (no se reporta)', () => {
    const dir = crearCaso(caso.nombre, caso.archivos);
    const r = correrGuardián(dir);
    comprobarLimiteTiempo(r);
    assert.equal(r.salida, 0, 'no debe reportar nada. Salida: ' + r.salidaTexto);
  });
}

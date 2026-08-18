#!/usr/bin/env node
/*
 * check-compat.js
 * Guardián de compatibilidad y aislamiento (ADR-011, ADR-018).
 *
 * Recorre app/ y falla con código de salida 1 si encuentra:
 *   (a) APIs posteriores a Chrome 109 (lista de veto de ADR-011),
 *   (b) URLs absolutas http:// o https:// dentro de app/ (ADR-018),
 *   (c) módulos ES: import / export / <script type="module">,
 *   (d) dependencias externas (package.json con dependencies no vacía
 *       o node_modules/ dentro de app/).
 *
 * Sin dependencias: sólo la biblioteca estándar de Node.
 *
 * Uso:  node tools/check-compat.js [directorio]
 * El directorio por defecto es app/. Si se apunta a tools/, se inspecciona
 * a sí mismo y debe pasar (auto-inspección).
 *
 * Cómo se evitan los falsos positivos:
 * La fuente se analiza con un mini-lexer que distingue comentarios, cadenas
 * de texto, literales de expresión regular y código. Las comprobaciones de
 * JS/CSS/HTML y de módulos ES (import/export) corren sobre el "código limpio"
 * (sin comentarios, sin cadenas —incluidas las de mensajes de error— y sin
 * literales regex). Así, mencionar "Object.groupBy" en un comentario o en un
 * string no cuenta como violación. Las URLs absolutas, en cambio, se reportan
 * SIEMPRE, también dentro de un literal de cadena (fetch('https://...'),
 * href="https://...", url("https://...")): app no puede emitir ni declarar
 * referencias al exterior (ADR-018). Sólo quedan exceptuadas las que viven
 * dentro de un comentario. Lo único que se revisa con las cadenas conservadas,
 * además de las URLs, es <script type="module"> en HTML, porque el valor de
 * atributo va entre comillas. El flag "v" de regex se detecta en los literales
 * regex extraídos por el lexer.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DIRECTORIO_DEFECTO = path.join(RAIZ, 'app');

const EXT_JS = ['.js'];
const EXT_CSS = ['.css'];
const EXT_HTML = ['.html', '.htm'];

// Tablas de veto en compat-patrones.js (ORDEN-RONDA-07 §2.2): este guardián
// sólo aporta el escaneo; los patrones son datos.
const {
  PATRONES_JS,
  PATRONES_CSS,
  PATRONES_HTML,
  PATRONES_IMPORT_EXPORT,
  PATRONES_TYPE_MODULE,
  PATRONES_URL
} = require('./compat-patrones.js');

// ---------------------------------------------------------------------------
// Mini-lexer: separa comentarios, cadenas y literales regex del código.
// ---------------------------------------------------------------------------
function esInicioRegex(ultimo) {
  // Heurística estándar: un "/" es inicio de regex si el último token
  // significativo "espera un valor". Si es un identificador, número o cierre
  // de paréntesis/corchete, es una división.
  if (ultimo === null) {
    return true;
  }
  return '([{=,:;!&|?+-*%^~<>'.indexOf(ultimo) !== -1;
}

function esLetra(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function esEspacio(ch) {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

// Devuelve { sinCadenas, conCadenas, regexes }.
//  - sinCadenas: comentarios, cadenas y regex reemplazados por espacios
//    (preservando saltos de línea). Base para las comprobaciones de código.
//  - conCadenas: comentarios y regex reemplazados; cadenas conservadas.
//    Base para la detección de URLs y de <script type="module">.
//  - regexes: [{ linea, flags }] literales regex encontrados (sólo si esJS).
function analizarFuente(texto, esJS) {
  let sin = '';
  let con = '';
  const regexes = [];
  const n = texto.length;
  let i = 0;
  let linea = 1;
  let ultimo = null;

  // Línea shebang inicial: no es código
  if (texto.substring(0, 2) === '#!') {
    const nl = texto.indexOf('\n');
    i = nl === -1 ? n : nl;
  }

  function aportarEspacios(trozo) {
    const saltos = trozo.replace(/[^\n]/g, '');
    sin += saltos;
    con += saltos;
  }

  while (i < n) {
    const ch = texto[i];
    const sig = i + 1 < n ? texto[i + 1] : '';

    // Comentario de bloque
    if (ch === '/' && sig === '*') {
      const fin = texto.indexOf('*/', i + 2);
      const trozo = texto.slice(i, fin === -1 ? n : fin + 2);
      aportarEspacios(trozo);
      linea += (trozo.match(/\n/g) || []).length;
      i += trozo.length;
      continue;
    }

    // Comentario de línea. Sólo en JS: en CSS "//" no es comentario (los
    // comentarios CSS son /* */) y puede aparecer dentro de un url(...) sin
    // comillas, p. ej. url(https://...). Si se recortara acá, la URL no se
    // detectaría (defecto encontrado por la suite adversaria, ORDEN-RONDA-02 §2.1).
    if (ch === '/' && sig === '/' && esJS) {
      const nl = texto.indexOf('\n', i);
      const trozo = texto.slice(i, nl === -1 ? n : nl);
      aportarEspacios(trozo);
      i += trozo.length;
      continue;
    }

    // Comentario HTML
    if (ch === '<' && texto.substr(i, 4) === '<!--') {
      const fin = texto.indexOf('-->', i + 4);
      const trozo = texto.slice(i, fin === -1 ? n : fin + 3);
      aportarEspacios(trozo);
      linea += (trozo.match(/\n/g) || []).length;
      i += trozo.length;
      continue;
    }

    // Cadenas de texto
    if (ch === "'" || ch === '"' || ch === '`') {
      const comilla = ch;
      let j = i + 1;
      let cadena = ch;
      while (j < n) {
        const c = texto[j];
        cadena += c;
        if (c === '\\' && j + 1 < n) {
          cadena += texto[j + 1];
          j += 2;
          continue;
        }
        if (c === '\n') {
          linea++;
        }
        j++;
        if (c === comilla) {
          break;
        }
      }
      con += cadena;
      sin += cadena.replace(/[^\n]/g, ' ');
      ultimo = 'a';
      i = j;
      continue;
    }

    // Literal de expresión regular (sólo en JS)
    if (ch === '/' && esJS && esInicioRegex(ultimo)) {
      let j = i + 1;
      let cuerpo = '/';
      let dentroClase = false;
      let cerrado = false;
      while (j < n) {
        const c = texto[j];
        if (c === '\\' && j + 1 < n) {
          cuerpo += c + texto[j + 1];
          j += 2;
          continue;
        }
        if (c === '\n') {
          break;
        }
        cuerpo += c;
        j++;
        if (c === '[') {
          dentroClase = true;
        } else if (c === ']') {
          dentroClase = false;
        } else if (c === '/' && !dentroClase) {
          cerrado = true;
          break;
        }
      }
      if (cerrado) {
        let flags = '';
        while (j < n && esLetra(texto[j])) {
          flags += texto[j];
          j++;
        }
        regexes.push({ linea: linea, flags: flags });
        sin += cuerpo.replace(/[^\n]/g, ' ') + ' ';
        con += ' ';
        ultimo = 'a';
        i = j;
        continue;
      }
      // No era un regex cerrado: se trata como operador de división
      sin += ch;
      con += ch;
      ultimo = ch;
      i++;
      continue;
    }

    // Carácter normal
    sin += ch;
    con += ch;
    if (!esEspacio(ch)) {
      ultimo = ch;
    }
    if (ch === '\n') {
      linea++;
    }
    i++;
  }

  return { sinCadenas: sin, conCadenas: con, regexes: regexes };
}

function patronesPara(archivo) {
  const ext = path.extname(archivo).toLowerCase();
  const lista = [];
  if (EXT_JS.indexOf(ext) !== -1) {
    lista.push.apply(lista, PATRONES_JS);
    lista.push.apply(lista, PATRONES_IMPORT_EXPORT);
  } else if (EXT_CSS.indexOf(ext) !== -1) {
    lista.push.apply(lista, PATRONES_CSS);
  } else if (EXT_HTML.indexOf(ext) !== -1) {
    lista.push.apply(lista, PATRONES_HTML);
    lista.push.apply(lista, PATRONES_IMPORT_EXPORT);
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Recorrido y verificación
// ---------------------------------------------------------------------------
function listarArchivos(dir) {
  const resultados = [];
  const pila = [dir];
  while (pila.length > 0) {
    const actual = pila.pop();
    const entradas = fs.readdirSync(actual, { withFileTypes: true });
    for (const entrada of entradas) {
      const ruta = path.join(actual, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(ruta);
      } else {
        resultados.push(ruta);
      }
    }
  }
  return resultados;
}

function verificarArchivo(rutaAbsoluta) {
  const texto = fs.readFileSync(rutaAbsoluta, 'utf8');
  const esJS = EXT_JS.indexOf(path.extname(rutaAbsoluta).toLowerCase()) !== -1;
  const analisis = analizarFuente(texto, esJS);
  const rel = path.relative(RAIZ, rutaAbsoluta);
  const violaciones = [];

  // Comprobaciones de código: sobre el texto sin cadenas ni comentarios
  const lineas = analisis.sinCadenas.split('\n');
  const patrones = patronesPara(rutaAbsoluta);
  for (let i = 0; i < lineas.length; i++) {
    for (const p of patrones) {
      if (p.re.test(lineas[i])) {
        violaciones.push(rel + ':' + (i + 1) + '  ' + p.motivo);
      }
    }
  }

  // Flag "v" en literales regex (Chrome 112)
  for (const r of analisis.regexes) {
    if (r.flags.indexOf('v') !== -1) {
      violaciones.push(rel + ':' + r.linea + '  flag "v" en expresiones regulares (Chrome 112)');
    }
  }

  // script type="module" (HTML): el valor del atributo va entre comillas, así
  // que se revisa sobre el texto con las cadenas conservadas.
  if (EXT_HTML.indexOf(path.extname(rutaAbsoluta).toLowerCase()) !== -1) {
    const lineasHtml = analisis.conCadenas.split('\n');
    for (let i = 0; i < lineasHtml.length; i++) {
      for (const p of PATRONES_TYPE_MODULE) {
        if (p.re.test(lineasHtml[i])) {
          violaciones.push(rel + ':' + (i + 1) + '  ' + p.motivo);
        }
      }
    }
  }

  // URLs: sobre el texto con las cadenas conservadas. Una URL absoluta se
  // reporta siempre, incluso dentro de un literal de cadena
  // (fetch('https://...'), href="https://...", url("https://...")). Sólo las
  // que viven dentro de un comentario quedan exceptuadas (ADR-018).
  const lineasUrl = analisis.conCadenas.split('\n');
  for (let i = 0; i < lineasUrl.length; i++) {
    for (const p of PATRONES_URL) {
      if (p.re.test(lineasUrl[i])) {
        violaciones.push(rel + ':' + (i + 1) + '  ' + p.motivo);
      }
    }
  }

  return violaciones;
}

function verificarDependencias() {
  const violaciones = [];

  const appNodeModules = path.join(RAIZ, 'app', 'node_modules');
  if (fs.existsSync(appNodeModules)) {
    violaciones.push('app/node_modules/  node_modules dentro de app/ (dependencia externa)');
  }

  const candidatosPkg = [path.join(RAIZ, 'package.json'), path.join(RAIZ, 'app', 'package.json')];
  for (const pkgPath of candidatosPkg) {
    if (!fs.existsSync(pkgPath)) {
      continue;
    }
    let pkg = null;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      violaciones.push(path.relative(RAIZ, pkgPath) + '  no es JSON válido: ' + e.message);
      continue;
    }
    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      violaciones.push(path.relative(RAIZ, pkgPath) + '  dependencies no vacía (dependencia externa)');
    }
  }
  return violaciones;
}

function main() {
  const dirArgumento = process.argv[2];
  const directorio = dirArgumento ? path.resolve(dirArgumento) : DIRECTORIO_DEFECTO;

  if (!fs.existsSync(directorio)) {
    console.error('check-compat: el directorio no existe: ' + directorio);
    process.exit(1);
  }

  const violaciones = [];
  const archivos = listarArchivos(directorio);
  let contados = 0;

  for (const archivo of archivos) {
    const ext = path.extname(archivo).toLowerCase();
    if (EXT_JS.indexOf(ext) === -1 && EXT_CSS.indexOf(ext) === -1 && EXT_HTML.indexOf(ext) === -1) {
      continue;
    }
    contados++;
    violaciones.push.apply(violaciones, verificarArchivo(archivo));
  }

  violaciones.push.apply(violaciones, verificarDependencias());

  if (violaciones.length > 0) {
    console.error('check-compat: se encontraron ' + violaciones.length + ' violacion(es):');
    for (const v of violaciones) {
      console.error('  ' + v);
    }
    console.error('check-compat: BUILD FALLIDO');
    process.exit(1);
  }

  console.log('check-compat: OK - ' + contados + ' archivo(s) inspeccionado(s), 0 violaciones.');
  process.exit(0);
}

main();
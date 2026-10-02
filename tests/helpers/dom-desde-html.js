'use strict';

/*
 * dom-desde-html.js
 * ORDEN-RONDA-28 §2. El pedazo de montura que hasta la ronda 28 vivía sólo
 * adentro de tests/helpers/aplicacion-montura.js, y que la ronda 28 necesita
 * también para el segundo punto de entrada (app/generador.html, ADR-044).
 *
 * Son tres cosas, y las dos monturas las necesitan igual:
 *
 *  - construir el árbol del DOM desde el HTML real, sin innerHTML: la app no
 *    debe inyectar HTML y hay un contador en dom-stub.js que lo delata;
 *  - poner en el global lo que el navegador trae y Node no (sessionStorage,
 *    FileReader, Blob, URL.createObjectURL, document);
 *  - dos utilidades de los tests: esperar una condición y encontrar un botón
 *    por su texto.
 *
 * Sesacarlas de aplicacion-montura.js evita dos copias que divergen: el
 * generador monta su HTML con el mismo código que monta index.html, y si
 * aparece un <main> nuevo o una etiqueta nueva, los dos loicken igual.
 */

const { Nodo, crearStoragePlano } = require('./dom-stub.js');

// Etiquetas sin cierre: si se apilaran, todo lo que sigue quedaría adentro.
const VACIOS = new Set(['meta', 'link', 'input', 'img', 'br', 'hr', 'source']);
const CUERPO_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;

function extraerAtributos(raw) {
  const attrs = {};
  const re = /([\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs[m[1]] = m[2] === undefined ? '' : m[2];
  }
  return attrs;
}

function aplicarAtributos(nodo, attrs) {
  for (const nombre of Object.keys(attrs)) {
    const valor = attrs[nombre];
    nodo.setAttribute(nombre, valor);
    if (nombre === 'id') {
      nodo.id = valor;
    } else if (nombre === 'type') {
      nodo.type = valor;
    } else if (nombre === 'hidden') {
      nodo.hidden = true;
    } else if (nombre === 'value') {
      nodo.value = valor;
    } else if (nombre === 'class') {
      nodo.className = valor;
    } else if (nombre === 'required') {
      nodo.required = true;
    } else if (nombre === 'maxlength') {
      nodo.maxLength = parseInt(valor, 10);
    } else if (nombre === 'rows') {
      nodo.rows = parseInt(valor, 10);
    } else if (nombre === 'min' || nombre === 'step' || nombre === 'placeholder' || nombre === 'href') {
      nodo[nombre] = valor;
    }
  }
}

function registrarArbol(documento, nodo) {
  if (nodo.id) {
    documento.porId[nodo.id] = nodo;
  }
  for (const hijo of nodo.children) {
    registrarArbol(documento, hijo);
  }
}

/*
 * El texto entre etiquetas se vuelve un nodo de texto, como en el navegador.
 * Sin esto, el textContent de cualquier elemento compuesto (la franja del
 * generador, un aviso, el rótulo de un botón del HTML) salía vacío en la
 * montura y los tests no podían afirmar lo que el usuario lee. Sólo se crea
 * texto con algo que no sea blanco: los nodos de espacio en blanco no cambian
 * lo que se ve y ensucian las comparaciones exactas.
 */
function agregarTexto(documento, padre, texto) {
  if (texto.trim() === '') {
    return;
  }
  padre.appendChild(documento.createTextNode(texto));
}

/*
 * Arma el árbol de `documento` desde el HTML que le pasó el punto de entrada.
 * Devuelve el <body>.
 */
function construir(documento, html) {
  const cuerpoHtml = (CUERPO_RE.exec(html) || ['', ''])[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  documento.porId = {};
  const cuerpo = new Nodo('body');
  documento.body = cuerpo;
  const pila = [cuerpo];
  const reTag = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*)?)\s*(\/?)\s*>/g;
  let m;
  let ultimo = 0;
  while ((m = reTag.exec(cuerpoHtml))) {
    agregarTexto(documento, pila[pila.length - 1], cuerpoHtml.slice(ultimo, m.index));
    ultimo = reTag.lastIndex;
    const barra = m[1];
    const tag = m[2];
    if (barra === '/') {
      while (pila.length > 1 && pila[pila.length - 1].tag !== tag.toLowerCase()) {
        pila.pop();
      }
      if (pila.length > 1) {
        pila.pop();
      }
      continue;
    }
    const tagLower = tag.toLowerCase();
    const nodo = new Nodo(tagLower);
    aplicarAtributos(nodo, extraerAtributos(m[3]));
    pila[pila.length - 1].appendChild(nodo);
    if (!VACIOS.has(tagLower) && m[4] !== '/') {
      pila.push(nodo);
    }
  }
  agregarTexto(documento, pila[pila.length - 1], cuerpoHtml.slice(ultimo));
  registrarArbol(documento, cuerpo);
  return cuerpo;
}

function buscarPorId(nodo, id) {
  if (nodo.id === id) {
    return nodo;
  }
  for (const hijo of nodo.children) {
    const encontrado = buscarPorId(hijo, id);
    if (encontrado) {
      return encontrado;
    }
  }
  return null;
}

/*
 * getElementById con búsqueda en árbol: los nodos creados con createElement
 * (formularios dinámicos, opciones, filas) no están en porId.
 */
function prepararBusquedaPorId(documento) {
  documento.getElementById = function (id) {
    return documento.porId[id] || buscarPorId(documento.body, id);
  };
}

/*
 * Lo que el navegador trae en globalThis y Node no. La app lo usa sin
 * consultarlo (wizard.js usa root.sessionStorage, exportar.js usa Blob y
 * URL.createObjectURL, fasttrack usa FileReader), así que sin esto el arranque
 * real explota.
 */
function instalarGlobales(documento) {
  if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = {};
  }
  if (typeof globalThis.confirm !== 'function') {
    globalThis.confirm = function () { return false; };
  }
  if (typeof globalThis.prompt !== 'function') {
    globalThis.prompt = function () { return null; };
  }
  globalThis.sessionStorage = globalThis.sessionStorage || crearStoragePlano();
  globalThis.localStorage = globalThis.localStorage || crearStoragePlano();
  if (typeof globalThis.FileReader !== 'function') {
    globalThis.FileReader = function () {};
  }
  if (!globalThis.FileReader.prototype.readAsText) {
    globalThis.FileReader.prototype.readAsText = function (archivo) {
      this.result = archivo && typeof archivo.contenido === 'string'
        ? archivo.contenido : '';
      if (typeof this.onload === 'function') { this.onload(); }
    };
  }
  if (!globalThis.FileReader.prototype.readAsDataURL) {
    globalThis.FileReader.prototype.readAsDataURL = function (archivo) {
      var nombre = (archivo && archivo.name) || 'archivo';
      var tipo = (archivo && archivo.type) || 'application/octet-stream';
      this.result = 'data:' + tipo + ';base64,' +
        Buffer.from('contenido-sintetico-' + nombre).toString('base64');
      if (typeof this.onload === 'function') { this.onload(); }
    };
  }
  if (typeof globalThis.URL.createObjectURL !== 'function') {
    globalThis.URL.createObjectURL = function () { return 'blob:montura'; };
  }
  if (typeof globalThis.URL.revokeObjectURL !== 'function') {
    globalThis.URL.revokeObjectURL = function () {};
  }
  if (typeof globalThis.Blob !== 'function') {
    // La app descarga documentos con `new Blob([...])` (exportar.js,
    // descargadorGenerico). Sin Blob, el click del descargador explota.
    globalThis.Blob = function (partes, opciones) {
      this.partes = partes;
      this.type = (opciones && opciones.type) || '';
    };
  }
  globalThis.document = documento;
}

/*
 * Espera a que una condición sea cierta, como la usa la montura de la
 * aplicación con servidor. Con `plazo` corto y el mensaje del lado del test.
 */
function esperar(condicion, plazo, mensaje) {
  return new Promise((resolve, reject) => {
    const limite = Date.now() + (plazo || 20000);
    function paso() {
      if (condicion()) {
        return resolve();
      }
      if (Date.now() > limite) {
        return reject(new Error(mensaje || 'no se cumplió la condición a tiempo'));
      }
      setTimeout(paso, 25);
    }
    setImmediate(paso);
  });
}

function botonEn(raiz, texto) {
  for (const b of raiz.querySelectorAll('button')) {
    if (b.textContent === texto) {
      return b;
    }
  }
  return null;
}

/*
 * Los <script src="..."> del documento, en el orden en que los leería el
 * navegador (ADR-029: cada módulo exige que el anterior esté en SGC).
 */
function scriptsDelHtml(html) {
  const lista = [];
  const re = /<script\s+src="([^"]+)"\s*>/g;
  let m;
  while ((m = re.exec(html))) {
    lista.push(m[1]);
  }
  return lista;
}

module.exports = {
  construir,
  instalarGlobales,
  prepararBusquedaPorId,
  esperar,
  botonEn,
  scriptsDelHtml,
  buscarPorId
};
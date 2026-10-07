'use strict';

/*
 * generador-montura.js
 * ORDEN-RONDA-28 §2 (ADR-044). Montura del SEGUNDO punto de entrada,
 * app/generador.html, tal como lo abre el Jefe: doble clic, o sea file://, sin
 * servidor, sin puerto y sin instalar nada.
 *
 * Es la hermana de helpers/aplicacion-montura.js y comparte con ella el armado
 * del DOM y los globales de navegador (helpers/dom-desde-html.js). Lo que cambia
 * es lo que este punto de entrada NO tiene:
 *
 *  - NINGÚN servidor. No hay http, ni fetch real, ni puerto. Ésa es toda la
 *    diferencia con la otra montura: la del servidor levanta el proceso real;
 *    la del generador no levanta nada, que es justamente lo que hay que probar.
 *
 *  - fetch y XMLHttpRequest son espías: anotan la llamada y la rechazan. Un
 *    pedido de red en el generador no es una degradación, es un defecto (la
 *    orden lo pide explícitamente), así que el espía lo hace ruido en vez de
 *    dejarlo pasar.
 *
 *  - location.protocol es 'file:'. Es lo que hace que carga.js elija la rama de
 *    <script> en vez de la de fetch, y lo que en el navegador real dispara el
 *    rechazo de Chrome a los pedidos por fetch sobre file://.
 *
 *  - El <head> del stub NO existe en dom-stub.js, así que esta montura lo crea
 *    y le hace lo que hace Chrome: cuando la app inyecta un <script src>, se lee
 *    ese archivo del disco y se evalúa de verdad. Los .js hermanos del catálogo
 *    que escriben tools/build-catalogo.js y tools/build-config.js son los
 *    archivos reales del repo: si uno faltara o estuviera mal, la carga falla
 *    acá igual que fallaría con doble clic.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { Nodo, documento } = require('./dom-stub.js');
const dom = require('./dom-desde-html.js');

const RAIZ = path.join(__dirname, '..', '..');
const APP_DIR = path.join(RAIZ, 'app');
const GENERADOR_HTML = fs.readFileSync(path.join(APP_DIR, 'generador.html'), 'utf8');
const ARRANQUE = 'js/generador.js';

// Los <script> que el arranque monta por sesión, como app.js en la otra
// montura: require cachea, así que para poder "recargar" como un navegador se
// compila aparte y se corre con new Function('window','document').
let arranqueCompilado = null;

function compilarArranque() {
  if (!arranqueCompilado) {
    const codigo = fs.readFileSync(path.join(APP_DIR, ARRANQUE), 'utf8');
    arranqueCompilado = new Function('window', 'document', codigo);
  }
}

/* Carga los módulos reales en el orden del documento (ADR-029). Los .js que no
 * son de app/js (config/aplicacion.js) se cargan por require igual: son
 * scripts clásicos que sólo usan el global SGC, y require los ejecuta igual que
 * el navegador. */
function cargarModulos() {
  if (cargarModulos.cargado) {
    return;
  }
  cargarModulos.cargado = true;
  for (const ruta of dom.scriptsDelHtml(GENERADOR_HTML)) {
    if (ruta === ARRANQUE) {
      continue;
    }
    require(path.join(APP_DIR, ruta));
  }
  compilarArranque();
}

/*
 * El <head> que ejecuta los <script> inyectados, como el navegador. El stub no
 * tiene head (carga.js hace document.head.appendChild), así que se crea uno
 * acá. Devuelve el array donde quedan las rutas inyectadas.
 */
function instalarHeadQueEjecutaScripts() {
  const head = new Nodo('head');
  const inyectados = [];
  const appendOriginal = head.appendChild.bind(head);
  head.appendChild = function (nodo) {
    appendOriginal(nodo);
    if (nodo.tag !== 'script' || typeof nodo.src !== 'string' || nodo.src === '') {
      return nodo;
    }
    inyectados.push(nodo.src);
    const ruta = path.join(APP_DIR, nodo.src);
    if (!fs.existsSync(ruta)) {
      if (typeof nodo.onerror === 'function') {
        nodo.onerror();
      }
      return nodo;
    }
    // runInThisContext comparte el globalThis, así que el archivo ve el mismo
    // SGC que acaba de montar la app.
    vm.runInThisContext(fs.readFileSync(ruta, 'utf8'), { filename: nodo.src });
    return nodo;
  };
  documento.head = head;
  return inyectados;
}

/*
 * Espías de red. Registran y rechazan: si algo pide, el test lo ve en
 * m.red.llamadas y además la operación falla con un mensaje que dice por qué.
 */
function instalarEspiasDeRed() {
  const llamadas = [];
  globalThis.fetch = function (entrada) {
    const url = String(entrada && entrada.url ? entrada.url : entrada);
    llamadas.push('fetch ' + url);
    return Promise.reject(new Error(
      'el generador no hace pedidos por red (pedía ' + url + ')'));
  };
  globalThis.XMLHttpRequest = function () {
    llamadas.push('XMLHttpRequest');
    throw new Error('el generador no hace pedidos por red (XMLHttpRequest)');
  };
  return llamadas;
}

/*
 * ORDEN-RONDA-28 §4: las descargas. El generador baja la plantilla y exporta el
 * requerimiento con un <a download> y un Blob, así que acá se captura lo que se
 * descarga: el nombre y el texto. El parche va en ESTA montura y no en
 * dom-desde-html.js a propósito, porque las otras suites (wizard, exportar) ya
 *iaryn de su propia descarga y no tienen que ver un click extra.
 *
 * Se intercepta URL.createObjectURL para guardar el Blob con su nombre de
 * archivo: el <a> recibe la url como href y no vuelve a mirar el Blob.
 *
 * El parche va en ESTA montura y no en dom-desde-html.js a propósito: las otras
 * suites (wizard, exportar) cuentan su propia descarga y no tienen que ver un
 * click extra.
 */
function capturarDescargas() {
  const descargas = [];
  const objetos = {};
  let contador = 0;
  const createOriginal = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = function (blob) {
    contador += 1;
    const url = 'blob:generador/' + contador;
    objetos[url] = blob;
    return url;
  };
  const revokeOriginal = globalThis.URL.revokeObjectURL;
  globalThis.URL.revokeObjectURL = function (url) {
    delete objetos[url];
  };
  const clickOriginal = Nodo.prototype.click;
  Nodo.prototype.click = function () {
    // En el navegador, `enlace.download = nombre` se refleja en el atributo; en
    // el stub es una propiedad y nada más, así que se mira de las dos formas.
    const descarga = (this.getAttribute && this.getAttribute('download')) || this.download;
    if (descarga) {
      // El blob se guarda acá, en el momento del click: la app revoca la url
      // enseguida (que es lo correcto en el navegador) y después ya no queda
      // nada de dónde leer el contenido.
      const blob = objetos[this.href] || null;
      descargas.push({
        nombre: descarga,
        blob: blob,
        texto: () => textoDeBlob(blob)
      });
      return;
    }
    return clickOriginal.call(this);
  };
  return {
    descargas: descargas,
    desarmar: function () {
      Nodo.prototype.click = clickOriginal;
      globalThis.URL.createObjectURL = createOriginal;
      globalThis.URL.revokeObjectURL = revokeOriginal;
    }
  };
}

function textoDeBlob(blob) {
  if (!blob) {
    return Promise.resolve('');
  }
  // El Blob del stub de dom-desde-html.js guarda las partes; el de Node trae
  // text(). Los dos caminos devuelven el texto del archivo descargado.
  if (Array.isArray(blob.partes)) {
    return Promise.resolve(blob.partes.join(''));
  }
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return Promise.resolve('');
}

async function arrancar() {
  cargarModulos();
  dom.instalarGlobales(documento);
  dom.prepararBusquedaPorId(documento);
  const llamadas = instalarEspiasDeRed();
  const capturas = capturarDescargas();

  // Con doble clic, location.protocol es 'file:'. Así carga.js elige la rama de
  // <script>, que es la que se está probando.
  const loc = {
    protocol: 'file:',
    origin: 'file://',
    reload: function () { m.correr(); }
  };

  const m = {
    documento: documento,
    red: { llamadas: llamadas },
    scriptsInyectados: [],
    esperar: dom.esperar,
    botonEn: dom.botonEn,
    HTML: GENERADOR_HTML,
    APP_DIR: APP_DIR,
    descargas: capturas.descargas,
    desarmarDescargas: capturas.desarmar,
    scripts: function () {
      return dom.scriptsDelHtml(GENERADOR_HTML);
    }
  };

  /*
   * Recarga, como haría F5 con doble clic: se rearma el documento y se corre
   * el arranque. Devuelve una promesa que se resuelve cuando el arranque ya
   * terminó de montarse, para que ningún test escriba en la pantalla antes de
   * que existan los escuchadores. Si el arranque explota, la promesa lo
   * rechaza: un error de montaje tiene que verse como un error de test, no
   * como un time-out más adelante.
   */
  m.correr = function () {
    dom.construir(documento, GENERADOR_HTML);
    documento._eventos = {};
    documento.readyState = 'loading';
    m.scriptsInyectados = instalarHeadQueEjecutaScripts();
    globalThis.location = loc;
    arranqueCompilado({ SGC: globalThis.SGC, location: loc }, documento);
    return new Promise(function (resolve) {
      setImmediate(function () {
        documento.emit('DOMContentLoaded');
        resolve();
      });
    });
  };

  /*
   * Quitar una fila de valores por su botón ("−", data-quitar="i:j"). Como en
   * cargarValores: los botones son escuchados por DELEGACIÓN en el contenedor
   * (#sgc-req-valores) y el stub no burbujea eventos, así que el clic se emite en
   * el contenedor con `target` apuntando al botón, como haría el navegador.
   */
  m.quitarValorFila = function (i, j) {
    const contenedor = documento.getElementById('sgc-req-valores');
    const boton = contenedor.querySelector('[data-quitar="' + i + ':' + j + '"]');
    if (!boton) {
      throw new Error('quitarValorFila: no existe el botón para quitar ' + i + ':' + j);
    }
    contenedor.emit('click', { target: boton });
    return boton;
  };

  // Atajo de escritura, como los de la montura de la aplicación con servidor:
  // los tests escriben en la pantalla y emiten el evento, no llaman funciones de
  // vista a mano.
  m.escribir = function (id, valor) {
    const nodo = documento.getElementById(id);
    nodo.value = String(valor);
    nodo.emit('input', { target: nodo });
    return nodo;
  };

  m.setear = function (id, valor) {
    documento.getElementById(id).value = String(valor);
  };

  m.mousedown = function (id) {
    documento.getElementById(id).emit('mousedown', { preventDefault() {} });
  };

  m.escribirEnNodo = function (nodo, valor) {
    nodo.value = String(valor);
    nodo.emit('input', { target: nodo });
    return nodo;
  };

  /*
   * ORDEN-RONDA-28 §3: los valores de referencia del generador se escriben por
   * el mismo bloque de la aplicación con servidor
   * (#sgc-req-valores, vistas/requerimiento-valores.js). Ese bloque atiende por
   * delegación: los campos no tienen listener propio y el contenedor es el que
   * escucha 'change'. El stub no burbujea eventos, así que acá se emite
   * DIRECTAMENTE en el contenedor con `target` apuntando al campo, como haría
   * el navegador.
   *
   * filasPorRenglon[i] = [{presupuestoId, base, valor}, ...]: lo que escribe
   * una persona, renglón por renglón y fila por fila.
   */
  m.cargarValores = function (filasPorRenglon) {
    const contenedor = documento.getElementById('sgc-req-valores');
    if (!contenedor) {
      throw new Error('cargarValores: no existe #sgc-req-valores en el generador');
    }
    filasPorRenglon.forEach(function (filas, i) {
      filas.forEach(function (fila, j) {
        const escribir = function (atributo, valor) {
          const elemento = contenedor.querySelector('[data-' + atributo + '="' + i + ':' + j + '"]');
          if (!elemento) {
            throw new Error('cargarValores: no existe la fila ' + i + ':' + j +
              ' (atributo data-' + atributo + ')');
          }
          elemento.value = String(valor);
          contenedor.emit('change', { target: elemento });
        };
        // ORDEN-RONDA-31 pieza 1: una fila de justificación se guarda sin base
        // ni valor (esos campos se esconden al elegir el documento), así que
        // acá no se tocan.
        escribir('presupuesto', fila.presupuestoId);
        if (fila.justificacion !== true) {
          escribir('base', fila.base);
          escribir('valor', fila.valor);
        }
      });
    });
  };

  // El botón de un rol, por su data-rol. Se busca atributo por atributo y no
  // con 'button[data-rol=...]': el selector de dom-stub.js entiende '#id' y
  // '[attr]', pero en un selector compuesto con el nombre de la etiqueta se
  // queda con el nombre y devolvería el primer botón, el equivocado.
  /*
   * ORDEN-RONDA-29 pieza 2: la pantalla de identidad pide cuatro datos antes
   * del rol. Los tests que sólo elegían un nombre pasan por acá para completar
   * lo demás; el nombre lo sigue escribiendo cada test, porque es lo que
   * afirma. El número de control se escribe con `escribir` y no con `setear`
   * para que corra el formateo, como cuando se tipea.
   */
  m.completarIdentidad = function (datos) {
    const d = datos || {};
    m.setear('sgc-generador-grado', d.grado || 'Cabo');
    m.setear('sgc-generador-apellido', d.apellido || 'Pérez');
    m.escribir('sgc-generador-numero-control', d.numeroControl || '12345');
  };

  // Los cuatro datos de la identidad, escritos con eventos, como una persona.
  m.escribirIdentidad = function (datos) {
    const d = datos || {};
    m.escribir('sgc-generador-grado', d.grado || 'Cabo');
    m.escribir('sgc-generador-nombre', d.nombre || 'Ana');
    m.escribir('sgc-generador-apellido', d.apellido || 'Pérez');
    m.escribir('sgc-generador-numero-control', d.numeroControl || '12345');
  };

  m.botonDeRol = function (rol) {
    for (const b of documento.getElementById('sgc-generador-roles')
      .querySelectorAll('button')) {
      if (b.getAttribute('data-rol') === rol) {
        return b;
      }
    }
    return null;
  };

  m.elegirRol = function (rol) {
    m.botonDeRol(rol).click();
  };

  m.franja = function () {
    return documento.getElementById('sgc-generador-franja');
  };

  /*
   * ORDEN-RONDA-28 §4: bajar la plantilla. Es el botón de siempre del
   * asistente, así que el test lo aprieta y lee lo que quedó en m.descargas.
   */
  m.bajarPlantilla = async function () {
    const antes = m.descargas.length;
    documento.getElementById('sgc-btn-modelo').click();
    await m.esperar(function () { return m.descargas.length > antes; }, 10000,
      'la plantilla no se descargó');
    return m.descargas[m.descargas.length - 1];
  };

  /*
   * ORDEN-RONDA-28 §4: elegir un archivo en el <input type="file"> y disparar
   * el 'change' como haría la persona al elegirlo. El FileReader del stub lee
   * `archivo.contenido`, así que el archivo que se "elige" es su texto.
   */
  m.elegirArchivo = function (contenido, nombre) {
    // Prueba primero el input del Fast-Track (plantillas); si no existe, busca
    // cualquier input de tipo file aceptable para JSON (importar avance).
    var input = documento.getElementById('sgc-archivo-modelo');
    if (!input) {
      var candidatos = documento.querySelectorAll('input[type="file"][accept*="json"]');
      if (candidatos.length > 0) {
        input = candidatos[0];
      }
    }
    if (!input) {
      throw new Error('elegirArchivo: no existe #sgc-archivo-modelo ni input[type=file][accept*="json"]');
    }
    input.files = [{ name: nombre || 'archivo.json', contenido: contenido }];
    input.emit('change', { target: input });
    return input;
  };

  // Lo que el asistente contesta al archivo elegido (el mismo <p> del aviso).
  m.msjArchivo = function () {
    return documento.getElementById('sgc-fasttrack-msj');
  };

  /*
   * ORDEN-RONDA-31 pieza 1: elegir el archivo de un documento de referencia en
   * el <input type="file"> del generador (#sgc-presup-archivo). Nada se sube:
   * el módulo lee los bytes del archivo "elegido". Con `contenido` (un texto)
   * se puede verificar la huella contra Node (se codifica a UTF-8).
   */
  m.elegirDocumento = function (nombre, contenido) {
    const input = documento.getElementById('sgc-presup-archivo');
    if (!input) {
      throw new Error('elegirDocumento: no existe #sgc-presup-archivo');
    }
    const bytes = (contenido && typeof contenido === 'string')
      ? new TextEncoder().encode(contenido) : null;
    input.files = bytes
      ? [{ name: nombre, contenido: contenido, bytes: bytes, size: bytes.length }]
      : [{ name: nombre }];
    input.emit('change', { target: input });
    return input;
  };

  /*
   * ORDEN-RONDA-31 pieza 1: el camino completo de un documento de referencia,
   * por la pantalla: archivo elegido, tipo, proveedor, fecha, clic en Agregar,
   * y espera a que termine la lectura y la huella. Devuelve el documento ya
   * anotado (con bytes y sha256). `nombre` es obligatorio.
   */
  m.agregarDocumento = async function (opciones) {
    const d = opciones || {};
    if (!d.nombre) {
      throw new Error('agregarDocumento: falta el nombre del archivo');
    }
    // Todos los documentos de la pantalla se leen y se sellan: si el test no
    // da contenido, se sella el nombre. Lo que el JSON tiene que verificar es
    // que la huella ES la de esos bytes, con Node.
    if (d.contenido === undefined) {
      d.contenido = 'contenido de ' + d.nombre;
    }
    m.elegirDocumento(d.nombre, d.contenido);
    if (d.tipo !== undefined) {
      m.setear('sgc-presup-tipo', d.tipo);
    }
    if (d.proveedor !== undefined) {
      m.setear('sgc-presup-proveedor', d.proveedor || '');
    }
    if (d.fecha !== undefined) {
      m.setear('sgc-presup-fecha', d.fecha || '');
    }
    const antes = globalThis.SGC.generadorPresupuestos.listar().length;
    documento.getElementById('sgc-presup-agregar').click();
    await m.esperar(function () {
      return globalThis.SGC.generadorPresupuestos.listar().length > antes;
    }, 10000, 'el documento de referencia no se agregó');
    const lista = globalThis.SGC.generadorPresupuestos.listar();
    return lista[lista.length - 1];
  };

  // Vaciar lo descargado: cada test corre su propia sesión (como F5) y no tiene
  // que ver las descargas del anterior.
  m.limpiarDescargas = function () {
    m.descargas.length = 0;
  };

  return m;
}

module.exports = {
  arrancar,
  cargarModulos,
  documento,
  APP_DIR,
  GENERADOR_HTML,
  ARRANQUE
};
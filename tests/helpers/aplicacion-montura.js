'use strict';

/*
 * aplicacion-montura.js
 * ORDEN-RONDA-19 §5.1/§5.2. Montura que ejecuta la APLICACIÓN REAL en Node:
 *
 *  - Arma el árbol del DOM desde app/index.html (sin innerHTML, igual que el
 *    navegador) con el stub de tests/helpers/dom-stub.js.
 *  - Carga los scripts del HTML con require en el orden del documento
 *    (ADR-029: cada módulo exige que el anterior esté en globalThis.SGC).
 *  - Ejecuta app/js/app.js por "sesión" con new Function('window','document'),
 *    para poder recargar como un navegador: require cachea y no lo permitiría.
 *  - Reemplaza fetch por un cliente real (node:http) contra el servidor con
 *    cookie de sesión manual (sgc_sesion), igual que el navegador.
 *  - location.reload() y m.recargar() reconstruyen el DOM y vuelven a correr
 *    app.js conservando la cookie y el sessionStorage (una pestaña real).
 *
 * La clave: los tests operan SOLO sobre el DOM y los eventos que la app
 * registra; ninguna función de vista se llama a mano (ORDEN-RONDA-19 §5.1).
 *
 * ORDEN-RONDA-28 §2: armar el árbol desde el HTML, poner los globales de
 * navegador y las dos utilidades de espera viven en helpers/dom-desde-html.js,
 * compartidas con la montura del generador (ADR-044). Acá queda lo propio de
 * esta montura: el servidor de prueba y el fetch real contra él.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { documento } = require('./dom-stub.js');
const dom = require('./dom-desde-html.js');
const su = require('./servidor-util.js');

const RAIZ = path.join(__dirname, '..', '..');
const APP_DIR = path.join(RAIZ, 'app');
const INDEX = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
const RE_CLAVE = /^[a-z][a-záéíóúüñ]*(-[a-z][a-záéíóúüñ]*){3}$/;
const CORREO_ADMIN = 'administrador@sgc.local';

function scriptsDelHtml() {
  return dom.scriptsDelHtml(INDEX);
}

function claveProvisoriaDe(salida) {
  const m = salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ([^\s]+)/);
  return m ? m[1] : null;
}

// Carga única de los módulos reales, en el orden del HTML (app.js aparte).
function cargarModulos() {
  if (cargarModulos.cargado) {
    return;
  }
  cargarModulos.cargado = true;
  for (const ruta of scriptsDelHtml()) {
    if (ruta === 'js/app.js') {
      continue;
    }
    require(path.join(APP_DIR, ruta));
  }
}

let appJsCompilada = null;
function compilarAppJs() {
  if (!appJsCompilada) {
    const codigo = fs.readFileSync(path.join(APP_DIR, 'js', 'app.js'), 'utf8');
    appJsCompilada = new Function('window', 'document', codigo);
  }
}

// ---------------------------------------------------------------- Entorno --
function instalarEntorno() {
  dom.instalarGlobales(documento);
}

// ------------------------------------------------------------------ DOM ----------------
// Las dos monturas (la de esta aplicación con servidor y la del generador,
// ORDEN-RONDA-28 §2) arman el árbol y buscan por id con el mismo código, que
// vive en helpers/dom-desde-html.js.
function prepararDocumento() {
  dom.prepararBusquedaPorId(documento);
}

function construirDom() {
  return dom.construir(documento, INDEX);
}

// ------------------------------------------------------------- Utilidades de test -----
const esperar = dom.esperar;
const botonEn = dom.botonEn;

// --------------------------------------------------------------- Fetch ------------------
// Bytes sintéticos de un archivo de la montura (los inputs de archivo se
// simulan con {name, type, size}). ORDEN-RONDA-23 §3: el presupuesto viaja
// crudo, así que hay que mandar bytes con la firma que el servidor valida.
function bytesDeArchivoFalso(archivo) {
  const nombre = (archivo && archivo.name) || 'archivo';
  const tipo = (archivo && archivo.type) || '';
  const cuerpo = Buffer.from('contenido-sintetico-' + nombre, 'utf8');
  if (tipo === 'application/pdf') {
    return Buffer.concat([Buffer.from('%PDF-1.4 ', 'utf8'), cuerpo]);
  }
  if (tipo === 'image/png') {
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), cuerpo]);
  }
  if (tipo === 'image/jpeg') {
    return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), cuerpo]);
  }
  return cuerpo;
}

function crearFetch(base) {
  const uBase = new URL(base);
  let cookie = '';
  return function fetchMontura(entrada, opciones) {
    const op = opciones || {};
    const url = new URL(entrada, base + '/');
    const metodo = (op.method || 'GET').toUpperCase();
    const headers = Object.assign({ Accept: 'application/json' }, op.headers || {});
    if (cookie) {
      headers.Cookie = cookie;
    }
    let cuerpo;
    if (op.body === undefined) {
      cuerpo = undefined;
    } else if (op.body && typeof op.body === 'object' && (op.body.name || op.body.type)) {
      cuerpo = bytesDeArchivoFalso(op.body);
    } else if (op.body instanceof Buffer) {
      cuerpo = op.body;
    } else {
      cuerpo = Buffer.from(String(op.body), 'utf8');
    }
    if (cuerpo !== undefined && !('Content-Length' in headers)) {
      headers['Content-Length'] = String(cuerpo.length);
    }
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: uBase.hostname,
        port: uBase.port,
        path: url.pathname + url.search,
        method: metodo,
        headers
      }, (res) => {
        let datos = '';
        res.on('data', (trozo) => {
          datos += trozo;
        });
        res.on('end', () => {
          const set = res.headers['set-cookie'];
          const una = Array.isArray(set) ? set[0] : set;
          if (typeof una === 'string') {
            const par = una.split(';')[0].trim();
            if (par === 'sgc_sesion=' || par === 'sgc_sesion') {
              cookie = '';
            } else if (par.indexOf('sgc_sesion=') === 0) {
              cookie = par;
            }
          }
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            headers: res.headers,
            json: function () {
              try {
                return Promise.resolve(JSON.parse(datos));
              } catch (e) {
                return Promise.reject(e);
              }
            },
            text: function () {
              return Promise.resolve(datos);
            }
          });
        });
      });
      req.on('error', reject);
      if (cuerpo !== undefined) {
        req.write(cuerpo);
      }
      req.end();
    });
  };
}

// -------------------------------------------------------------- Montura ---------------
async function arrancarServidorDePrueba(opciones) {
  const opts = opciones || {};
  const datos = su.crearDirDatos(opts.prefix || 'rp19-');
  const ctx = await su.arrancarServidor(datos, 0, {
    declarado: false,
    administrador: opts.administrador || {
      nombre: 'Admin',
      apellido: 'Test',
      email: CORREO_ADMIN,
      rol: 'contrataciones_supervisor'
    }
  });
  return {
    ctx,
    datos,
    base: 'http://127.0.0.1:' + ctx.puerto,
    claveAdmin: claveProvisoriaDe(ctx.salida)
  };
}

function montura(servidor) {
  const m = {
    ...servidor,
    documento,
    RE_CLAVE,
    CORREO_ADMIN,
    esperar,
    botonEn,
    cerrar: function () {
      // ORDEN-RONDA-25 pieza 3: la sesión viva deja un intervalo real en el
      // proceso; sin esto la suite entera quedaría viva hasta el próximo pulso.
      const sgc = globalThis.SGC;
      if (sgc && sgc.sesionViva && typeof sgc.sesionViva.detener === 'function') {
        sgc.sesionViva.detener();
      }
      return su.detenerServidor(servidor.ctx);
    }
  };

  m.escribir = function (id, valor, emitir) {
    const nodo = documento.getElementById(id);
    nodo.value = String(valor);
    if (emitir !== false) {
      nodo.emit('input', { target: nodo });
    }
    return nodo;
  };

  m.setear = function (id, valor) {
    documento.getElementById(id).value = String(valor);
  };

  m.enviarFormulario = function (id) {
    documento.getElementById(id).emit('submit', { preventDefault() {} });
  };

  m.mousedown = function (id) {
    documento.getElementById(id).emit('mousedown', { preventDefault() {} });
  };

  m.correr = function () {
    construirDom();
    documento._eventos = {};
    documento.readyState = 'loading';
    const loc = {
      origin: m.base,
      reload: m.correr
    };
    const ventana = {
      SGC: globalThis.SGC,
      location: loc,
      open: function () {},
      print: function () {}
    };
    globalThis.location = loc;
    globalThis.fetch = m._fetch;
    appJsCompilada(ventana, documento);
    setImmediate(function () {
      documento.emit('DOMContentLoaded');
    });
  };

  m.recargar = function () {
    m.correr();
  };

  // --- Recorrido del administrador: ingreso, cambio de clave provisoria,   ---
  // --- navegación al padrón. Los tests del padrón lo usan como base.       ---
  m.prepararAdmin = async function () {
    const d = m.documento;
    m.correr();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'pantalla de ingreso visible');
    // Orden-Ronda-20 §3: el recorrido repite sesiones del administrador. La
    // clave provisoria vence la primera vez; si el ingreso con ella no abre el
    // cambio de clave ni la aplicación, se reingresa con la fija.
    const entro = async function (clave) {
      m.setear('sgc-ingreso-email', CORREO_ADMIN);
      m.setear('sgc-ingreso-clave', clave);
      m.enviarFormulario('sgc-ingreso');
      try {
        await m.esperar(() => !d.getElementById('sgc-cambio-clave-forma').hidden ||
          !d.getElementById('sgc-sesion-barra').hidden, 15000, 'intento de ingreso del administrador');
        return true;
      } catch (e) {
        return false;
      }
    };
    const entroOk = (await entro(m.claveAdmin)) || (await entro('clave-fija-cuatro-palabras-administrador'));
    if (!entroOk) {
      throw new Error('no se pudo autenticar al administrador (ni provisoria ni fija)');
    }

    if (!d.getElementById('sgc-cambio-clave-forma').hidden) {
      m.setear('sgc-cambio-clave-vieja', m.claveAdmin);
      m.setear('sgc-cambio-clave-nueva', 'clave-fija-cuatro-palabras-administrador');
      m.enviarFormulario('sgc-cambio-clave-forma');
    }
    await m.esperar(() => !d.getElementById('sgc-nav-padron').hidden ||
      !d.getElementById('sgc-sesion-barra').hidden, 20000,
      'navegación visible para el administrador');
    d.getElementById('sgc-nav-padron').click();
    await m.esperar(() => !d.getElementById('sgc-padron').hidden, 20000,
      'padrón visible');
  };

  // --- Recorrido completo §5.1/§5.2 paramétrico por rol: ingreso del admin, ---
  // --- alta del operador desde la pantalla, leer la clave del DOM, salir,   ---
  // --- re-ingresar como ese operador y fijar la clave. Devuelve             ---
  // --- {email, claveProvisoria, claveFija}. Orden-Ronda-20 §3: el camino    ---
  // --- C4 necesita operadores de abastecimiento, no sólo generadores.       ---
  m.prepararOperador = async function (email, nombre, apellido, rol) {
    const d = m.documento;
    await m.prepararAdmin();

    // Alta del operador desde la pantalla.
    d.getElementById('sgc-padron-alta').click();
    await m.esperar(() => d.getElementById('sgc-alta-nombre'), 20000,
      'formulario de alta visible');
    m.setear('sgc-alta-nombre', nombre);
    m.setear('sgc-alta-apellido', apellido);
    m.setear('sgc-alta-email', email);
    m.setear('sgc-alta-sector', '');
    m.setear('sgc-alta-rol', rol);
    const botonGuardar = botonEn(d.getElementById('sgc-padron-formulario'), 'Guardar');
    botonGuardar.click();
    await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 20000,
      'bloque de clave del alta visible');
    const claveProvisoria = m.claveEnPantalla(email);
    if (!claveProvisoria) {
      throw new Error('no se leyó la clave del operador desde el DOM');
    }

    // Salir de la sesión del administrador.
    d.getElementById('sgc-sesion-salir').click();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'ingreso visible tras salir');

    // Entrar con el operador y su clave provisoria.
    m.setear('sgc-ingreso-email', email);
    m.setear('sgc-ingreso-clave', claveProvisoria);
    m.enviarFormulario('sgc-ingreso');
    await m.esperar(() => !d.getElementById('sgc-cambio-clave-forma').hidden, 20000,
      'cambio de clave del operador');
    const claveFija = 'clave-fija-cuatro-palabras-' + email.split('@')[0].replace(/[^a-z]/g, '');
    m.setear('sgc-cambio-clave-vieja', claveProvisoria);
    m.setear('sgc-cambio-clave-nueva', claveFija);
    m.enviarFormulario('sgc-cambio-clave-forma');
    // Entró cuando aparece la barra de sesión: el alta sólo la ve quien
    // puede originar; los demás aterrizan en el tablero.
    await m.esperar(() => !d.getElementById('sgc-sesion-barra').hidden, 20000,
      'aplicación visible para el operador');

    return { email, claveProvisoria, claveFija };
  };

  m.prepararGenerador = async function (email, nombre, apellido) {
    return m.prepararOperador(email, nombre, apellido, 'generador');
  };

  // Clave del bloque #sgc-padron-clave: párrafos "correo — clave".
  m.claveEnPantalla = function (email) {
    const parrafos = documento.getElementById('sgc-padron-clave').querySelectorAll('p');
    for (const p of parrafos) {
      const partes = p.textContent.split('\u2014');
      if (partes.length === 2 && partes[0].trim() === email) {
        return partes[1].trim();
      }
    }
    return null;
  };

  // Fila del listado del padrón que contiene un correo.
  m.filaDelPadron = function (email) {
    const lista = documento.getElementById('sgc-padron-lista');
    for (const li of lista.children) {
      if (li.textContent.indexOf(email) !== -1) {
        return li;
      }
    }
    return null;
  };

  m.escribirEnNodo = function (nodo, valor) {
    nodo.value = String(valor);
    nodo.emit('input', { target: nodo });
    return nodo;
  };

  // ORDEN-RONDA-26 pieza 5: los campos de valores de referencia no tienen
  // listener propio: el formulario atiende por delegación un único listener
  // 'input' en #sgc-requerimiento-seccion. El stub no burbujea eventos, así
  // que acá se setea el valor del elemento y se emite DIRECTAMENTE en la
  // sección con `target` apuntando a ese elemento (como haría el navegador).
  // filasPorRenglon[i] = [{presupuestoId, base, valor}, ...].
  m.cargarValores = function (filasPorRenglon) {
    const seccion = documento.getElementById('sgc-requerimiento-seccion');
    filasPorRenglon.forEach(function (filas, i) {
      filas.forEach(function (fila, j) {
        const escribir = function (atributo, valor) {
          const elemento = seccion.querySelector('[data-' + atributo + '="' + i + ':' + j + '"]');
          if (!elemento) {
            throw new Error('cargarValores: no existe la fila ' + i + ':' + j + ' (atributo data-' + atributo + ')');
          }
          elemento.value = String(valor);
          seccion.emit('input', { target: elemento });
        };
        escribir('presupuesto', fila.presupuestoId);
        escribir('base', fila.base);
        escribir('valor', fila.valor);
      });
    });
  };

  // ORDEN-RONDA-26 pieza 5: guarda el requerimiento por su botón y espera la
  // recarga automática (expediente.abrir) que renueva la versión; sin esa
  // espera el avance que sigue iría con la versión vieja → 409.
  m.guardarRequerimiento = async function () {
    const d = documento;
    const hitos = d.getElementById('sgc-expediente-auditoria');
    const previoHito = hitos.children[0];
    d.getElementById('sgc-requerimiento-guardar').click();
    await m.esperar(() => (d.getElementById('sgc-requerimiento-msj').textContent || '')
      .indexOf('Requerimiento guardado') !== -1, 30000, 'requerimiento guardado');
    await m.esperar(() => hitos.children[0] !== previoHito, 30000,
      'el expediente se recargó tras guardar el requerimiento');
  };

  return m;
}

// La cookie de sesión vive en el cierre del fetch: montura() la fija una vez
// por servidor y la comparte entre recargas (una pestaña real).
async function arrancar(opciones) {
  const servidor = await arrancarServidorDePrueba(opciones);
  cargarModulos();
  instalarEntorno();
  prepararDocumento();
  compilarAppJs();
  const m = montura(servidor);
  m._fetch = crearFetch(servidor.base);
  return m;
}

module.exports = {
  arrancar,
  cargarModulos,
  construirDom,
  documento,
  APP_DIR,
  RE_CLAVE,
  CORREO_ADMIN
};
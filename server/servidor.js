/*
 * servidor.js
 * Servidor mínimo del SGC (ADR-003, ORDEN-RONDA-03 §3.3).
 *
 * Node sobre node:http y node:fs, sin una sola dependencia.
 *
 * Arranque literal y obligatorio:
 *   node server/servidor.js --datos <ruta> --puerto <numero>
 *
 * - --datos es obligatorio. Si la ruta no existe o no es escribible, el
 *   servidor no arranca e imprime un mensaje claro en español explicando qué
 *   falta. Acepta una ruta local y una UNC (\\servidor\recurso\...).
 * - --puerto por defecto 8123. Con 0, el sistema asigna un puerto libre y el
 *   servidor imprime el elegido en la línea "SGC-SERVIDOR-PUERTO <n>".
 *
 * Garantías:
 *  1. Escritura atómica: temporal en el mismo directorio + rename. Nunca se
 *     trunca el archivo bueno antes de tener el nuevo completo.
 *  2. La verificación de versión ocurre acá, el único punto donde puede ser
 *     atómica. La lectura-verificación-escritura se hace con fs síncrono: un
 *     bloque síncrono no se intercala con otra petición.
 *  3. Numeración serializada (ADR-009): lock de archivo con creación
 *     exclusiva (wx) y reintento. La sección crítica es corta y síncrona; el
 *     lock es la garantía documentada de que dos operadores jamás reciben el
 *     mismo número.
 *  4. Índice fragmentado (ADR-005): idx/<id>.json, un archivo por expediente.
 *     No existe un master_index.json único.
 *  5. Origen por petición (ADR-017 medida 3): dirección de red y nombre de
 *     equipo del cliente, guardados junto al contexto recibido en
 *     <datos>/origen.log (JSONL). Es el único dato de identidad que el
 *     operador no elige.
 *  6. Guardia de recorrido de rutas: un :id que contenga .., barras o
 *     cualquier otro carácter fuera del formato anio-numero se rechaza con 400
 *     sin tocar el disco. El servidor jamás escribe fuera de --datos.
 *  7. Carpeta de datos inaccesible: /api/salud lo informa y toda escritura
 *     falla con un mensaje legible en español, nunca con una excepción cruda.
 *
 * Estructura del directorio de datos:
 *   <datos>/
 *   ├── contador.json              (numeración, protegida por lock)
 *   ├── origen.log                 (origen de cada petición, JSONL)
 *   ├── idx/<id>.json              (índice fragmentado)
 *   └── <anio>/<numero>_Expediente/
 *       ├── datos.json
 *       └── hist/v<N>.json         (snapshot de la versión previa)
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');

const RAIZ = path.resolve(__dirname, '..');
const DIR_APP = path.join(RAIZ, 'app');
const DIR_CONFIG = path.join(RAIZ, 'config');
const VERSION = '1.0.0';
const PUERTO_DEFECTO = 8123;
const LIMITE_CUERPO = 4 * 1024 * 1024; // 4 MB

const APP_CORE = [
  'namespaces.js',
  'config.js',
  'auditoria.js',
  'migraciones.js',
  'utils.js'
];
for (const archivo of APP_CORE) {
  require(path.join(RAIZ, 'app', 'js', 'core', archivo));
}
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));

const SGC = globalThis.SGC;
const repo = SGC.adapters.repo;

// ---------------------------------------------------------------------------
// Escritura atómica
// ---------------------------------------------------------------------------
function escribirTemporal(rutaDestino, contenido) {
  const dir = path.dirname(rutaDestino);
  const tmp = path.join(dir, '.' + path.basename(rutaDestino) + '.' + process.pid + '.tmp');
  fs.writeFileSync(tmp, contenido, { encoding: 'utf8', flag: 'w' });
  return tmp;
}

function reemplazarTemporal(tmp, rutaDestino) {
  fs.renameSync(tmp, rutaDestino);
}

function escribirAtomico(rutaDestino, contenido) {
  const tmp = escribirTemporal(rutaDestino, contenido);
  reemplazarTemporal(tmp, rutaDestino);
}

// ---------------------------------------------------------------------------
// Lock de numeración (ADR-009)
// ---------------------------------------------------------------------------
function atrasar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function adquirirLock(rutaLock, reintentos, esperaMs) {
  for (let i = 0; i < reintentos; i++) {
    try {
      const fd = fs.openSync(rutaLock, 'wx');
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
      if (i < reintentos - 1) {
        atrasar(esperaMs);
      }
    }
  }
  return false;
}

function liberarLock(rutaLock) {
  try {
    fs.unlinkSync(rutaLock);
  } catch (e) {
    // mejor esfuerzo: si el archivo ya no está, el lock está liberado
  }
}

// Sección crítica síncrona: leer contador, incrementar, escribir. La
// serialización real la da el bloque síncrono; el lock wx + reintento es la
// estrategia documentada (ADR-009) para que ningún operador reciba el mismo
// número aunque dos peticiones lleguen a la vez.
function siguienteNumero(datosDir, anio) {
  const rutaContador = path.join(datosDir, 'contador.json');
  const rutaLock = path.join(datosDir, 'contador.lock');
  const lockado = adquirirLock(rutaLock, 20, 10);
  if (!lockado) {
    throw new Error('no se pudo obtener el bloqueo de numeración (contador.lock); reintente');
  }
  try {
    let contador = {};
    if (fs.existsSync(rutaContador)) {
      contador = JSON.parse(fs.readFileSync(rutaContador, 'utf8')).contador || {};
    }
    const actual = typeof contador[anio] === 'number' ? contador[anio] : 0;
    const siguiente = actual + 1;
    contador[anio] = siguiente;
    escribirAtomico(rutaContador, JSON.stringify({ contador: contador }, null, 2));
    return siguiente;
  } finally {
    liberarLock(rutaLock);
  }
}

// ---------------------------------------------------------------------------
// Origen de la petición (ADR-017 medida 3)
// ---------------------------------------------------------------------------
function resolverOrigen(req) {
  const ip = req.socket.remoteAddress || 'desconocido';
  return new Promise((resolve) => {
    const temporizador = setTimeout(() => resolve({ ip, hostname: ip }), 400);
    dns.reverse(ip, (err, nombres) => {
      clearTimeout(temporizador);
      if (!err && nombres && nombres.length > 0) {
        resolve({ ip, hostname: nombres[0] });
      } else {
        resolve({ ip, hostname: ip });
      }
    });
  });
}

function registrarOrigen(datosDir, origen, peticion, id, contexto) {
  const linea = JSON.stringify({
    recibido: new Date().toISOString(),
    ip: origen.ip,
    hostname: origen.hostname,
    metodo: peticion.metodo,
    ruta: peticion.ruta,
    id: id || null,
    contexto: contexto || null
  });
  fs.appendFileSync(path.join(datosDir, 'origen.log'), linea + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function estaDentro(ruta, raiz) {
  const base = path.resolve(raiz);
  const objetivo = path.resolve(ruta);
  return objetivo === base || objetivo.startsWith(base + path.sep);
}

function idDeRuta(req) {
  const ruta = (req.url || '').split('?')[0];
  const partes = ruta.split('/').filter((p) => p.length > 0);
  if (partes.length !== 3 || partes[0] !== 'api' || partes[1] !== 'expedientes') {
    return null;
  }
  const id = partes[2];
  if (!/^\d{4}-\d{3,}$/.test(id)) {
    return null;
  }
  return id;
}

function rutaExpediente(datosDir, id) {
  const anio = id.slice(0, 4);
  const numero = id.slice(5);
  return {
    dir: path.join(datosDir, anio, numero + '_Expediente'),
    datos: path.join(datosDir, anio, numero + '_Expediente', 'datos.json')
  };
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = Buffer.alloc(0);
    req.on('data', (trozo) => {
      datos = Buffer.concat([datos, trozo]);
      if (datos.length > LIMITE_CUERPO) {
        req.destroy();
        reject(new Error('cuerpo de petición demasiado grande (límite ' + LIMITE_CUERPO + ' bytes)'));
      }
    });
    req.on('end', () => resolve(datos.toString('utf8')));
    req.on('error', reject);
  });
}

function parsearCuerpo(texto) {
  if (!texto || texto.trim() === '') {
    return null;
  }
  return JSON.parse(texto);
}

function responderJson(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

function responderErrorEsp(codigoEstado, mensaje) {
  return {
    codigoEstado,
    cuerpo: { error: mensaje }
  };
}

// ---------------------------------------------------------------------------
// Manejadores
// ---------------------------------------------------------------------------
function datosAccesibles(datosDir) {
  const sonda = path.join(datosDir, '.salud-' + process.pid + '.tmp');
  try {
    escribirAtomico(sonda, 'ok');
    fs.unlinkSync(sonda);
    return true;
  } catch (e) {
    try {
      fs.unlinkSync(sonda);
    } catch (e2) {
      // ignorar
    }
    return false;
  }
}

function crearServidor(datosDir) {
  const appDir = DIR_APP;

  function servirEstatico(req, res) {
    const ruta = (req.url || '').split('?')[0];
    let nombre = ruta === '/' ? 'index.html' : ruta;
    let destino;
    try {
      destino = path.join(appDir, nombre);
    } catch (e) {
      return responderJson(res, 400, { error: 'ruta inválida' });
    }
    if (!estaDentro(destino, appDir)) {
      return responderJson(res, 403, { error: 'ruta fuera del área de estáticos' });
    }
    if (!fs.existsSync(destino) || !fs.statSync(destino).isFile()) {
      return responderJson(res, 404, { error: 'recurso no encontrado: ' + nombre });
    }
    const tipo = MIME[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    const contenido = fs.readFileSync(destino);
    res.writeHead(200, { 'Content-Type': tipo });
    res.end(contenido);
  }

  // Padrón de operadores (ADR-017): la app lo necesita para la selección de
  // operador y vive fuera de app/, así que se sirve con su propia guardia de
  // recorrido de rutas.
  function servirConfig(req, res) {
    const ruta = (req.url || '').split('?')[0];
    const nombre = ruta.replace(/^\/config\//, '');
    let destino;
    try {
      destino = path.join(DIR_CONFIG, nombre);
    } catch (e) {
      return responderJson(res, 400, { error: 'ruta inválida' });
    }
    if (!estaDentro(destino, DIR_CONFIG)) {
      return responderJson(res, 403, { error: 'ruta fuera del área de configuración' });
    }
    if (!fs.existsSync(destino) || !fs.statSync(destino).isFile()) {
      return responderJson(res, 404, { error: 'recurso no encontrado: config/' + nombre });
    }
    const tipo = MIME[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo });
    res.end(fs.readFileSync(destino));
  }

  function apiSalud(req, res) {
    const accesible = datosAccesibles(datosDir);
    responderJson(res, 200, {
      ok: true,
      version: VERSION,
      datos: accesible ? 'accesible' : 'inaccesible'
    });
  }

  function apiIndice(req, res) {
    const dirIdx = path.join(datosDir, 'idx');
    const entradas = [];
    if (fs.existsSync(dirIdx)) {
      const archivos = fs.readdirSync(dirIdx).filter((a) => a.endsWith('.json')).sort();
      for (const archivo of archivos) {
        try {
          entradas.push(JSON.parse(fs.readFileSync(path.join(dirIdx, archivo), 'utf8')));
        } catch (e) {
          // un archivo de índice corrupto no debe tumbar el listado
          entradas.push({ id: archivo.replace(/\.json$/, ''), estado: 'INDICE_CORRUPTO' });
        }
      }
    }
    responderJson(res, 200, entradas);
  }

  function apiCrear(req, res, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {datosIniciales, contexto}' });
    }
    const datosIniciales = cuerpo.datosIniciales || {};
    const contexto = cuerpo.contexto || {};
    const anio = repo.anioDe(datosIniciales, contexto) ||
      String(new Date().getFullYear());
    const numero = siguienteNumero(datosDir, anio);
    const id = anio + '-' + repo.rellenar(numero, 3);
    const expediente = repo.construirExpediente(datosIniciales, contexto, id);
    const exp = rutaExpediente(datosDir, id);
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(exp.datos, JSON.stringify(expediente, null, 2));
    const entrada = repo.entradaIndice(id, expediente, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 201, {
      id,
      version: expediente.version,
      expediente
    });
  }

  function apiLeer(req, res, id) {
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const expediente = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    return responderJson(res, 200, { expediente, version: expediente.version });
  }

  function apiGuardar(req, res, id, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' || !cuerpo.expediente || typeof cuerpo.expediente !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {expediente, versionEsperada, contexto}' });
    }
    const expedienteNuevo = cuerpo.expediente;
    const versionEsperada = cuerpo.versionEsperada;
    const contexto = cuerpo.contexto || {};
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    if (actual.version !== versionEsperada) {
      return responderJson(res, 409, {
        conflicto: true,
        versionRemota: actual.version
      });
    }
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'),
      JSON.stringify(actual, null, 2));
    const actualizado = JSON.parse(JSON.stringify(expedienteNuevo));
    actualizado.version = nuevaVersion;
    escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 200, { version: nuevaVersion });
  }

  return http.createServer((req, res) => {
    const ruta = (req.url || '').split('?')[0];
    const peticion = { metodo: req.method, ruta };
    const esRutaApi = ruta === '/api/salud' || ruta === '/api/indice' ||
      ruta === '/api/expedientes' || ruta.startsWith('/api/');

    resolverOrigen(req).then((origen) => {
      try {
        // Salud e índice: sin cuerpo.
        if (req.method === 'GET' && ruta === '/api/salud') {
          registrarOrigen(datosDir, origen, peticion, null, null);
          return apiSalud(req, res);
        }
        if (req.method === 'GET' && ruta === '/api/indice') {
          registrarOrigen(datosDir, origen, peticion, null, null);
          return apiIndice(req, res);
        }

        // Creación: se lee el cuerpo para registrar el contexto recibido.
        if (ruta === '/api/expedientes' && req.method === 'POST') {
          return leerCuerpo(req).then((texto) => {
            let contexto = null;
            try {
              const cuerpo = parsearCuerpo(texto);
              contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
            } catch (e) {
              // el cuerpo inválido lo reporta apiCrear
            }
            registrarOrigen(datosDir, origen, peticion, null, contexto);
            return apiCrear(req, res, texto);
          }).catch((e) => {
            return responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
          });
        }

        // Expediente por id. Un :id que no es anio-numero (por ejemplo con
        // puntos, barras o "..") se rechaza con 400 sin tocar el disco.
        if (ruta.startsWith('/api/expedientes/')) {
          const id = idDeRuta(req);
          if (id === null) {
            registrarOrigen(datosDir, origen, peticion, null, null);
            return responderJson(res, 400, { error: 'id de expediente inválido (recorrido de rutas no permitido)' });
          }
          if (!estaDentro(rutaExpediente(datosDir, id).dir, datosDir)) {
            registrarOrigen(datosDir, origen, peticion, id, null);
            return responderJson(res, 400, { error: 'id de expediente inválido (recorrido de rutas no permitido)' });
          }
          if (req.method === 'GET') {
            registrarOrigen(datosDir, origen, peticion, id, null);
            return apiLeer(req, res, id);
          }
          if (req.method === 'PUT') {
            return leerCuerpo(req).then((texto) => {
              let contexto = null;
              try {
                const cuerpo = parsearCuerpo(texto);
                contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
              } catch (e) {
                // el cuerpo inválido lo reporta apiGuardar
              }
              registrarOrigen(datosDir, origen, peticion, id, contexto);
              return apiGuardar(req, res, id, texto);
            }).catch((e) => {
              return responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
            });
          }
        }

        if (esRutaApi) {
          registrarOrigen(datosDir, origen, peticion, null, null);
          return responderJson(res, 404, { error: 'ruta de API no reconocida: ' + req.method + ' ' + ruta });
        }

        if (ruta.startsWith('/config/')) {
          registrarOrigen(datosDir, origen, peticion, null, null);
          return servirConfig(req, res);
        }

        return servirEstatico(req, res);
      } catch (e) {
        const informe = responderErrorEsp(500, 'error interno del servidor: ' + e.message);
        return responderJson(res, informe.codigoEstado, informe.cuerpo);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
function leerArgumentos(argv) {
  const opciones = { datos: null, puerto: PUERTO_DEFECTO };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) {
      opciones.datos = argv[i + 1];
      i++;
    } else if (argv[i] === '--puerto' && i + 1 < argv.length) {
      opciones.puerto = parseInt(argv[i + 1], 10);
      i++;
    }
  }
  return opciones;
}

function verificarArranque(opciones) {
  if (!opciones.datos) {
    throw new Error('falta el argumento obligatorio --datos <ruta>: la carpeta donde el servidor guarda expedientes e índice');
  }
  if (!fs.existsSync(opciones.datos)) {
    throw new Error('la carpeta de datos no existe: "' + opciones.datos + '". Creela o pase otra ruta con --datos');
  }
  if (!fs.statSync(opciones.datos).isDirectory()) {
    throw new Error('--datos debe apuntar a una carpeta, y "' + opciones.datos + '" es un archivo');
  }
  if (!Number.isInteger(opciones.puerto) || opciones.puerto < 0 || opciones.puerto > 65535) {
    throw new Error('--puerto debe ser un número entre 0 y 65535 (recibido: ' + opciones.puerto + ')');
  }
  const sonda = path.join(opciones.datos, '.arranque-' + process.pid + '.tmp');
  try {
    escribirAtomico(sonda, 'ok');
    fs.unlinkSync(sonda);
  } catch (e) {
    throw new Error('la carpeta de datos no es escribible: "' + opciones.datos + '". Verifique los permisos de la carpeta y su cuenta');
  }
}

function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  try {
    verificarArranque(opciones);
  } catch (e) {
    console.error('servidor: no se pudo arrancar.');
    console.error('servidor: ' + e.message);
    process.exit(1);
  }

  const servidor = crearServidor(opciones.datos);
  servidor.listen(opciones.puerto, () => {
    const puertoReal = servidor.address().port;
    console.log('SGC-SERVIDOR-PUERTO ' + puertoReal);
    console.log('SGC-SERVIDOR-DATOS ' + opciones.datos);
    console.log('SGC-SERVIDOR-LISTO');
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  VERSION,
  escribirTemporal,
  reemplazarTemporal,
  escribirAtomico,
  adquirirLock,
  liberarLock,
  siguienteNumero,
  crearServidor,
  idDeRuta,
  rutaExpediente,
  estaDentro
};

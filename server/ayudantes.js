/*
 * ayudantes.js
 * Infraestructura del servidor SGC, separada de servidor.js por
 * responsabilidad (ORDEN-RONDA-07 §2.2): escritura atómica, lock de
 * numeración (ADR-009), origen de la petición (ADR-017 medida 3), guardia de
 * recorrido de rutas, lectura de cuerpo y respuesta JSON. No depende del
 * dominio (SGC): sólo de node:fs, node:path y node:dns.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');

const LIMITE_CUERPO = 4 * 1024 * 1024; // 4 MB

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

// Id y acción de las rutas de intención (ADR-021), de entregables (§3.3) y de
// presupuestos adjuntos (ORDEN-RONDA-09 §3.2):
//   /api/expedientes/<id>/avanzar
//   /api/expedientes/<id>/devolver
//   /api/expedientes/<id>/entregables
//   /api/expedientes/<id>/presupuestos
// Devuelve null si la ruta no matchea exactamente ese patrón (por ejemplo,
// una acción desconocida o más segmentos, como el ataque "2026-001/../..").
function accionDeRuta(req) {
  const ruta = (req.url || '').split('?')[0];
  const partes = ruta.split('/').filter((p) => p.length > 0);
  if (partes.length !== 4 || partes[0] !== 'api' || partes[1] !== 'expedientes') {
    return null;
  }
  if (partes[3] !== 'avanzar' && partes[3] !== 'devolver' &&
      partes[3] !== 'entregables' && partes[3] !== 'presupuestos') {
    return null;
  }
  const id = partes[2];
  if (!/^\d{4}-\d{3,}$/.test(id)) {
    return null;
  }
  return { id, accion: partes[3] };
}

// Id y nombre de la ruta que enlaza un entregable guardado (§3.3.2):
//   /api/expedientes/<id>/entregables/<nombre>
// El nombre se valida igual que en el POST; con el mismo criterio, una ruta de
// cinco segmentos con un nombre inválido (o con "..") devuelve null y la
// petición cae en el 400 general sin tocar el disco.
function entregableDeRuta(req) {
  const ruta = (req.url || '').split('?')[0];
  const partes = ruta.split('/').filter((p) => p.length > 0);
  if (partes.length !== 5 || partes[0] !== 'api' || partes[1] !== 'expedientes' ||
      partes[3] !== 'entregables') {
    return null;
  }
  const id = partes[2];
  if (!/^\d{4}-\d{3,}$/.test(id)) {
    return null;
  }
  return { id, nombre: partes[4] };
}

function rutaExpediente(datosDir, id) {
  const anio = id.slice(0, 4);
  const numero = id.slice(5);
  return {
    dir: path.join(datosDir, anio, numero + '_Expediente'),
    datos: path.join(datosDir, anio, numero + '_Expediente', 'datos.json')
  };
}

// ---------------------------------------------------------------------------
// Cuerpo y respuesta
// ---------------------------------------------------------------------------
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

module.exports = {
  LIMITE_CUERPO,
  MIME,
  escribirTemporal,
  reemplazarTemporal,
  escribirAtomico,
  adquirirLock,
  liberarLock,
  siguienteNumero,
  resolverOrigen,
  registrarOrigen,
  estaDentro,
  idDeRuta,
  accionDeRuta,
  entregableDeRuta,
  rutaExpediente,
  leerCuerpo,
  parsearCuerpo,
  responderJson,
  responderErrorEsp
};
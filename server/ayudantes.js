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

// Id del expediente de base para reuso (H14, ORDEN-RONDA-13 §4):
//   /api/archivo/<id>/base
// Devuelve el id o null si la ruta no encaja exactamente.
function archivoBaseDeRuta(req) {
  const ruta = (req.url || '').split('?')[0];
  const partes = ruta.split('/').filter((p) => p.length > 0);
  if (partes.length !== 4 || partes[0] !== 'api' || partes[1] !== 'archivo' ||
      partes[3] !== 'base') {
    return null;
  }
  const id = partes[2];
  if (!/^\d{4}-\d{3,}$/.test(id)) {
    return null;
  }
  return id;
}

// Id y acción de las rutas de sugerencias (H19): el único POST adicional es
//   /api/sugerencias/<id>/atender
function sugerenciaDeRuta(req) {
  const ruta = (req.url || '').split('?')[0];
  const partes = ruta.split('/').filter((p) => p.length > 0);
  if (partes.length !== 4 || partes[0] !== 'api' || partes[1] !== 'sugerencias' ||
      partes[3] !== 'atender') {
    return null;
  }
  const id = partes[2];
  if (!/^[\w-]+$/.test(id)) {
    return null;
  }
  return { id, accion: 'atender' };
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
        // ORDEN-RONDA-10-CIERRE §1.2: un cliente legítimo que se pasa el límite
        // tiene derecho a una explicación. En lugar de destruir el socket sin
        // más, se marca el rechazo como 413 y se deja de consumir el cuerpo:
        // responderErrorPeticion() responde primero y la conexión se cierra
        // después de enviar la respuesta (Connection: close).
        const exceso = new Error('el cuerpo de la petición supera el límite de ' +
          Math.round(LIMITE_CUERPO / (1024 * 1024)) + ' MB (' + LIMITE_CUERPO +
          ' bytes); achique el contenido y reintente');
        exceso.codigoEstado = 413;
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume();
        reject(exceso);
      }
    });
    req.on('end', () => resolve(datos.toString('utf8')));
    req.on('error', reject);
  });
}

// Recibe el cuerpo crudo de una petición y lo escribe EN UN ARCHIVO sin
// juntarlo nunca en memoria (ORDEN-RONDA-23 §3): el presupuesto viaja como
// archivo y el servidor lo deja caer al temporal que después se renombra. El
// flujo se frena cuando el disco va más lento (backpressure) y se corta en
// cuanto se pasa del límite, borrando el temporal. Resuelve con los bytes
// recibidos; si el límite se pasa, rechaza con codigoEstado 413 y los bytes
// recibidos y el límite en el error (`recibidos`, `limite`). El mensaje en
// castellano lo arma el dominio (presupuestos.js), que es quien conoce el
// único lugar donde se declara el número (core/limites.js, ORDEN-RONDA-23 §4).
function recibirEnArchivo(req, rutaArchivo, limite) {
  return new Promise((resolve, reject) => {
    const salida = fs.createWriteStream(rutaArchivo);
    let bytes = 0;
    let terminado = false;
    // Tamaño total del archivo, si el cliente lo declaró: sirve para decirle al
    // usuario cuánto pesaba de verdad (el corte del flujo se detecta unos KB
    // más tarde, con el trozo que cruzó el límite).
    const declarado = Number(req.headers['content-length']);
    const tamanoDeclarado = Number.isFinite(declarado) && declarado > 0 ? declarado : null;

    function limpiarTemporal() {
      try {
        fs.unlinkSync(rutaArchivo);
      } catch (e) {
        // mejor esfuerzo: si el temporal ya no está, no hay nada que borrar
      }
    }

    function fallar(e) {
      if (terminado) {
        return;
      }
      terminado = true;
      // En Windows no se puede borrar un archivo con el descriptor abierto: se
      // destruye el stream y recién en su 'close' se borra el temporal, antes
      // de rechazar. Así, cuando el llamador responde, el temporal ya no está.
      salida.on('close', () => {
        limpiarTemporal();
        reject(e);
      });
      salida.destroy();
    }

    req.on('data', (trozo) => {
      if (terminado) {
        return;
      }
      bytes += trozo.length;
      if (bytes > limite) {
        const exceso = new Error('el archivo supera el límite permitido');
        exceso.codigoEstado = 413;
        exceso.recibidos = bytes;
        exceso.limite = limite;
        exceso.tamanoDeclarado = tamanoDeclarado;
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.removeAllListeners('error');
        req.resume();
        fallar(exceso);
        return;
      }
      if (!salida.write(trozo)) {
        req.pause();
        salida.once('drain', () => {
          if (!terminado) {
            req.resume();
          }
        });
      }
    });
    req.on('end', () => {
      if (terminado) {
        return;
      }
      salida.end(() => {
        if (!terminado) {
          terminado = true;
          resolve({ bytes });
        }
      });
    });
    req.on('error', fallar);
    salida.on('error', fallar);
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

// Rechazo de una petición cuyo cuerpo no se pudo leer (ORDEN-RONDA-10-CIERRE
// §1.2). Un error marcado con codigoEstado (el 413 del límite de cuerpo)
// responde con ese código y Connection: close, de modo que la explicación
// llegue al cliente antes de que se corte la conexión; el resto sigue siendo
// el 400 genérico de siempre.
function responderErrorPeticion(res, e) {
  // RONDA-17 §5: nada del error del sistema llega al usuario; el mensaje
  // cierra en los nuestros (el detalle queda para el registro del operador).
  const codigoEstado = e && e.codigoEstado ? e.codigoEstado : 400;
  if (codigoEstado === 413) {
    res.writeHead(codigoEstado, {
      'Content-Type': 'application/json; charset=utf-8',
      'Connection': 'close'
    });
    res.end(JSON.stringify({ error: 'la petición supera el límite de tamaño permitido: achique el contenido' }));
    return;
  }
  responderJson(res, codigoEstado, { error: 'no se pudo procesar la petición' });
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
  archivoBaseDeRuta,
  sugerenciaDeRuta,
  rutaExpediente,
  leerCuerpo,
  recibirEnArchivo,
  parsearCuerpo,
  responderJson,
  responderErrorEsp,
  responderErrorPeticion
};
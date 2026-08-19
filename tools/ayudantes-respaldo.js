/*
 * ayudantes-respaldo.js
 * ORDEN-RONDA-08 §2.3. Infraestructura compartida de tools/respaldo.js y
 * tools/restaurar.js: copia recursiva sin dependencias, lock de respaldo,
 * nombres de respaldo y retención. No depende de SGC: sólo de node:fs y
 * node:path.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PREFIJO = 'sgc-respaldo-';
const PREFIJO_TEMP = '.tmp-respaldo-';
const LOCK = '.respaldo.lock';

// Copia recursiva de una carpeta (los datos del SGC son carpetas y JSON).
function copiarCarpeta(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  const entradas = fs.readdirSync(origen, { withFileTypes: true });
  for (const entrada of entradas) {
    const desde = path.join(origen, entrada.name);
    const hasta = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      copiarCarpeta(desde, hasta);
    } else if (entrada.isFile()) {
      fs.copyFileSync(desde, hasta);
    }
  }
}

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

// "sgc-respaldo-2026-08-19.143512875": fecha de calendario y hora de creación
// con milisegundos, para que dos respaldos lanzados en el mismo segundo no
// colisionen en el rename atómico.
function nombreRespaldo(ahora) {
  const p = (n, largo) => String(n).padStart(largo, '0');
  const fecha = ahora.getFullYear() + '-' + p(ahora.getMonth() + 1, 2) + '-' + p(ahora.getDate(), 2);
  const hora = p(ahora.getHours(), 2) + p(ahora.getMinutes(), 2) +
    p(ahora.getSeconds(), 2) + p(ahora.getMilliseconds(), 3);
  return PREFIJO + fecha + '.' + hora;
}

function esRespaldo(nombre) {
  return typeof nombre === 'string' && nombre.indexOf(PREFIJO) === 0;
}

// Lista los respaldos existentes en destino, del más nuevo al más viejo.
function listarRespaldos(destino) {
  const resultado = [];
  if (!fs.existsSync(destino)) {
    return resultado;
  }
  const entradas = fs.readdirSync(destino, { withFileTypes: true });
  for (const entrada of entradas) {
    if (entrada.isDirectory() && esRespaldo(entrada.name)) {
      resultado.push(entrada.name);
    }
  }
  resultado.sort().reverse();
  return resultado;
}

// Borra los respaldos que excedan `retener`, del más viejo al más nuevo.
// Con retener <= 0 se conservan todos (sin límite de retención).
function podar(destino, retener) {
  const lista = listarRespaldos(destino);
  if (retener <= 0) {
    return lista;
  }
  for (let i = retener; i < lista.length; i++) {
    fs.rmSync(path.join(destino, lista[i]), { recursive: true, force: true });
  }
  return lista.slice(0, retener);
}

// Crea un respaldo de datosDir en destino con lock y rename atómico. Devuelve
// el informe: { nombre, ruta, retenidos, eliminados }.
function crearRespaldo(datosDir, destino, retener) {
  if (!fs.existsSync(datosDir)) {
    throw new Error('la carpeta de datos no existe: "' + datosDir + '"');
  }
  fs.mkdirSync(destino, { recursive: true });
  const rutaLock = path.join(destino, LOCK);
  const lockado = adquirirLock(rutaLock, 30, 50);
  if (!lockado) {
    throw new Error('no se pudo obtener el bloqueo de respaldo (' + LOCK + '); otro respaldo en curso, reintente');
  }
  try {
    const nombre = nombreRespaldo(new Date());
    const rutaFinal = path.join(destino, nombre);
    const rutaTemp = path.join(destino, PREFIJO_TEMP + process.pid + '-' + nombre);
    copiarCarpeta(datosDir, rutaTemp);
    // Punto de commit: el rename deja el respaldo completo o no queda nada.
    fs.renameSync(rutaTemp, rutaFinal);
    const listaAntes = listarRespaldos(destino);
    const retenidos = podar(destino, retener);
    const eliminados = listaAntes.slice(retener);
    return { nombre, ruta: rutaFinal, retenidos, eliminados };
  } finally {
    liberarLock(rutaLock);
  }
}

// Restaura el contenido de un respaldo en destino (creándolo si hace falta).
// Cada archivo se copia por encima del que haya; el operador debe apuntar a
// una carpeta de datos vacía o descartable.
function restaurarRespaldo(origen, destino) {
  if (!fs.existsSync(origen)) {
    throw new Error('el respaldo no existe: "' + origen + '"');
  }
  if (!fs.statSync(origen).isDirectory() || !esRespaldo(path.basename(origen))) {
    throw new Error('el origen no parece un respaldo SGC (debe llamarse ' + PREFIJO + '...): "' + origen + '"');
  }
  fs.mkdirSync(destino, { recursive: true });
  copiarCarpeta(origen, destino);
  return { origen, destino };
}

module.exports = {
  PREFIJO,
  copiarCarpeta,
  adquirirLock,
  liberarLock,
  nombreRespaldo,
  esRespaldo,
  listarRespaldos,
  podar,
  crearRespaldo,
  restaurarRespaldo
};
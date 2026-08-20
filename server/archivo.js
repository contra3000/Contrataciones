/*
 * archivo.js
 * Archivo Histórico del SGC (ORDEN-RONDA-08 §2.2).
 *
 * Cuando un expediente llega a PERFECCIONADA (el estado final), el servidor lo
 * archiva automáticamente como parte de la misma transición: se copia la
 * carpeta del expediente a `ArchivoHistorico/<anio>/<numero>_Expediente/`
 * usando un staging y un rename atómico como punto de commit (nunca queda un
 * archivo histórico a medias), el original se marca (`archivado: true`,
 * `archivadoEn` y una entrada de auditoría `archivar` encadenada) y su entrada
 * del índice se purga. El original no se borra jamás.
 *
 * `recuperarArchivados` corre al arrancar del servidor y cierra cualquier
 * interrupción: un staging abandonado se limpia, un original cuyo histórico ya
 * existe se marca y un índice huérfano se purga. `GET /api/archivo` lee el
 * directorio (no el índice), así el histórico no depende del estado del índice
 * fragmentado.
 *
 * La marca no cambia la versión: la transición que llega al final ya la subió.
 * Sólo depende de node:fs, node:path y SGC.core.auditoria (cargado por
 * servidor.js antes de crear el servidor).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { rutaExpediente, escribirAtomico, responderJson } = require('./ayudantes.js');

function raizArchivo(datosDir, id) {
  const anio = id.slice(0, 4);
  const numero = id.slice(5);
  return {
    raiz: path.join(datosDir, 'ArchivoHistorico'),
    anio: path.join(datosDir, 'ArchivoHistorico', anio),
    staging: path.join(datosDir, 'ArchivoHistorico', anio, '.staging-' + numero),
    destino: path.join(datosDir, 'ArchivoHistorico', anio, numero + '_Expediente')
  };
}

function existeHistorico(datosDir, id) {
  return fs.existsSync(raizArchivo(datosDir, id).destino);
}

function purgarIndice(datosDir, id) {
  const archivo = path.join(datosDir, 'idx', id + '.json');
  if (fs.existsSync(archivo)) {
    fs.unlinkSync(archivo);
  }
}

// Copia recursiva de una carpeta (sin dependencias). El servidor ya garantiza
// que los nombres de carpeta son planos; acá se copia todo el contenido tal
// cual (datos.json, entregables e hist).
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

// Marca un expediente como archivado sin tocar la versión: agrega los campos
// `archivado`/`archivadoEn` y encadena la entrada de auditoría `archivar` con
// el hash previo, igual que el resto de la cadena (ADR-006).
function marcarArchivado(expediente, contexto) {
  const c = contexto || {};
  const copia = JSON.parse(JSON.stringify(expediente));
  copia.archivado = true;
  copia.archivadoEn = typeof c.timestamp === 'string' ? c.timestamp : null;
  const ultima = copia.auditoria && copia.auditoria.length > 0
    ? copia.auditoria[copia.auditoria.length - 1] : null;
  const entrada = globalThis.SGC.core.auditoria.crearEntrada(ultima, {
    timestamp: c.timestamp,
    email: c.email,
    rol: c.rol,
    equipo: c.equipo,
    origen: c.origen,
    accion: 'archivar',
    de: copia.estado ? copia.estado.id : null,
    a: null,
    motivo: null,
    observacion: null
  });
  if (!Array.isArray(copia.auditoria)) {
    copia.auditoria = [];
  }
  copia.auditoria.push(entrada);
  if (typeof c.timestamp === 'string') {
    if (typeof copia.actualizado === 'string') {
      copia.actualizado = c.timestamp;
    }
    if (typeof copia.ultimaModificacion === 'string') {
      copia.ultimaModificacion = c.timestamp;
    }
  }
  if (typeof c.email === 'string' && typeof copia.ultimoUsuario === 'string') {
    copia.ultimoUsuario = c.email;
  }
  return copia;
}

// Contexto sintético para la marca de recuperación del arranque: no hay un
// operador real atrás, pero la entrada de auditoría necesita los campos que la
// cadena serializa (timestamp, email, rol, equipo, origen).
function contextoRecuperacion() {
  return {
    timestamp: new Date().toISOString(),
    email: null,
    rol: null,
    equipo: 'SGC-SERVIDOR',
    origen: { ip: 'recuperacion', hostname: 'servidor-sgc' }
  };
}

// Archiva un expediente desde el estado de disco actual. Idempotente: si el
// histórico ya existe, sólo se marca y se purga el índice. Devuelve el
// expediente marcado (con la entrada `archivar` ya encadenada).
function archivarExpediente(datosDir, id, contexto) {
  const exp = rutaExpediente(datosDir, id);
  if (!fs.existsSync(exp.datos)) {
    const e = new Error('expediente no encontrado: ' + id);
    e.codigo = 'NO_ENCONTRADO';
    throw e;
  }
  const expediente = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
  if (expediente.archivado === true) {
    purgarIndice(datosDir, id);
    return expediente;
  }
  const raiz = raizArchivo(datosDir, id);
  if (!fs.existsSync(raiz.destino)) {
    // Copia a staging y rename atómico: el punto de commit. Si el proceso cae
    // antes del rename queda un `.staging-*` que la recuperación del arranque
    // limpia; si cae después, el histórico ya existe y este bloque se saltea.
    if (fs.existsSync(raiz.staging)) {
      fs.rmSync(raiz.staging, { recursive: true, force: true });
    }
    fs.mkdirSync(raiz.anio, { recursive: true });
    copiarCarpeta(exp.dir, raiz.staging);
    fs.renameSync(raiz.staging, raiz.destino);
  }
  const marcado = marcarArchivado(expediente, contexto);
  fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
  escribirAtomico(path.join(exp.dir, 'hist', 'v' + expediente.version + '.json'),
    JSON.stringify(expediente, null, 2));
  escribirAtomico(exp.datos, JSON.stringify(marcado, null, 2));
  // La copia histórica es un snapshot del estado final: se escribe también la
  // versión marcada (la marca no cambia la versión), así la entrada del
  // /api/archivo lleva archivadoEn y la auditoría completa del cierre.
  escribirAtomico(path.join(raiz.destino, 'datos.json'), JSON.stringify(marcado, null, 2));
  purgarIndice(datosDir, id);
  return marcado;
}

// Recuperación del arranque: cierra cualquier archivo interrumpido.
function recuperarArchivados(datosDir) {
  const raiz = raizArchivo(datosDir, '0000-000').raiz;
  if (!fs.existsSync(raiz)) {
    return;
  }
  const anios = fs.readdirSync(raiz, { withFileTypes: true });
  for (const anioDir of anios) {
    if (!anioDir.isDirectory() || anioDir.name.startsWith('.')) {
      continue;
    }
    const dirAnio = path.join(raiz, anioDir.name);
    const carpetas = fs.readdirSync(dirAnio, { withFileTypes: true });
    for (const carpeta of carpetas) {
      if (!carpeta.isDirectory()) {
        continue;
      }
      if (carpeta.name.startsWith('.staging-')) {
        fs.rmSync(path.join(dirAnio, carpeta.name), { recursive: true, force: true });
        continue;
      }
      const numero = carpeta.name.replace(/_Expediente$/, '');
      const id = anioDir.name + '-' + numero;
      const exp = rutaExpediente(datosDir, id);
      if (fs.existsSync(exp.datos)) {
        const original = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
        if (original.archivado !== true) {
          const marcado = marcarArchivado(original, contextoRecuperacion());
          escribirAtomico(exp.datos, JSON.stringify(marcado, null, 2));
          // La copia histórica se alinea con la marca del original.
          escribirAtomico(path.join(dirAnio, carpeta.name, 'datos.json'),
            JSON.stringify(marcado, null, 2));
        }
      }
      purgarIndice(datosDir, id);
    }
  }
  // Índice huérfano: el histórico ya existe pero la purga no llegó a correr.
  const dirIdx = path.join(datosDir, 'idx');
  if (fs.existsSync(dirIdx)) {
    const archivos = fs.readdirSync(dirIdx);
    for (const archivo of archivos) {
      const id = archivo.replace(/\.json$/, '');
      if (existeHistorico(datosDir, id)) {
        purgarIndice(datosDir, id);
      }
    }
  }
}

// GET /api/archivo: lee el directorio ArchivoHistorico, no el índice. Cada
// entrada repite el formato del índice (repo.entradaIndice) más `archivadoEn`.
function apiArchivo(datosDir, repo) {
  return function (req, res) {
    const raiz = raizArchivo(datosDir, '0000-000').raiz;
    const resultado = [];
    if (fs.existsSync(raiz)) {
      const anios = fs.readdirSync(raiz, { withFileTypes: true });
      for (const anioDir of anios) {
        if (!anioDir.isDirectory() || anioDir.name.startsWith('.')) {
          continue;
        }
        const dirAnio = path.join(raiz, anioDir.name);
        const carpetas = fs.readdirSync(dirAnio, { withFileTypes: true });
        for (const carpeta of carpetas) {
          if (!carpeta.isDirectory() || carpeta.name.startsWith('.')) {
            continue;
          }
          const datosArchivo = path.join(dirAnio, carpeta.name, 'datos.json');
          if (!fs.existsSync(datosArchivo)) {
            continue;
          }
          const numero = carpeta.name.replace(/_Expediente$/, '');
          const id = anioDir.name + '-' + numero;
          const expediente = JSON.parse(fs.readFileSync(datosArchivo, 'utf8'));
          const entrada = repo.entradaIndice(id, expediente, {});
          entrada.archivadoEn = typeof expediente.archivadoEn === 'string'
            ? expediente.archivadoEn : null;
          resultado.push(entrada);
        }
      }
    }
    resultado.sort(function (a, b) {
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return responderJson(res, 200, { expedientes: resultado });
  };
}

module.exports = {
  raizArchivo,
  existeHistorico,
  purgarIndice,
  copiarCarpeta,
  marcarArchivado,
  archivarExpediente,
  recuperarArchivados,
  apiArchivo
};
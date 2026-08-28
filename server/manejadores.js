/*
 * manejadores.js
 * Manejadores HTTP genéricos del servidor SGC (ORDEN-RONDA-07 §2.2):
 * estáticos, config, salud, índice y validación de códigos. Los manejadores
 * del expediente (creación, PUT, transiciones ADR-021 y entregables §3.3)
 * viven en expedientes.js. Ambos reciben el mismo entorno en su fábrica y
 * servidor.js los compone en el router.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_CODIGOS_POR_LLAMADA = 1000;

function crearManejadores(entorno) {
  const {
    datosDir,
    VERSION,
    DIR_APP,
    DIR_CONFIG,
    ayudantes
  } = entorno;
  const {
    MIME,
    escribirAtomico,
    estaDentro,
    parsearCuerpo,
    responderJson
  } = ayudantes;

  function servirEstatico(req, res) {
    const ruta = (req.url || '').split('?')[0];
    let nombre = ruta === '/' ? 'index.html' : ruta;
    let destino;
    try {
      destino = path.join(DIR_APP, nombre);
    } catch (e) {
      return responderJson(res, 400, { error: 'ruta inválida' });
    }
    if (!estaDentro(destino, DIR_APP)) {
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

  function datosAccesibles() {
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

  function apiSalud(req, res) {
    responderJson(res, 200, {
      ok: true,
      version: VERSION,
      // ORDEN-RONDA-14 §3.4: el cliente decide la pantalla de ingreso desde
      // aquí — el modo autenticado es del servidor, no de la config.
      autenticado: !!(entorno.capaSesion && entorno.capaSesion.esModoAutenticado()),
      datos: datosAccesibles() ? 'accesible' : 'inaccesible'
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

  // Catálogo en memoria para validar códigos (ORDEN-RONDA-06 §2.2). Se carga
  // perezosamente en la primera llamada y se cachea: el cliente ya no baja
  // codigos.json, la validación de existencia vive del lado del servidor.
  let catalogoCache = null;
  function cargarCatalogo() {
    if (catalogoCache) {
      return catalogoCache;
    }
    const dirItems = path.join(DIR_APP, 'catalogo', 'items');
    if (!fs.existsSync(dirItems)) {
      return null;
    }
    let version = null;
    try {
      const manifiesto = JSON.parse(fs.readFileSync(path.join(DIR_APP, 'catalogo', 'manifiesto.json'), 'utf8'));
      version = manifiesto.catalogoVersion || null;
    } catch (e) {
      version = null;
    }
    const codigos = new Set();
    for (const archivo of fs.readdirSync(dirItems)) {
      if (!archivo.endsWith('.json')) {
        continue;
      }
      const items = JSON.parse(fs.readFileSync(path.join(dirItems, archivo), 'utf8'));
      for (const item of items) {
        if (item && typeof item.codigo === 'string') {
          codigos.add(item.codigo);
        }
      }
    }
    catalogoCache = { version, codigos };
    return catalogoCache;
  }

  function apiValidarCodigos(req, res, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || !Array.isArray(cuerpo.codigos)) {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {codigos: [...]}' });
    }
    if (cuerpo.codigos.length > MAX_CODIGOS_POR_LLAMADA) {
      return responderJson(res, 400, {
        error: 'la lista supera el máximo de ' + MAX_CODIGOS_POR_LLAMADA + ' códigos por llamada'
      });
    }
    for (const codigo of cuerpo.codigos) {
      if (typeof codigo !== 'string') {
        return responderJson(res, 400, { error: 'cada código debe ser una cadena' });
      }
    }
    const catalogo = cargarCatalogo();
    if (!catalogo) {
      return responderJson(res, 503, { error: 'el catálogo no está disponible en el servidor' });
    }
    const invalidos = [];
    const vistos = new Set();
    for (const codigo of cuerpo.codigos) {
      if (!catalogo.codigos.has(codigo) && !vistos.has(codigo)) {
        vistos.add(codigo);
        invalidos.push(codigo);
      }
    }
    return responderJson(res, 200, { invalidos: invalidos, catalogoVersion: catalogo.version });
  }

  return {
    servirEstatico,
    servirConfig,
    apiSalud,
    apiIndice,
    apiValidarCodigos,
    cargarCatalogo
  };
}

module.exports = {
  MAX_CODIGOS_POR_LLAMADA,
  crearManejadores
};
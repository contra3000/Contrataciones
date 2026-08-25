/*
 * presupuestos.js
 * Manejador de presupuestos adjuntos (ORDEN-RONDA-09 §3.2), separado de
 * expedientes.js por responsabilidad (misma partición que ORDEN-RONDA-07
 * §2.2): la subida de archivos es un tema propio y el archivo estaba
 * quedando grande para el límite de 400 líneas.
 *
 * PDF o imagen, con un tope de 2 MB por archivo. El límite convive con el
 * tope de 4 MB del cuerpo (base64 infla ~33%) y es lo que se documenta como
 * límite del presupuesto.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// El nombre del archivo en disco lo decide el servidor (`presupuesto-<n>.<ext>`),
// nunca el cliente: un nombre que venga del usuario es una vía de recorrido de
// rutas. Cada presupuesto lleva un id estable porque los valores de referencia
// lo citan; la escritura es atómica y versionada.
const TIPOS_PRESUPUESTO = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg'
};
const LIMITE_PRESUPUESTO = 2 * 1024 * 1024;

function crearManejadoresPresupuestos(entorno) {
  const { datosDir, repo, ayudantes } = entorno;
  const {
    escribirAtomico,
    estaDentro,
    rutaExpediente,
    parsearCuerpo,
    responderJson
  } = ayudantes;

  function apiGuardarPresupuesto(req, res, id, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.nombreOriginal !== 'string' ||
        typeof cuerpo.tipo !== 'string' || typeof cuerpo.contenido !== 'string') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {nombreOriginal, tipo, contenido, contexto}' });
    }
    const extension = TIPOS_PRESUPUESTO[cuerpo.tipo];
    if (!extension) {
      return responderJson(res, 400, { error: 'tipo de archivo no permitido: "' + cuerpo.tipo + '". Se admiten PDF e imágenes (application/pdf, image/png, image/jpeg)' });
    }
    const base64Limpio = String(cuerpo.contenido).replace(/\s+/g, '');
    if (base64Limpio.length === 0) {
      return responderJson(res, 400, { error: 'el contenido del presupuesto está vacío' });
    }
    // Buffer.from(..., 'base64') ignora en silencio los caracteres ajenos al
    // alfabeto: "no-es-base64!!!" decodifica a bytes. Se exige el alfabeto
    // estricto para no aceptar basura como archivo.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Limpio)) {
      return responderJson(res, 400, { error: 'el contenido del presupuesto no es base64 válido' });
    }
    let buffer = null;
    try {
      buffer = Buffer.from(base64Limpio, 'base64');
    } catch (e) {
      return responderJson(res, 400, { error: 'el contenido del presupuesto no es base64 válido' });
    }
    if (buffer.length === 0) {
      return responderJson(res, 400, { error: 'el contenido del presupuesto no es base64 válido' });
    }
    if (buffer.length > LIMITE_PRESUPUESTO) {
      return responderJson(res, 400, { error: 'el presupuesto excede el límite de ' + Math.round(LIMITE_PRESUPUESTO / (1024 * 1024)) + ' MB' });
    }
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const contexto = cuerpo.contexto || {};
    const numero = (Array.isArray(actual.presupuestos) ? actual.presupuestos : []).length + 1;
    const archivo = 'presupuesto-' + numero + '.' + extension;
    const ruta = path.join(exp.dir, 'presupuestos', archivo);
    if (!estaDentro(ruta, exp.dir)) {
      return responderJson(res, 400, { error: 'recorrido de rutas no permitido' });
    }
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    fs.mkdirSync(path.join(exp.dir, 'presupuestos'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
    escribirAtomico(ruta, buffer);
    const actualizado = JSON.parse(JSON.stringify(actual));
    actualizado.version = nuevaVersion;
    if (!Array.isArray(actualizado.presupuestos)) {
      actualizado.presupuestos = [];
    }
    actualizado.presupuestos.push({
      id: 'presupuesto-' + numero,
      nombreOriginal: String(cuerpo.nombreOriginal).slice(0, 200),
      archivo: archivo,
      ruta: 'presupuestos/' + archivo,
      tipo: cuerpo.tipo,
      peso: buffer.length,
      subido: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
      email: typeof contexto.email === 'string' ? contexto.email : null,
      equipo: typeof contexto.equipo === 'string' ? contexto.equipo : null
    });
    if (typeof contexto.timestamp === 'string') {
      if (typeof actualizado.actualizado === 'string') { actualizado.actualizado = contexto.timestamp; }
      if (typeof actualizado.ultimaModificacion === 'string') { actualizado.ultimaModificacion = contexto.timestamp; }
    }
    if (typeof contexto.email === 'string' && typeof actualizado.ultimoUsuario === 'string') {
      actualizado.ultimoUsuario = contexto.email;
    }
    escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true }); escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 201, { id: 'presupuesto-' + numero, archivo: archivo, ruta: 'presupuestos/' + archivo, peso: buffer.length, version: nuevaVersion });
  }

  return {
    apiGuardarPresupuesto
  };
}

module.exports = {
  crearManejadoresPresupuestos
};

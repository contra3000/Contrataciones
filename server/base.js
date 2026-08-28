/*
 * base.js
 * ORDEN-RONDA-13 §4 (ADR-025). Reuso de un expediente perfeccionado como base
 * de uno nuevo.
 *
 * La fuente es el datos.json íntegro del Archivo Histórico. La copia es por
 * LISTA BLANCA (ADR-025 §1): viajan los renglones (código, descripción,
 * unidad, cantidad, aclaración, máximos y mínimos de OCA), el objeto, la
 * justificación de la necesidad, las especificaciones técnicas, el rubro
 * comercial, la modalidad y el procedimiento sugeridos. No viaja nada del
 * hecho consumado del viejo: número, fechas, estado, auditoría, eventos,
 * entregables, presupuestos adjuntos, valores de referencia, imputación ni
 * precios. Los códigos se revalidan contra el catálogo vigente (ADR-025 §4):
 * un ítem dado de baja se marca en la propuesta y bloquea el POST, nunca se
 * copia en silencio.
 *
 * El origen no se toca (ADR-025 §6): se lee y no se escribe nada sobre su
 * carpeta.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Etiqueta schemaVersion a número (migraciones.js tolera número y "2.0.0".
// Un documento sin la etiqueta o ilegible devuelve null: NO es el esquema
// vigente y no puede servir de base).
function numeroDeVersion(etiqueta) {
  if (typeof etiqueta === 'number') {
    return etiqueta;
  }
  if (typeof etiqueta === 'string') {
    const n = parseInt(etiqueta, 10);
    if (String(n) !== etiqueta && etiqueta.indexOf('.') !== -1) {
      return parseInt(etiqueta.split('.')[0], 10);
    }
    return n;
  }
  return null;
}

function crearManejadoresBase(entorno) {
  const {
    datosDir,
    repo,
    ayudantes,
    eventos,
    cargarCatalogo
  } = entorno;
  const {
    rutaExpediente,
    escribirAtomico,
    parsearCuerpo,
    responderJson
  } = ayudantes;

  const SGC = globalThis.SGC;

  // Lista blanca de un renglón (ADR-025 §1): los siete campos, y nada más.
  const RENGLON_BLANCO = ['codigo', 'descripcion', 'cantidad', 'unidad',
    'aclaracion', 'cantidadMaxima', 'cantidadMinima'];

  function copiarRenglon(r) {
    const salida = {};
    for (const campo of RENGLON_BLANCO) {
      const valor = r[campo];
      if (valor === undefined || valor === null) {
        continue;
      }
      salida[campo] = valor;
    }
    if (!salida.descripcion && typeof r.item === 'string') {
      salida.descripcion = r.item;
    }
    return salida;
  }

  // Lista blanca del expediente (ADR-025 §1): el resto del datos.json no sale.
  function construirPropuesta(expediente) {
    const rq = expediente.requerimiento || {};
    const objeto = rq.objeto || expediente.titulo || '';
    return {
      id: expediente.expedienteId || null,
      titulo: objeto,
      objeto: objeto,
      justificacion: rq.justificacionNecesidad || null,
      rubroCodigo: rq.rubroCodigo || null,
      rubroDescripcion: rq.rubroDescripcion || null,
      modalidadCompra: rq.modalidadCompra || null,
      procedimientoSeleccion: rq.procedimientoSeleccion || null,
      condicionesParticulares: rq.condicionesParticulares || null,
      renglones: (Array.isArray(expediente.renglones) ? expediente.renglones : [])
        .map(copiarRenglon)
    };
  }

  // Elegibilidad (ADR-025): sólo un expediente perfeccionado y archivado, y
  // sólo del esquema vigente. ORDEN-RONDA-14 §2.1: un origen viejo (o sin la
  // etiqueta) se rechaza con la explicación; migrarlo primero es trabajo del
  // que lo custodia, no del reuso.
  function origenError(expediente) {
    if (!expediente) {
      return 'expediente no encontrado';
    }
    const version = numeroDeVersion(expediente.schemaVersion);
    const actual = SGC.core.migraciones && SGC.core.migraciones.VERSION_ACTUAL;
    if (Number.isFinite(actual) && version !== actual) {
      return 'el expediente origen está en el esquema ' +
        (version === null ? 'sin declarar' : version) + ' y el servidor solo usa base con schemaVersion ' +
        actual + ': migre el documento antes de reusarlo';
    }
    if (!(expediente.estado && expediente.estado.id === SGC.core.config.ESTADO_FINAL)) {
      return 'solo un expediente perfeccionado puede usarse como base (estado: ' +
        (expediente.estado && expediente.estado.id || 'sin estado') + ')';
    }
    if (expediente.archivado !== true) {
      return 'el expediente debe estar archivado para usarse como base';
    }
    return null;
  }

  // Revalidación (ADR-025 §4): un código que ya no está en el catálogo
  // vigente se marca; no se copia en silencio ni se deja pasar en el POST.
  function revalidar(propuesta, catalogo) {
    const invalidos = [];
    const renglones = [];
    for (const r of propuesta.renglones) {
      const copia = Object.assign({}, r);
      if (!catalogo || !catalogo.codigos.has(r.codigo)) {
        copia.dadoDeBaja = true;
        invalidos.push(r.codigo);
      }
      renglones.push(copia);
    }
    return { renglones, codigosInvalidos: invalidos };
  }

  function apiLeerBase(req, res, id) {
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const expediente = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const motivo = origenError(expediente);
    if (motivo) {
      return responderJson(res, 400, { error: motivo });
    }
    const catalogo = cargarCatalogo ? cargarCatalogo() : null;
    if (!catalogo) {
      return responderJson(res, 503, { error: 'el catálogo no está disponible en el servidor' });
    }
    const propuesta = construirPropuesta(expediente);
    const validada = revalidar(propuesta, catalogo);
    return responderJson(res, 200, {
      id: propuesta.id,
      titulo: propuesta.titulo,
      objeto: propuesta.objeto,
      justificacion: propuesta.justificacion,
      rubroCodigo: propuesta.rubroCodigo,
      rubroDescripcion: propuesta.rubroDescripcion,
      modalidadCompra: propuesta.modalidadCompra,
      procedimientoSeleccion: propuesta.procedimientoSeleccion,
      condicionesParticulares: propuesta.condicionesParticulares,
      renglones: validada.renglones,
      codigosInvalidos: validada.codigosInvalidos,
      catalogoVersion: catalogo.version
    });
  }

  function apiCrearBase(req, res, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {origenId, indices, contexto}' });
    }
    const origenId = typeof cuerpo.origenId === 'string' ? cuerpo.origenId : null;
    if (!origenId || !/^\d{4}-\d{3,}$/.test(origenId)) {
      return responderJson(res, 400, { error: 'origenId inválido: ' + origenId });
    }
    if (!Array.isArray(cuerpo.indices)) {
      return responderJson(res, 400, { error: 'indices debe ser una lista de posiciones de renglón' });
    }
    const contexto = cuerpo.contexto || {};
    const exp = rutaExpediente(datosDir, origenId);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente origen no encontrado: ' + origenId });
    }
    const origen = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const motivo = origenError(origen);
    if (motivo) {
      return responderJson(res, 400, { error: motivo });
    }
    const catalogo = cargarCatalogo ? cargarCatalogo() : null;
    if (!catalogo) {
      return responderJson(res, 503, { error: 'el catálogo no está disponible en el servidor' });
    }
    const propuesta = construirPropuesta(origen);
    const validada = revalidar(propuesta, catalogo);
    if (validada.codigosInvalidos.length > 0) {
      return responderJson(res, 400, {
        error: 'renglones dados de baja en el catálogo vigente, reemplácelos antes de crear: ' +
          validada.codigosInvalidos.join(', ')
      });
    }
    const seleccionados = [];
    for (const indice of cuerpo.indices) {
      if (!Number.isInteger(indice) || indice < 0 || indice >= validada.renglones.length) {
        return responderJson(res, 400, { error: 'indice de renglón fuera de rango: ' + indice });
      }
      seleccionados.push(validada.renglones[indice]);
    }
    if (seleccionados.length === 0) {
      return responderJson(res, 400, { error: 'al menos un renglón debe seleccionarse' });
    }
    const errores = [];
    for (let i = 0; i < seleccionados.length; i++) {
      const v = SGC.core.validacion.validarRenglon(seleccionados[i]);
      if (!v.valido) {
        errores.push('Renglón ' + (i + 1) + ': ' + v.errores.join(' · '));
      }
    }
    if (errores.length > 0) {
      return responderJson(res, 400, { error: errores.join(' · ') });
    }
    const anio = String(new Date().getFullYear());
    const numero = ayudantes.siguienteNumero(datosDir, anio);
    const id = anio + '-' + repo.rellenar(numero, 3);
    const datosIniciales = {
      titulo: propuesta.titulo,
      anio: anio,
      renglones: seleccionados,
      requerimiento: {
        objeto: propuesta.objeto,
        justificacionNecesidad: propuesta.justificacion || '',
        condicionesParticulares: propuesta.condicionesParticulares || '',
        rubroCodigo: propuesta.rubroCodigo || '',
        rubroDescripcion: propuesta.rubroDescripcion || '',
        modalidadCompra: propuesta.modalidadCompra || '',
        procedimientoSeleccion: propuesta.procedimientoSeleccion || ''
      }
    };
    const expediente = repo.construirExpediente(datosIniciales, contexto, id);
    expediente.basadoEn = origenId;
    const nuevo = rutaExpediente(datosDir, id);
    fs.mkdirSync(path.join(nuevo.dir, 'hist'), { recursive: true });
    escribirAtomico(nuevo.datos, JSON.stringify(expediente, null, 2));
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'),
      JSON.stringify(repo.entradaIndice(id, expediente, contexto), null, 2));
    if (eventos && typeof eventos.registrarTransicion === 'function') {
      eventos.registrarTransicion(datosDir, id, null, SGC.core.config.ESTADO_INICIAL, contexto);
    }
    if (eventos && typeof eventos.registrarReuso === 'function') {
      eventos.registrarReuso(datosDir, id, origenId, contexto);
    }
    return responderJson(res, 201, { id: id, version: expediente.version, expediente: expediente });
  }

  return {
    apiLeerBase,
    apiCrearBase
  };
}

module.exports = {
  crearManejadoresBase
};
/*
 * sco.js
 * ORDEN-RONDA-27 pieza 3. La SCo deja de ser un texto suelto: pasa a ser un
 * registro propio, en `datos/sco/<año>/<nombre>.json`, que sabe qué
 * expedientes la componen. Hasta acá la SCo era sólo `campos.numeroSCo` en
 * cada expediente y los "hermanos" salían de barrer el índice entero
 * (`sco-numero.js`); un registro no se barre, se consulta.
 *
 * El archivo se llama `<año>/<nombre>.json` donde:
 *  - `<año>` es el del expediente que abre la SCo (el id `2026-001` → 2026),
 *    no el del número, porque el número es texto libre desde la ronda 26;
 *  - `<nombre>` es el número con todo lo que no sea `[A-Za-z0-9._-]` reemplazado
 *    por `_`, para que el número nunca pueda escapar de `datos/sco/`. El
 *    número ORIGINAL travels intacto en el campo `numeroSCo` del JSON, así que
 *    dos números que al sanearse den el mismo nombre no se confunden: las
 *    búsquedas comparan el campo, nunca el nombre de archivo.
 *
 * Dos reglas rigen la pertenencia, y las dos son del servidor, no de la
 * pantalla (mismo criterio que la guardia de renglones de ORDEN-RONDA-25 §6):
 *  - SUMARSE: sólo a una SCo cuyos expedientes estén TODOS en
 *    SOLICITUD_CONTRATACION. Si uno ya avanzó, la SCo se movió como unidad y
 *    este requerimiento llega tarde: 409 diciendo cuál de los dos no entra.
 *  - SALIR: sólo mientras la SCo no avanzó, con la misma exigencia sobre los
 *    que quedan. Después de eso el número de SCo es parte de la historia del
 *    expediente y no se cambia por PUT.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { escribirAtomico } = require('./ayudantes.js');

const ESTADO_SOLICITUD = 'SOLICITUD_CONTRATACION';
const ANIO_RE = /^\d{4}$/;
const ID_RE = /^\d{4}-\d{3,}$/;

// Nombre de archivo seguro para un número de SCo (texto libre). Nunca vacío:
// si el número no deja nada seguro, el registro no se puede crear y el llamador
// responde 400.
function nombreDeArchivo(numeroSCo) {
  const crudo = String(numeroSCo);
  const limpio = crudo
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')
    .slice(0, 120);
  return limpio;
}

function numeroUtil(numeroSCo) {
  if (typeof numeroSCo !== 'string') {
    return null;
  }
  const recortado = numeroSCo.trim();
  if (recortado.length === 0) {
    return null;
  }
  return nombreDeArchivo(recortado).length > 0 ? recortado : null;
}

function anioDeExpediente(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    return null;
  }
  const anio = id.slice(0, 4);
  return ANIO_RE.test(anio) ? anio : null;
}

function directorioSco(datosDir) {
  return path.join(datosDir, 'sco');
}

function rutaRegistro(datosDir, anio, nombreArchivo) {
  return path.join(directorioSco(datosDir), anio, nombreArchivo + '.json');
}

function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Registros de SCo que existen en disco, en orden de año y luego de nombre.
// Se comparan por el campo `numeroSCo`, no por el nombre de archivo: el nombre
// es una consecuencia de sanear el número, y dos números distintos pueden
// terminar en el mismo archivo si sólo se mirara el nombre.
function registros(datosDir) {
  const salida = [];
  const raiz = directorioSco(datosDir);
  if (!fs.existsSync(raiz)) {
    return salida;
  }
  const anios = fs.readdirSync(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory() && ANIO_RE.test(e.name))
    .map((e) => e.name)
    .sort();
  for (const anio of anios) {
    const dirAnio = path.join(raiz, anio);
    const archivos = fs.readdirSync(dirAnio)
      .filter((n) => n.endsWith('.json'))
      .sort();
    for (const nombre of archivos) {
      const registro = leerJson(path.join(dirAnio, nombre));
      if (registro && typeof registro.numeroSCo === 'string') {
        salida.push(registro);
      }
    }
  }
  return salida;
}

function buscar(datosDir, numeroSCo) {
  const todos = registros(datosDir);
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].numeroSCo === numeroSCo) {
      return todos[i];
    }
  }
  return null;
}

// Ids de los expedientes de una SCo, sin el que pregunta (para el "esta SCo
// incluye también" de la pantalla).
function hermanos(datosDir, numeroSCo, idActual) {
  const registro = buscar(datosDir, numeroSCo);
  if (!registro) {
    return [];
  }
  const ids = Array.isArray(registro.expedientes) ? registro.expedientes : [];
  return ids.filter((id) => typeof id === 'string' && id !== idActual);
}

function estadoDeExpediente(datosDir, id) {
  const archivo = path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente', 'datos.json');
  const expediente = leerJson(archivo);
  if (!expediente) {
    return null;
  }
  return expediente && expediente.estado && typeof expediente.estado.id === 'string'
    ? expediente.estado.id
    : null;
}

// Expedientes de la SCo que ya no están en SOLICITUD_CONTRATACION. Es lo que
// decide las dos reglas: sumar y salir.
function fueraDeSolicitud(datosDir, ids) {
  const fuera = [];
  for (const id of ids) {
    const estado = estadoDeExpediente(datosDir, id);
    if (estado !== ESTADO_SOLICITUD) {
      fuera.push({ id: id, estado: estado });
    }
  }
  return fuera;
}

function nombresDe(fuera) {
  return fuera.map((f) => f.id + ' (en ' + (f.estado || 'un estado desconocido') + ')').join(', ');
}

function entradaAuditoria(contexto, accion, detalle) {
  const c = contexto || {};
  const entrada = {
    timestamp: typeof c.timestamp === 'string' ? c.timestamp : null,
    email: typeof c.email === 'string' ? c.email : null,
    rol: typeof c.rol === 'string' ? c.rol : null,
    equipo: typeof c.equipo === 'string' ? c.equipo : null,
    accion: accion
  };
  if (detalle && typeof detalle === 'object') {
    for (const clave of Object.keys(detalle)) {
      entrada[clave] = detalle[clave];
    }
  }
  if (typeof c.observacion === 'string' || c.observacion === null) {
    entrada.observacion = c.observacion === undefined ? null : c.observacion;
  }
  return entrada;
}

function construirRegistro(numeroSCo, anio, contexto) {
  return {
    numeroSCo: numeroSCo,
    anio: anio,
    expedientes: [],
    entregables: [],
    version: 1,
    creado: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
    creadoPor: typeof contexto.email === 'string' ? contexto.email : null,
    actualizado: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
    actualizadoPor: typeof contexto.email === 'string' ? contexto.email : null,
    auditoria: [entradaAuditoria(contexto, 'crearSCo', { anio: anio })]
  };
}

function guardar(datosDir, registro) {
  const nombre = nombreDeArchivo(registro.numeroSCo);
  const ruta = rutaRegistro(datosDir, registro.anio, nombre);
  if (simulando()) {
    return ruta;
  }
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  // El registro no tiene carpeta de histórico propia (el expediente ya la
  // tiene): se escribe con la misma escritura atómica del resto del servidor.
  escribirAtomico(ruta, JSON.stringify(registro, null, 2));
  return ruta;
}

// `simular: true` hace que `sumarse` y `salir` hagan TODAS las validaciones y
// devuelvan lo que devolverían, pero sin tocar el disco. La validación no es
// una copia de la acción: es la misma acción sin la escritura, para que no
// puedan dejar de coincidir (un chequeo que se desincroniza de lo que hace es
// un bug esperando).
let SIMULAR = false;
function simulando() {
  return SIMULAR;
}

function sinEscribir(fn) {
  const anterior = SIMULAR;
  SIMULAR = true;
  try {
    return fn();
  } finally {
    SIMULAR = anterior;
  }
}

function tocar(registro, contexto) {
  registro.version = (typeof registro.version === 'number' ? registro.version : 0) + 1;
  if (typeof contexto.timestamp === 'string') {
    registro.actualizado = contexto.timestamp;
  }
  if (typeof contexto.email === 'string') {
    registro.actualizadoPor = contexto.email;
  }
  return registro;
}

function fallo(codigo, error, extra) {
  const r = { ok: false, codigo: codigo, error: error };
  if (extra && typeof extra === 'object') {
    for (const clave of Object.keys(extra)) {
      r[clave] = extra[clave];
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Sumarse
// ---------------------------------------------------------------------------
// `versionEsperadaSCO` es la versión del registro que el cliente leyó por última
// vez. Si viene y no coincide con la de disco, otro operador se sumó o salió en
// el medio: 409 sin escribir nada. Si no viene (el cliente nunca leyó el
// registro, o la SCo es nueva), se acepta la de disco.
function sumarse(datosDir, opciones) {
  const numero = numeroUtil(opciones.numeroSCo);
  if (numero === null) {
    return fallo(400, 'el número de SCo no es válido: no puede quedar vacío ni tener sólo símbolos');
  }
  const anio = anioDeExpediente(opciones.idExpediente);
  if (anio === null) {
    return fallo(400, 'el expediente no tiene un id válido para abrir el registro de SCo');
  }
  const contexto = opciones.contexto || {};
  const existente = buscar(datosDir, numero);
  if (existente) {
    if (typeof opciones.versionEsperadaSCO === 'number' &&
        opciones.versionEsperadaSCO !== existente.version) {
      return fallo(409, 'el registro de la SCo ' + numero + ' cambió (' +
        'versión ' + existente.version + ' en disco, usted tenía la ' +
        opciones.versionEsperadaSCO + '). No se guardó nada.', {
        conflicto: true,
        versionRemota: existente.version
      });
    }
    const miembros = Array.isArray(existente.expedientes) ? existente.expedientes : [];
    if (miembros.indexOf(opciones.idExpediente) !== -1) {
      // Ya estaba: guardar el mismo número dos veces no es un error ni suma dos
      // veces al mismo expediente.
      return { ok: true, registro: existente, yaEstaba: true };
    }
    // Regla de pertenencia: la SCo es una unidad. Si un solo miembro ya
    // avanzó, este requerimiento no puede entrar por la puerta de atrás.
    const fuera = fueraDeSolicitud(datosDir, miembros);
    if (fuera.length > 0) {
      return fallo(409, 'no se puede sumar a la SCo ' + numero + ' porque ya avanzó: ' +
        nombresDe(fuera) + '. Una SCo avanza junta, así que el requerimiento tiene ' +
        'que entrar antes de que la SCo se mueva, o volver por su propio circuito.', {
        fueraDeSolicitud: fuera
      });
    }
    const actualizado = JSON.parse(JSON.stringify(existente));
    actualizado.expedientes = miembros.concat([opciones.idExpediente]);
    if (!Array.isArray(actualizado.entregables)) {
      actualizado.entregables = [];
    }
    if (!Array.isArray(actualizado.auditoria)) {
      actualizado.auditoria = [];
    }
    actualizado.auditoria.push(entradaAuditoria(contexto, 'sumarse', {
      expediente: opciones.idExpediente
    }));
    tocar(actualizado, contexto);
    guardar(datosDir, actualizado);
    return { ok: true, registro: actualizado };
  }
  // SCo nueva: se abre con este expediente como primer miembro.
  const registro = construirRegistro(numero, anio, contexto);
  registro.expedientes = [opciones.idExpediente];
  guardar(datosDir, registro);
  return { ok: true, registro: registro };
}

// ---------------------------------------------------------------------------
// Salir
// ---------------------------------------------------------------------------
function salir(datosDir, opciones) {
  const numero = numeroUtil(opciones.numeroSCo);
  if (numero === null) {
    return { ok: true, registro: null };
  }
  const contexto = opciones.contexto || {};
  const existente = buscar(datosDir, numero);
  if (!existente) {
    return { ok: true, registro: null };
  }
  const miembros = Array.isArray(existente.expedientes) ? existente.expedientes : [];
  if (miembros.indexOf(opciones.idExpediente) === -1) {
    return { ok: true, registro: existente };
  }
  const fuera = fueraDeSolicitud(datosDir, miembros);
  if (fuera.length > 0) {
    return fallo(409, 'no se puede salir de la SCo ' + numero + ' porque ya avanzó: ' +
      nombresDe(fuera) + '. El número de SCo queda como parte de la historia del ' +
      'expediente una vez que la SCo se mueve.', {
      fueraDeSolicitud: fuera
    });
  }
  const restantes = miembros.filter((id) => id !== opciones.idExpediente);
  const ruta = rutaRegistro(datosDir, existente.anio, nombreDeArchivo(existente.numeroSCo));
  if (restantes.length === 0) {
    // Se fue el último: no queda una SCo vacía en el disco.
    if (!simulando()) {
      try {
        fs.unlinkSync(ruta);
      } catch (e) { /* ya no estaba */ }
    }
    return { ok: true, registro: null };
  }
  const actualizado = JSON.parse(JSON.stringify(existente));
  actualizado.expedientes = restantes;
  if (!Array.isArray(actualizado.auditoria)) {
    actualizado.auditoria = [];
  }
  actualizado.auditoria.push(entradaAuditoria(contexto, 'salir', {
    expediente: opciones.idExpediente
  }));
  tocar(actualizado, contexto);
  guardar(datosDir, actualizado);
  return { ok: true, registro: actualizado };
}

function crearManejadoresSco(entorno) {
  const { datosDir, ayudantes } = entorno;
  const { responderJson, parsearCuerpo } = ayudantes;
  const SGC = globalThis.SGC;

  // GET /api/sco/<numero> — el registro de esa SCo (o 404 si no existe).
  // Los hermanos salen de acá, no de barrer el índice.
  // El nombre lleva el prefijo SCo a propósito: `servidor.js` compone los
  // manejadores con Object.assign, así que un `apiLeer` acá pisaría en silencio
  // el `apiLeer` de los expedientes.
  function apiLeerSco(req, res, numeroDeUrl) {
    const numero = numeroUtil(numeroDeUrl);
    if (numero === null) {
      return responderJson(res, 400, { error: 'el número de SCo de la URL no es válido' });
    }
    const registro = buscar(datosDir, numero);
    if (!registro) {
      return responderJson(res, 404, { error: 'no existe una SCo con el número ' + numero });
    }
    return responderJson(res, 200, { registro: registro });
  }

  // POST /api/sco/<numero>/sumarse — suma el expediente que manda el cuerpo.
  // La pantalla no lo usa (suma al guardar el número, por el PUT), pero deja la
  // operación disponible y, sobre todo, con las mismas reglas y la misma
  // guardia, para que ningún camino se salte el registro.
  function apiSumarseSco(req, res, numeroDeUrl, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.expedienteId !== 'string' ||
        !cuerpo.contexto || typeof cuerpo.contexto !== 'object') {
      return responderJson(res, 400, {
        error: 'cuerpo inválido: se espera {expedienteId, contexto} con versionEsperadaSCO opcional'
      });
    }
    const numero = numeroUtil(numeroDeUrl) || numeroUtil(cuerpo.numeroSCo);
    if (numero === null) {
      return responderJson(res, 400, { error: 'el número de SCo no es válido' });
    }
    const exp = rutaDeExpediente(datosDir, cuerpo.expedienteId);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + cuerpo.expedienteId });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const autorizacion = SGC.core.autorizacion.autorizarRolDelEstado(
      entorno.padronVivo.usuarios(), cuerpo.contexto, actual.estado ? actual.estado.id : null);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    const resultado = sumarse(datosDir, {
      idExpediente: cuerpo.expedienteId,
      numeroSCo: numero,
      contexto: cuerpo.contexto,
      versionEsperadaSCO: typeof cuerpo.versionEsperadaSCO === 'number'
        ? cuerpo.versionEsperadaSCO : undefined
    });
    if (!resultado.ok) {
      return responderJson(res, resultado.codigo, {
        error: resultado.error,
        conflicto: resultado.conflicto || false,
        versionRemota: resultado.versionRemota === undefined ? null : resultado.versionRemota
      });
    }
    return responderJson(res, 200, { registro: resultado.registro, yaEstaba: !!resultado.yaEstaba });
  }

  function rutaDeExpediente(datosDirLocal, id) {
    return {
      dir: path.join(datosDirLocal, id.slice(0, 4), id.slice(5) + '_Expediente'),
      datos: path.join(datosDirLocal, id.slice(0, 4), id.slice(5) + '_Expediente', 'datos.json')
    };
  }

  return { apiLeerSco, apiSumarseSco };
}

module.exports = {
  ESTADO_SOLICITUD,
  anioDeExpediente,
  buscar,
  crearManejadoresSco,
  hermanos,
  nombreDeArchivo,
  numeroUtil,
  registros,
  salir,
  sinEscribir,
  sumarse
};

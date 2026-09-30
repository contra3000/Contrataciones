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

const { escribirAtomico, adquirirLock, liberarLock, estaDentro, nombreEntregableValido } =
  require('./ayudantes.js');

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

// ORDEN-RONDA-27 pieza 4: qué SCo manda sobre este expediente, si es que
// alguna. Devuelve null cuando el expediente no tiene número, así la pantalla
// y el servidor siguen tratando el caso de siempre.
// `contiene` en false significa que el expediente dice un número pero el
// registro no lo lista: es una inconsistencia y el servidor se niega a mover
// en lugar de partir la SCo en dos.
function grupoDeExpediente(datosDir, expediente) {
  const campos = expediente && expediente.campos ? expediente.campos : null;
  const numero = campos && typeof campos.numeroSCo === 'string' ? campos.numeroSCo : null;
  if (numero === null || numero.trim() === '') {
    return null;
  }
  // El identificador del expediente va en `expedienteId`, no en `id`: el `id`
  // de la respuesta HTTP es de la envolvente, no del documento guardado.
  const id = expediente.expedienteId;
  if (typeof id !== 'string') {
    return null;
  }
  const registro = buscar(datosDir, numero);
  if (!registro) {
    return null;
  }
  const ids = Array.isArray(registro.expedientes)
    ? registro.expedientes.filter((otro) => typeof otro === 'string')
    : [];
  return {
    numeroSCo: numero,
    registro: registro,
    ids: ids,
    contiene: ids.indexOf(id) !== -1
  };
}

// Los miembros de la SCo con el estado en que están, para el texto de "Avanzar"
// que dice a quién falta volver. Orden estable por id.
function miembrosConEstado(datosDir, registro) {
  const ids = registro && Array.isArray(registro.expedientes) ? registro.expedientes : [];
  return ids
    .filter((id) => typeof id === 'string')
    .map((id) => ({ id: id, estado: estadoDeExpediente(datosDir, id) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ORDEN-RONDA-27 pieza 4 §2: la escritura de todos los miembros va bajo un
// candado propio de la SCo, para que dos operadores que mueven SCo distintas no
// se pisen y para que un movimiento en bloque no se entrelace con otro.
// El candado vive al lado de los registros; `registros()` sólo lee `.json`, así
// que el `.lock` no lo confunde con una SCo.
function rutaCandadoGrupo(datosDir, registro) {
  return path.join(directorioSco(datosDir), registro.anio, nombreDeArchivo(registro.numeroSCo) + '.lock');
}

function conCandadoGrupo(datosDir, registro, fn) {
  const ruta = rutaCandadoGrupo(datosDir, registro);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const REINTENTOS = 40;
  const ESPERA_MS = 25;
  const tomado = adquirirLock(ruta, REINTENTOS, ESPERA_MS);
  if (!tomado) {
    const e = new Error('otro movimiento de esta SCo está en curso; reintente en un momento');
    e.codigo = 409;
    // Es un motivo nuestro, escrito para el operador: se puede mostrar
    // (ORDEN-RONDA-17 §20, la puerta `mensajeSeguro`).
    e.mensajeSeguro = true;
    throw e;
  }
  try {
    return fn();
  } finally {
    liberarLock(ruta);
  }
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
// ORDEN-RONDA-27 pieza 5 · el ANEXO I se guarda como entregable de la SCo
// ---------------------------------------------------------------------------
// El archivo va a la carpeta de la SCo, NO a la del expediente que está abierto:
// toda la SCo, así que guardarlo por expediente lo multiplicaría y cada
// requerimiento tendría un documento distinto del mismo grupo.
//
// La concurrencia es la del REGISTRO, como en `guardarAnexo1`: el documento y los
// datos se escriben contra la misma versión, así que o entran los dos o no entra
// ninguno. La lectura del registro, el cotejo de la versión y las dos escrituras
// (el archivo y el registro) van dentro del candado de la SCo —el mismo que
// serializa el movimiento en bloque—, y la versión se vuelve a mirar adentro: si
// entre la espera y la escritura alguien guardó, el 409 es el correcto. El archivo
// va antes que el registro y, si el registro no llegara a escribirse, lo que sobra
// es un archivo, que el siguiente guardado vuelve a pisar.
function guardarEntregableSco(datosDir, numeroSCo, opciones) {
  const nombre = opciones.nombre;
  if (!nombreEntregableValido(nombre)) {
    return fallo(400, 'el nombre del entregable no es válido (sin rutas, ni puntos de recorrido)');
  }
  if (typeof opciones.contenido !== 'string') {
    return fallo(400, 'el contenido del entregable tiene que ser texto');
  }
  if (opciones.id !== null && opciones.id !== undefined &&
      (typeof opciones.id !== 'string' || opciones.id.length === 0)) {
    return fallo(400, 'el id del entregable debe ser una cadena no vacía');
  }
  const registro = buscar(datosDir, numeroSCo);
  if (!registro) {
    return fallo(404, 'no existe una SCo con el número ' + numeroSCo);
  }
  if (typeof opciones.versionEsperada !== 'number') {
    return fallo(400, 'falta la versión esperada del registro de la SCo');
  }
  const contexto = opciones.contexto || {};
  let resultado;
  try {
    resultado = conCandadoGrupo(datosDir, registro, function () {
      // Adentro del candado se relee: la versión que se coteja es la de ahora.
      const actual = buscar(datosDir, numeroSCo);
      if (!actual) {
        return fallo(404, 'no existe una SCo con el número ' + numeroSCo);
      }
      if (actual.version !== opciones.versionEsperada) {
        return fallo(409, 'el registro de la SCo ' + numeroSCo + ' cambió mientras se guardaba el ' +
          'documento (está en la versión ' + actual.version + ' y usted tenía la ' +
          opciones.versionEsperada + '). Vuelva a abrirlo.', {
            conflicto: true,
            versionRemota: actual.version,
            ultimoUsuario: actual.actualizadoPor || null,
            ultimaModificacion: actual.actualizado || null
          });
      }
      const carpeta = rutaCarpetaSco(datosDir, actual);
      const destino = rutaEntregableSco(datosDir, actual, nombre);
      if (!estaDentro(destino, carpeta)) {
        return fallo(400, 'el nombre del entregable no es válido (recorrido de rutas no permitido)');
      }
      const actualizado = JSON.parse(JSON.stringify(actual));
      if (!Array.isArray(actualizado.entregables)) {
        actualizado.entregables = [];
      }
      if (!Array.isArray(actualizado.auditoria)) {
        actualizado.auditoria = [];
      }
      // Un entregable por nombre: volver a guardar el ANEXO I de la SCo lo actualiza
      // en el lugar, en vez de dejar dos entradas del mismo documento.
      const entrada = {
        nombre: nombre,
        ruta: 'entregables/' + nombre,
        id: opciones.id === undefined ? null : opciones.id,
        guardado: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
        email: typeof contexto.email === 'string' ? contexto.email : null,
        equipo: typeof contexto.equipo === 'string' ? contexto.equipo : null
      };
      actualizado.entregables = actualizado.entregables
        .filter((e) => !(e && typeof e === 'object' && e.nombre === nombre))
        .concat([entrada]);
      actualizado.auditoria.push(entradaAuditoria(contexto, 'guardarEntregable', {
        entregable: nombre,
        deLaSCo: true
      }));
      tocar(actualizado, contexto);
      if (!simulando()) {
        fs.mkdirSync(path.join(carpeta, 'entregables'), { recursive: true });
        escribirAtomico(destino, opciones.contenido);
      }
      guardar(datosDir, actualizado);
      return { ok: true, registro: actualizado, ruta: entrada.ruta, version: actualizado.version };
    });
  } catch (e) {
    if (e && e.codigo) {
      // ORDEN-RONDA-17 §20: de un error de la máquina sólo se muestra el motivo
      // que el propio servidor escribió para el operador (`mensajeSeguro`); el
      // resto queda en el registro del operador.
      if (e.mensajeSeguro === true) {
        return fallo(e.codigo, e.message);
      }
      console.error('sco: fallo al guardar el entregable de la SCo ' + numeroSCo + ': ' + e.message);
      return fallo(e.codigo, 'no se pudo guardar el documento de la SCo ' + numeroSCo);
    }
    throw e;
  }
  return resultado;
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

  // GET /api/sco/<numero> — el registro de esa SCo (o 404 si no existe), con el
  // ANEXO I y los renglones consolidados de todos los miembros (pieza 5).
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
    const anexo1 = anexo1DeSCo(datosDir, registro);
    return responderJson(res, 200, {
      registro: registro,
      anexo1: anexo1.anexo1,
      anexo1Origen: anexo1.origen,
      anexo1PuntoDePartida: anexo1.puntoDePartida,
      anexos1Propios: anexo1.legacy.map((l) => l.expediente),
      renglones: renglonesConsolidados(datosDir, registro)
    });
  }

  // PUT /api/sco/<numero>/anexo1 — el ANEXO I es de la SCo, se edita desde
  // cualquier expediente miembro y el control de concurrencia es la versión del
  // REGISTRO (pieza 5).
  function apiGuardarAnexo1Sco(req, res, numeroDeUrl, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        !cuerpo.anexo1 || typeof cuerpo.anexo1 !== 'object' ||
        typeof cuerpo.versionEsperada !== 'number' ||
        !cuerpo.contexto || typeof cuerpo.contexto !== 'object') {
      return responderJson(res, 400, {
        error: 'cuerpo inválido: se espera {anexo1, versionEsperada, contexto}'
      });
    }
    const numero = numeroUtil(numeroDeUrl);
    if (numero === null) {
      return responderJson(res, 400, { error: 'el número de SCo de la URL no es válido' });
    }
    // Se cruza el contexto contra el padrón (ADR-021) igual que en cualquier
    // escritura del servidor: el rol no se lo elige el cliente.
    const autorizacion = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), cuerpo.contexto);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    const resultado = guardarAnexo1(datosDir, numero, cuerpo.anexo1,
      cuerpo.versionEsperada, cuerpo.contexto);
    if (!resultado.ok) {
      const cuerpoRespuesta = { error: resultado.error };
      for (const clave of Object.keys(resultado)) {
        if (clave !== 'ok' && clave !== 'codigo' && clave !== 'error') {
          cuerpoRespuesta[clave] = resultado[clave];
        }
      }
      return responderJson(res, resultado.codigo, cuerpoRespuesta);
    }
  return responderJson(res, 200, {
    registro: resultado.registro,
    renglones: renglonesConsolidados(datosDir, resultado.registro)
  });
  }

  // POST /api/sco/<numero>/entregables — el documento del ANEXO I se guarda en
  // la carpeta de la SCo (pieza 5). Mismo cuerpo y misma autorización que el PUT
  // del ANEXO I, más `versionEsperada` del REGISTRO: los datos y el documento se
  // escriben contra la misma versión del mismo registro.
  function apiGuardarEntregableSco(req, res, numeroDeUrl, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.nombre !== 'string' || cuerpo.nombre.length === 0 ||
        typeof cuerpo.contenido !== 'string' ||
        typeof cuerpo.versionEsperada !== 'number' ||
        !cuerpo.contexto || typeof cuerpo.contexto !== 'object') {
      return responderJson(res, 400, {
        error: 'cuerpo inválido: se espera {nombre, contenido, versionEsperada, contexto}'
      });
    }
    const numero = numeroUtil(numeroDeUrl);
    if (numero === null) {
      return responderJson(res, 400, { error: 'el número de SCo de la URL no es válido' });
    }
    const autorizacion = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), cuerpo.contexto);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    // El id del documento, si viene, tiene que existir en el catálogo: es lo que
    // permite que la validación del estado lo dé por cumplido (mismo criterio
    // que el POST de entregables del expediente).
    const idEntregable = cuerpo.id === undefined || cuerpo.id === null ? null : cuerpo.id;
    if (idEntregable !== null) {
      if (typeof idEntregable !== 'string' || idEntregable.length === 0) {
        return responderJson(res, 400, { error: 'el id del entregable debe ser una cadena no vacía' });
      }
      const catalogo = SGC.core.config.ENTREGABLES;
      if (!catalogo || !catalogo.some((e) => e.id === idEntregable)) {
        return responderJson(res, 400, {
          error: 'el id del entregable no existe en el catálogo: ' + idEntregable
        });
      }
    }
    const resultado = guardarEntregableSco(datosDir, numero, {
      nombre: cuerpo.nombre,
      contenido: cuerpo.contenido,
      id: idEntregable,
      versionEsperada: cuerpo.versionEsperada,
      contexto: cuerpo.contexto
    });
    if (!resultado.ok) {
      const cuerpoRespuesta = { error: resultado.error };
      for (const clave of Object.keys(resultado)) {
        if (clave !== 'ok' && clave !== 'codigo' && clave !== 'error') {
          cuerpoRespuesta[clave] = resultado[clave];
        }
      }
      return responderJson(res, resultado.codigo, cuerpoRespuesta);
    }
    return responderJson(res, 201, {
      registro: resultado.registro,
      ruta: resultado.ruta,
      version: resultado.version
    });
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

  // GET /api/sco/<numero>/entregables/<nombre> — el documento guardado de la
  // SCo, con la misma Ceuta de nombres que el del expediente (ADR-016): nada de
  // rutas, nada fuera de la carpeta de la SCo.
  function apiLeerEntregableSco(req, res, numeroDeUrl, nombreDeUrl) {
    const numero = numeroUtil(numeroDeUrl);
    if (numero === null) {
      return responderJson(res, 400, { error: 'el número de SCo de la URL no es válido' });
    }
    const nombre = nombreDeUrl === undefined || nombreDeUrl === null ? null : nombreDeUrl;
    if (!nombreEntregableValido(nombre)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (recorrido de rutas no permitido)' });
    }
    const registro = buscar(datosDir, numero);
    if (!registro) {
      return responderJson(res, 404, { error: 'no existe una SCo con el número ' + numero });
    }
    const carpeta = rutaCarpetaSco(datosDir, registro);
    const archivo = rutaEntregableSco(datosDir, registro, nombre);
    if (!estaDentro(archivo, carpeta)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (recorrido de rutas no permitido)' });
    }
    if (!fs.existsSync(archivo)) {
      return responderJson(res, 404, { error: 'entregable no encontrado en la SCo ' + numero + ': ' + nombre });
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="' + nombre + '"'
    });
    res.end(fs.readFileSync(archivo, 'utf8'));
  }

  function rutaDeExpediente(datosDirLocal, id) {
    return {
      dir: path.join(datosDirLocal, id.slice(0, 4), id.slice(5) + '_Expediente'),
      datos: path.join(datosDirLocal, id.slice(0, 4), id.slice(5) + '_Expediente', 'datos.json')
    };
  }

  return {
    apiLeerSco,
    apiSumarseSco,
    apiGuardarAnexo1Sco,
    apiGuardarEntregableSco,
    apiLeerEntregableSco
  };
}

// ---------------------------------------------------------------------------
// ORDEN-RONDA-27 pieza 5 · el ANEXO I es de la SCo
// ---------------------------------------------------------------------------

// Carpeta de entregables de una SCo: al lado del registro, `<anio>/<nombre>/`.
// `registros()` sólo lee archivos `.json` del año, así que una carpeta con el
// nombre de la SCo no se confunde con un registro.
function rutaCarpetaSco(datosDir, registro) {
  return path.join(directorioSco(datosDir), registro.anio, nombreDeArchivo(registro.numeroSCo));
}

function rutaEntregableSco(datosDir, registro, nombre) {
  return path.join(rutaCarpetaSco(datosDir, registro), 'entregables', nombre);
}

function renglonesDeExpediente(datosDir, id) {
  const archivo = path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente', 'datos.json');
  const expediente = leerJson(archivo);
  if (!expediente) {
    return [];
  }
  const datos = expediente.datos && typeof expediente.datos === 'object' ? expediente.datos : expediente;
  return Array.isArray(datos.renglones) ? datos.renglones : [];
}

// Un renglón del ANEXO I por código de catálogo, con la cantidad SUMADA y abajo
// el desglose por expediente. Dos requerimientos que piden el mismo código
// dejan un solo renglón, no dos: es el punto de agrupar por SCo (ADR-043).
function renglonesConsolidados(datosDir, registro) {
  const ids = registro && Array.isArray(registro.expedientes) ? registro.expedientes : [];
  const porCodigo = new Map();
  for (const id of ids) {
    const renglones = renglonesDeExpediente(datosDir, id);
    for (const r of renglones) {
      if (!r || typeof r.codigo !== 'string' || r.codigo.trim() === '') {
        continue;
      }
      const unidad = typeof r.unidad === 'string' ? r.unidad : '';
      const clave = r.codigo + '|' + unidad;
      let fila = porCodigo.get(clave);
      if (!fila) {
        fila = {
          codigo: r.codigo,
          descripcion: typeof r.descripcion === 'string' ? r.descripcion : '',
          unidad: unidad,
          cantidad: 0,
          desglose: []
        };
        porCodigo.set(clave, fila);
      }
      const cantidad = typeof r.cantidad === 'number' && isFinite(r.cantidad) ? r.cantidad : 0;
      fila.cantidad += cantidad;
      fila.desglose.push({ expediente: id, cantidad: cantidad });
    }
  }
  const salida = Array.from(porCodigo.values());
  salida.sort((a, b) => (a.codigo === b.codigo
    ? (a.unidad < b.unidad ? -1 : a.unidad > b.unidad ? 1 : 0)
    : a.codigo < b.codigo ? -1 : 1));
  return salida;
}

// Los `anexo1.*` que el expediente tenía guardados, para el punto de partida.
// ORDEN-RONDA-27 pieza 5: si la SCo tiene UN solo miembro, su ANEXO I es el
// punto de partida del de la SCo. Si tiene varios, no se elige uno detrás de
// otro: se avisa y queda para la decisión del informe.
function anexo1DeExpediente(datosDir, id) {
  const archivo = path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente', 'datos.json');
  const expediente = leerJson(archivo);
  if (!expediente) {
    return null;
  }
  const datos = expediente.datos && typeof expediente.datos === 'object' ? expediente.datos : expediente;
  return datos.anexo1 && typeof datos.anexo1 === 'object' ? datos.anexo1 : null;
}

// El ANEXO I de la SCo, más el punto de partida que ofrecen los expedientes que
// todavía lo tienen propio. `origen` dice de dónde sale lo que se está mostrando.
function anexo1DeSCo(datosDir, registro) {
  const guardado = registro && registro.anexo1 && typeof registro.anexo1 === 'object'
    ? registro.anexo1
    : null;
  if (guardado) {
    return { anexo1: guardado, origen: 'sco', puntoDePartida: null, legacy: [] };
  }
  const ids = registro && Array.isArray(registro.expedientes) ? registro.expedientes : [];
  const legacy = [];
  for (const id of ids) {
    const propio = anexo1DeExpediente(datosDir, id);
    if (propio) {
      legacy.push({ expediente: id, anexo1: propio });
    }
  }
  if (legacy.length === 1) {
    return {
      anexo1: legacy[0].anexo1,
      origen: 'migracion',
      puntoDePartida: legacy[0].expediente,
      legacy: legacy
    };
  }
  return { anexo1: null, origen: 'vacio', puntoDePartida: null, legacy: legacy };
}

// Guardar el ANEXO I de la SCo. `versionEsperada` es la del REGISTRO, no la
// del expediente: el documento es de la SCo, así que el control de concurrencia
// es el del registro. Si otro operador lo guardó mientras tanto, 409.
function guardarAnexo1(datosDir, numeroSCo, anexo1, versionEsperada, contexto) {
  const registro = buscar(datosDir, numeroSCo);
  if (!registro) {
    return fallo(404, 'no existe una SCo con el número ' + numeroSCo);
  }
  if (typeof versionEsperada !== 'number') {
    return fallo(400, 'falta la versión esperada del registro de la SCo');
  }
  if (!anexo1 || typeof anexo1 !== 'object' || Array.isArray(anexo1)) {
    return fallo(400, 'el ANEXO I de la SCo tiene que ser un objeto');
  }
  if (registro.version !== versionEsperada) {
    return fallo(409, 'el ANEXO I de la SCo ' + numeroSCo + ' cambió mientras se editaba ' +
      '(está en la versión ' + registro.version + ' y usted editaba la ' + versionEsperada +
      '). Vuelva a abrirlo.', {
      conflicto: true,
      versionRemota: registro.version,
      // El registro de la SCo lleva `actualizadoPor`/`actualizado`, no los
      // `ultimoUsuario`/`ultimaModificacion` del expediente. Se devuelven con
      // los nombres que espera el cliente (repo.http) para que el 409 se vea
      // igual en los dos adaptadores.
      ultimoUsuario: registro.actualizadoPor || null,
      ultimaModificacion: registro.actualizado || null
    });
  }
  const actualizado = Object.assign({}, registro, { anexo1: anexo1 });
  tocar(actualizado, contexto);
  // La entrada no lleva detalle porque la acción ya dice qué se hizo y el
  // registro ES la SCo: no hay otro dato que agregar (la `detalle` de
  // `entradaAuditoria` es un objeto de campos, no un texto libre).
  actualizado.auditoria = (registro.auditoria || []).concat([
    entradaAuditoria(contexto, 'guardarAnexo1')
  ]);
  guardar(datosDir, actualizado);
  return { ok: true, registro: actualizado };
}

module.exports = {
  ESTADO_SOLICITUD,
  anexo1DeSCo,
  anioDeExpediente,
  buscar,
  conCandadoGrupo,
  crearManejadoresSco,
  grupoDeExpediente,
  guardarAnexo1,
  guardarEntregableSco,
  hermanos,
  miembrosConEstado,
  nombreDeArchivo,
  numeroUtil,
  registros,
  renglonesConsolidados,
  salir,
  sinEscribir,
  sumarse
};

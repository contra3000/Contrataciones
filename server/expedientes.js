/*
 * expedientes.js
 * Manejadores del expediente en el servidor SGC (ORDEN-RONDA-07 §2.2),
 * separados por responsabilidad: creación, lectura, edición por PUT,
 * transiciones por intención (ADR-021) y entregables (§3.3). Comparten el
 * mismo entorno que manejadores.js (carpeta de datos, repositorio, padrón y
 * ayudantes); servidor.js compone ambos en el router.
 *
 * Depende de SGC.core (autorizacion y estados) que servidor.js carga antes.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function crearManejadoresExpedientes(entorno) {
  const {
    datosDir,
    repo,
    PADRON,
    ayudantes
  } = entorno;
  const {
    escribirAtomico,
    estaDentro,
    rutaExpediente,
    parsearCuerpo,
    responderJson
  } = ayudantes;

  const SGC = globalThis.SGC;

  function apiCrear(req, res, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {datosIniciales, contexto}' });
    }
    const datosIniciales = cuerpo.datosIniciales || {};
    const contexto = cuerpo.contexto || {};
    const anio = repo.anioDe(datosIniciales, contexto) ||
      String(new Date().getFullYear());
    const numero = ayudantes.siguienteNumero(datosDir, anio);
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

  // Dos estados (esquema v2, ADR-019) son iguales cuando coinciden id, fase y
  // desde. Sirve para la guardia del PUT: el estado sólo cambia por los
  // extremos de intención que pasan por el motor (ADR-021).
  function estadoIgual(a, b) {
    if (!a || typeof a !== 'object' || !b || typeof b !== 'object') {
      return false;
    }
    return a.id === b.id && a.fase === b.fase && a.desde === b.desde;
  }

  // Transición por intención (ADR-021): el servidor lee el expediente de disco,
  // ejecuta SGC.core.estados.avanzar/devolver con el rol del contexto y
  // persiste el resultado del motor, nunca lo que mandó el cliente. Si el
  // motor devuelve ok:false, responde 403 con el motivo en español tal cual lo
  // da. La entrada de auditoría la escribe el motor con el rol ya validado y
  // el origen de la petición (ADR-017 medida 3).
  function transicionPorMotor(req, res, id, contextoCuerpo, origen, accion) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.versionEsperada !== 'number' ||
        typeof cuerpo.destino !== 'string' ||
        !cuerpo.contexto || typeof cuerpo.contexto !== 'object') {
      return responderJson(res, 400, {
        error: 'cuerpo inválido: se espera {versionEsperada, destino, contexto}' +
          (accion === 'devolver' ? ' con idMotivo y observacion' : '')
      });
    }
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    // ADR-021: la autorización no depende del rol que el cliente elige. Antes
    // del motor, el servidor cruza el contexto declarado contra el padrón de
    // usuarios: correo fuera del padrón o rol que no le corresponde → 403, sin
    // ejecutar el motor y sin tocar el disco (pregunta del auditor §2.2).
    const autorizacion = SGC.core.autorizacion.verificar(PADRON, cuerpo.contexto);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    if (actual.version !== cuerpo.versionEsperada) {
      return responderJson(res, 409, { conflicto: true, versionRemota: actual.version });
    }
    const contexto = Object.assign({}, cuerpo.contexto, { origen });
    const motor = SGC.core.estados;
    const resultado = accion === 'avanzar'
      ? motor.avanzar(actual, contexto.rol, cuerpo.destino, contexto)
      : motor.devolver(actual, contexto.rol, cuerpo.destino,
        cuerpo.idMotivo, cuerpo.observacion === undefined ? null : cuerpo.observacion, contexto);
    if (!resultado.ok) {
      return responderJson(res, 403, { error: resultado.error });
    }
    const nuevo = resultado.expediente;
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'),
      JSON.stringify(actual, null, 2));
    escribirAtomico(exp.datos, JSON.stringify(nuevo, null, 2));
    const entrada = repo.entradaIndice(id, nuevo, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 200, { version: nuevaVersion, expediente: nuevo });
  }

  function apiAvanzar(req, res, id, contextoCuerpo, origen) {
    return transicionPorMotor(req, res, id, contextoCuerpo, origen, 'avanzar');
  }

  function apiDevolver(req, res, id, contextoCuerpo, origen) {
    return transicionPorMotor(req, res, id, contextoCuerpo, origen, 'devolver');
  }

  // Nombre de entregable válido: plano, sin separadores de ruta ni ".." ni
  // punto inicial. Compartido por el POST (guardar) y el GET (enlazar).
  function nombreEntregableValido(nombre) {
    return typeof nombre === 'string' && nombre.length > 0 &&
      /^[A-Za-z0-9._\- ]+$/.test(nombre) &&
      nombre.indexOf('..') === -1 && nombre.charAt(0) !== '.';
  }

  // Guardar el entregable generado en la carpeta del expediente (ORDEN-RONDA-07
  // §3.3, ADR-016: la app guarda el documento generado, no el firmado). El
  // nombre se valida para que no sea una ruta; el contenido es texto (el HTML
  // compuesto). La escritura de datos.json es atómica y versionada, igual que
  // el resto de las mutaciones.
  function apiGuardarEntregable(req, res, id, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.nombre !== 'string' || cuerpo.nombre.length === 0 ||
        typeof cuerpo.contenido !== 'string') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {nombre, contenido, contexto}' });
    }
    const nombre = cuerpo.nombre;
    if (!nombreEntregableValido(nombre)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (sin rutas, ni puntos de recorrido)' });
    }
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const contexto = cuerpo.contexto || {};
    const rutaEntregable = path.join(exp.dir, 'entregables', nombre);
    if (!estaDentro(rutaEntregable, exp.dir)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (recorrido de rutas no permitido)' });
    }
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    fs.mkdirSync(path.join(exp.dir, 'entregables'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'),
      JSON.stringify(actual, null, 2));
    escribirAtomico(rutaEntregable, cuerpo.contenido);
    const actualizado = JSON.parse(JSON.stringify(actual));
    actualizado.version = nuevaVersion;
    if (!Array.isArray(actualizado.entregables)) {
      actualizado.entregables = [];
    }
    actualizado.entregables.push({
      nombre,
      ruta: 'entregables/' + nombre,
      guardado: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
      email: typeof contexto.email === 'string' ? contexto.email : null,
      equipo: typeof contexto.equipo === 'string' ? contexto.equipo : null
    });
    if (typeof contexto.timestamp === 'string') {
      if (typeof actualizado.actualizado === 'string') {
        actualizado.actualizado = contexto.timestamp;
      }
      if (typeof actualizado.ultimaModificacion === 'string') {
        actualizado.ultimaModificacion = contexto.timestamp;
      }
    }
    if (typeof contexto.email === 'string' && typeof actualizado.ultimoUsuario === 'string') {
      actualizado.ultimoUsuario = contexto.email;
    }
    escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 201, {
      ruta: 'entregables/' + nombre,
      version: nuevaVersion
    });
  }

  // Enlazar el entregable guardado desde la vista (ORDEN-RONDA-07 §3.3.2): sirve
  // el archivo dentro de la carpeta del expediente con el mismo criterio de
  // validación del POST. El servidor nunca abre un archivo fuera de --datos.
  function apiLeerEntregable(req, res, id, nombre) {
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    if (!nombreEntregableValido(nombre)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (recorrido de rutas no permitido)' });
    }
    const archivo = path.join(exp.dir, 'entregables', nombre);
    if (!estaDentro(archivo, exp.dir)) {
      return responderJson(res, 400, { error: 'el nombre del entregable no es válido (recorrido de rutas no permitido)' });
    }
    if (!fs.existsSync(archivo)) {
      return responderJson(res, 404, { error: 'entregable no encontrado: ' + nombre });
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="' + nombre + '"'
    });
    res.end(fs.readFileSync(archivo, 'utf8'));
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
    // ADR-021: el PUT edita campos pero no puede mover el estado. Si el
    // documento recibido trae un estado distinto del de disco, 409 explícito
    // sin escribir nada. La única vía para cambiar el estado son los extremos
    // /avanzar y /devolver, que pasan por el motor.
    if (expedienteNuevo.estado !== undefined && expedienteNuevo.estado !== null &&
        !estadoIgual(expedienteNuevo.estado, actual.estado)) {
      return responderJson(res, 409, {
        error: 'el estado de un expediente no se cambia por PUT; use POST /api/expedientes/' +
          id + '/avanzar o /api/expedientes/' + id + '/devolver'
      });
    }
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'),
      JSON.stringify(actual, null, 2));
    const actualizado = JSON.parse(JSON.stringify(expedienteNuevo));
    actualizado.version = nuevaVersion;
    // ADR-021: la auditoría la escribe el servidor. El PUT edita campos pero no
    // puede agregar ni borrar entradas: se conserva la cadena de disco.
    actualizado.auditoria = actual.auditoria;
    escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    return responderJson(res, 200, { version: nuevaVersion });
  }

  return {
    apiCrear,
    apiLeer,
    apiAvanzar,
    apiDevolver,
    apiGuardarEntregable,
    apiLeerEntregable,
    apiGuardar
  };
}

module.exports = {
  crearManejadoresExpedientes
};
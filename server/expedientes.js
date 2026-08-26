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

const archivo = require('./archivo.js');

function crearManejadoresExpedientes(entorno) {
  const {
    datosDir,
    repo,
    PADRON,
    ayudantes,
    eventos
  } = entorno;
  const {
    escribirAtomico,
    estaDentro,
    rutaExpediente,
    parsearCuerpo,
    responderJson
  } = ayudantes;

  const SGC = globalThis.SGC;

  // Guardia del servidor sobre los renglones (ORDEN-RONDA-10 §3.1, auditoría
  // §2.1): la pantalla es conveniencia; esta guardia es la regla. Valida la
  // forma de cada renglón (validarRenglon: cantidades, aclaración, valores de
  // referencia) y que cada presupuestoId citado exista de verdad entre los
  // presupuestos del expediente. En la creación todavía no hay presupuestos,
  // así que se pasa un conjunto vacío y cualquier cita es rechazada.
  function erroresDeRenglones(recibidos, presupuestosIds) {
    const errores = [];
    for (let i = 0; i < recibidos.length; i++) {
      const r = recibidos[i];
      const v = SGC.core.validacion.validarRenglon(r);
      if (!v.valido) {
        errores.push('Renglón ' + (i + 1) + ': ' + v.errores.join(' · '));
        continue;
      }
      const valores = Array.isArray(r.valoresReferencia) ? r.valoresReferencia : [];
      for (let j = 0; j < valores.length; j++) {
        const vr = valores[j];
        if (vr && typeof vr === 'object' && typeof vr.presupuestoId === 'string' &&
            vr.presupuestoId !== '' && !presupuestosIds.has(vr.presupuestoId)) {
          errores.push('Renglón ' + (i + 1) + ': el valor de referencia ' + (j + 1) +
            ' cita el presupuesto "' + vr.presupuestoId + '", que no existe en este expediente');
        }
      }
    }
    return errores;
  }

  function apiCrear(req, res, contextoCuerpo) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {datosIniciales, contexto}' });
    }
    const datosIniciales = cuerpo.datosIniciales || {};
    // ORDEN-RONDA-10-CIERRE §1.3: la creación valida lo mismo que el PUT, y
    // antes de quemar un número de expediente con el lock de ADR-009.
    if (Array.isArray(datosIniciales.renglones)) {
      const erroresRenglones = erroresDeRenglones(datosIniciales.renglones, new Set());
      if (erroresRenglones.length > 0) {
        return responderJson(res, 400, { error: erroresRenglones.join(' · ') });
      }
    }
    const erroresTextos = SGC.core.validacion.validarJustificaciones(datosIniciales);
    if (erroresTextos.length > 0) {
      return responderJson(res, 400, { error: erroresTextos.join(' · ') });
    }
    const erroresEncabezado = SGC.core.validacion.validarEncabezado(datosIniciales);
    if (erroresEncabezado.length > 0) {
      return responderJson(res, 400, { error: erroresEncabezado.join(' · ') });
    }
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
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true }); escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    // ORDEN-RONDA-12 §3.1: registro de eventos (ADR-024).
    if (eventos && typeof eventos.registrarTransicion === 'function') {
      eventos.registrarTransicion(datosDir, id, null, 'ESPECIFICACIONES_TECNICAS', contexto);
    }
    return responderJson(res, 201, { id, version: expediente.version, expediente });
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
    return !!(a && typeof a === 'object' && b && typeof b === 'object') &&
      a.id === b.id && a.fase === b.fase && a.desde === b.desde;
  }

  // Transición por intención (ADR-021): el servidor ejecuta el motor con el
  // rol del contexto y persiste el resultado, nunca lo que mandó el cliente;
  // si el motor devuelve ok:false responde 403 con su motivo (ADR-017).
  function transicionPorMotor(req, res, id, contextoCuerpo, origen, accion) {
    const cuerpo = parsearCuerpo(contextoCuerpo);
    if (!cuerpo || typeof cuerpo !== 'object' ||
        typeof cuerpo.versionEsperada !== 'number' ||
        typeof cuerpo.destino !== 'string' ||
        !cuerpo.contexto || typeof cuerpo.contexto !== 'object') {
      return responderJson(res, 400, { error: 'cuerpo inválido: se espera {versionEsperada, destino, contexto}' + (accion === 'devolver' ? ' con idMotivo y observacion' : '') });
    }
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    // ADR-021: la autorización no depende del rol que el cliente elige. Antes
    // del motor, el servidor cruza el contexto contra el padrón: correo fuera
    // del padrón o rol que no le corresponde → 403, sin tocar el disco.
    const autorizacion = SGC.core.autorizacion.verificar(PADRON, cuerpo.contexto);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    if (actual.version !== cuerpo.versionEsperada) { return responderJson(res, 409, { conflicto: true, versionRemota: actual.version }); }
    const contexto = Object.assign({}, cuerpo.contexto, { origen });
    const motor = SGC.core.estados;
    const resultado = accion === 'avanzar'
      ? motor.avanzar(actual, contexto.rol, cuerpo.destino, contexto)
      : motor.devolver(actual, contexto.rol, cuerpo.destino, cuerpo.idMotivo,
        cuerpo.observacion === undefined ? null : cuerpo.observacion, contexto);
    if (!resultado.ok) {
      return responderJson(res, 403, { error: resultado.error });
    }
    const nuevo = resultado.expediente;
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
    escribirAtomico(exp.datos, JSON.stringify(nuevo, null, 2));
    const entrada = repo.entradaIndice(id, nuevo, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true }); escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    // ORDEN-RONDA-08 §2.2: al llegar al estado final el servidor archiva en el
    // mismo ciclo (copia al Archivo, entrada `archivar`, purga del índice); la versión no sube.
    let respondido = nuevo;
    if (nuevo.estado && nuevo.estado.id === SGC.core.config.ESTADO_FINAL) { respondido = archivo.archivarExpediente(datosDir, id, contexto); }
    // ORDEN-RONDA-12 §3.1: registro de eventos (ADR-024). Se registra después
    // de escribir para no perder la línea si la escritura falla.
    if (eventos && typeof eventos.registrarTransicion === 'function') {
      if (accion === 'devolver') {
        eventos.registrarDevolucion(datosDir, id, actual.estado ? actual.estado.id : null,
          nuevo.estado ? nuevo.estado.id : null, cuerpo.idMotivo,
          cuerpo.observacion === undefined ? null : cuerpo.observacion, contexto);
      } else {
        eventos.registrarTransicion(datosDir, id, actual.estado ? actual.estado.id : null,
          nuevo.estado ? nuevo.estado.id : null, contexto);
      }
    }
    return responderJson(res, 200, { version: nuevaVersion, expediente: respondido });
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
  // §3.3, ADR-016). El nombre se valida para que no sea una ruta; la escritura
  // de datos.json es atómica y versionada, igual que el resto de las mutaciones.
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
    // ORDEN-RONDA-08 §2.1: si se declara el id del documento del circuito, debe
    // existir en config.ENTREGABLES; se registra para que la validación del
    // estado lo dé por cumplido.
    const idEntregable = (cuerpo.id === undefined || cuerpo.id === null) ? null : cuerpo.id;
    if (idEntregable !== null) {
      if (typeof idEntregable !== 'string' || idEntregable.length === 0) {
        return responderJson(res, 400, { error: 'el id del entregable debe ser una cadena no vacía' });
      }
      const catalogo = SGC.core.config.ENTREGABLES;
      if (!catalogo || !catalogo.some((e) => e.id === idEntregable)) {
        return responderJson(res, 400, { error: 'el id del entregable no existe en el catálogo: ' + idEntregable });
      }
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
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
    escribirAtomico(rutaEntregable, cuerpo.contenido);
    const actualizado = JSON.parse(JSON.stringify(actual));
    actualizado.version = nuevaVersion;
    if (!Array.isArray(actualizado.entregables)) {
      actualizado.entregables = [];
    }
    actualizado.entregables.push({
      nombre,
      ruta: 'entregables/' + nombre,
      id: idEntregable,
      guardado: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline; filename="' + nombre + '"' });
    res.end(fs.readFileSync(archivo, 'utf8'));
  }

  // Guardar un presupuesto adjunto: vive en server/presupuestos.js
  // (ORDEN-RONDA-09 §3.2), separado por responsabilidad para que este archivo
  // no supere las 400 líneas.

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
    if (actual.version !== versionEsperada) { return responderJson(res, 409, { conflicto: true, versionRemota: actual.version }); }
    // ADR-021: el PUT edita campos pero no puede mover el estado. Si el
    // documento recibido trae un estado distinto del de disco, 409 explícito
    // sin escribir nada. La única vía para cambiar el estado son los extremos
    // /avanzar y /devolver, que pasan por el motor.
    if (expedienteNuevo.estado !== undefined && expedienteNuevo.estado !== null &&
        !estadoIgual(expedienteNuevo.estado, actual.estado)) {
      return responderJson(res, 409, { error: 'el estado de un expediente no se cambia por PUT; use POST /api/expedientes/' + id + '/avanzar o /api/expedientes/' + id + '/devolver' });
    }
    // ORDEN-RONDA-10 §3.1 (auditoría §2.1): el servidor valida los renglones
    // por su cuenta, con las mismas reglas que la pantalla (erroresDeRenglones)
    // y la existencia de cada presupuestoId citado contra los presupuestos que
    // el expediente tiene de verdad en disco.
    if (Array.isArray(expedienteNuevo.renglones)) {
      const presupuestosIds = new Set((Array.isArray(actual.presupuestos) ? actual.presupuestos : [])
        .map((p) => (p && typeof p.id === 'string') ? p.id : ''));
      const erroresRenglones = erroresDeRenglones(expedienteNuevo.renglones, presupuestosIds);
      if (erroresRenglones.length > 0) {
        return responderJson(res, 400, { error: erroresRenglones.join(' · ') });
      }
    }
    // ORDEN-RONDA-10-CIERRE §1.3: la justificación también tiene tope duro en
    // el servidor; un texto de 50.000 caracteres no entra ni por accidente.
    const erroresTextos = SGC.core.validacion.validarJustificaciones(expedienteNuevo);
    if (erroresTextos.length > 0) {
      return responderJson(res, 400, { error: erroresTextos.join(' · ') });
    }
    const erroresEncabezado = SGC.core.validacion.validarEncabezado(expedienteNuevo);
    if (erroresEncabezado.length > 0) {
      return responderJson(res, 400, { error: erroresEncabezado.join(' · ') });
    }
    // ORDEN-RONDA-09 §3.1 (ADR-022 §4): la imputación presupuestaria la
    // completa Contaduría en la Afectación. La restricción vive acá, con la
    // matriz de ADR-021: escribirla desde otro rol u otro estado da 403; si la
    // petición no la trae, se conserva la de disco.
    const imputacionActual = Array.isArray(actual.imputacion) ? actual.imputacion : [];
    const imputacionRecibida = Array.isArray(expedienteNuevo.imputacion) ? expedienteNuevo.imputacion : [];
    const cambiaImputacion = JSON.stringify(imputacionActual) !== JSON.stringify(imputacionRecibida);
    let autorizadoImputacion = true;
    if (cambiaImputacion && imputacionRecibida.length > 0) {
      const autorizacion = SGC.core.autorizacion.verificar(PADRON, contexto);
      if (!autorizacion.ok) { return responderJson(res, 403, { error: autorizacion.error }); }
      if (contexto.rol !== 'contaduria') {
        return responderJson(res, 403, { error: 'la imputación presupuestaria sólo la edita el rol "contaduria" (ADR-022)' });
      }
      if (!actual.estado || actual.estado.id !== 'AFECTACION') {
        return responderJson(res, 403, { error: 'la imputación presupuestaria sólo se edita en el estado "AFECTACION" (ADR-022)' });
      }
    } else if (cambiaImputacion) {
      autorizadoImputacion = false;
    }
    const nuevaVersion = actual.version + 1;
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
    const actualizado = JSON.parse(JSON.stringify(expedienteNuevo));
    actualizado.version = nuevaVersion;
    // ADR-021: la auditoría la escribe el servidor. El PUT edita campos pero no
    // puede agregar ni borrar entradas: se conserva la cadena de disco.
    actualizado.auditoria = actual.auditoria;
    // ORDEN-RONDA-09: si la petición no estaba autorizada a tocar la
    // imputación (la trajo vacía), se conserva la de disco sin pisarla.
    if (cambiaImputacion && !autorizadoImputacion) {
      actualizado.imputacion = actual.imputacion;
    }
    escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true }); escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
    // ORDEN-RONDA-12 §3.1: registro de eventos (ADR-024). Detecta qué cambió.
    if (eventos && typeof eventos.registrarGuardado === 'function') {
      eventos.registrarGuardado(datosDir, id, actual, expedienteNuevo, nuevaVersion, contexto);
    }
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
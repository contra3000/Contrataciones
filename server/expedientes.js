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
const sco = require('./sco.js');

function crearManejadoresExpedientes(entorno) {
  const {
    datosDir,
    repo,
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
    // ORDEN-RONDA-22 §1: el nacimiento tiene dueño. Crear un expediente es
    // ejecutar el primer paso: exige el rol de la primera etapa del circuito
    // (ESPECIFICACIONES_TECNICAS → generador). Antes de quemar un número, el
    // servidor cruza el contexto contra el padrón (ADR-021) y, con los roles
    // efectivos de ADR-033, exige que ese operador pueda originar. Nunca se
    // confía en el rol que el cliente declara por fuera de su padrón.
    const autorizacionDelNacimiento = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), contexto);
    if (!autorizacionDelNacimiento.ok) {
      return responderJson(res, 403, { error: autorizacionDelNacimiento.error });
    }
    const rolDelPrimerPaso = SGC.core.config.ESTADOS[0].rolEjecutor;
    if (SGC.core.config.rolesEfectivos(contexto.rol).indexOf(rolDelPrimerPaso) === -1) {
      return responderJson(res, 403, {
        error: 'crear un expediente exige el rol "' + rolDelPrimerPaso + '", el que ejecuta la primera etapa del circuito (' +
          SGC.core.config.ESTADOS[0].id + ')'
      });
    }
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

  // Estado de la Fase 1. ORDEN-RONDA-27 pieza 4: la SCo no se rehace en bloque
  // acá, cada generador corrige y avanza el suyo.
  const ESTADO_FASE1 = 'ESPECIFICACIONES_TECNICAS';

  // Pieza 5 engancha acá el requisito de ANEXO I por SCo. En la pieza 4 la SCo
  // no exige nada más allá de lo que exige cada expediente.
  function requisitosDeSCo(nuevo, contexto, anterior) {
    return { ok: true };
  }

  function estadoIdDe(expediente) {
    return expediente && expediente.estado && typeof expediente.estado.id === 'string'
      ? expediente.estado.id
      : null;
  }

  // ORDEN-RONDA-27 pieza 4: con SCo, decidir si el movimiento es del grupo o de
  // uno solo, antes de tocar nada.
  //  - sin número: como siempre, uno solo.
  //  - el registro no lista al expediente: inconsistencia. Se niega, porque
  //    moverlo solo partiría la SCo en dos sin que nadie lo pidiera.
  //  - en Fase 1: uno solo, es individual por decisión de la ronda 27.
  //  - `avanzar` con los miembros en estados distintos: no se mueve nadie. La
  //    SCo no sale de SOLICITUD_CONTRATACION hasta que estén todos de vuelta.
  //  - en cualquier otro caso: se mueven todos.
  function planDeMovimiento(datosDirLocal, actual, accion) {
    const grupo = sco.grupoDeExpediente(datosDirLocal, actual);
    if (!grupo) {
      return { modo: 'sinGrupo' };
    }
    if (!grupo.contiene) {
      return { modo: 'inconsistente', grupo: grupo };
    }
    if (estadoIdDe(actual) === ESTADO_FASE1) {
      return { modo: 'individual', grupo: grupo };
    }
    if (accion === 'avanzar') {
      const miembros = sco.miembrosConEstado(datosDirLocal, grupo.registro);
      const propios = miembros.filter((m) => m.estado === estadoIdDe(actual));
      if (propios.length !== miembros.length) {
        const atrados = miembros.filter((m) => m.estado !== estadoIdDe(actual));
        return { modo: 'mixto', grupo: grupo, atrados: atrados };
      }
    }
    return { modo: 'grupo', grupo: grupo };
  }

  // Texto para la pantalla de "Avanzar": a quién falta volver.
  function textoEsperando(grupo, id) {
    if (!grupo) {
      return null;
    }
    const miembros = sco.miembrosConEstado(datosDir, grupo.registro);
    const atrados = miembros.filter((m) => m.estado !== sco.ESTADO_SOLICITUD && m.id !== id);
    const mismos = miembros.filter((m) => m.estado === sco.ESTADO_SOLICITUD && m.id !== id);
    return {
      numeroSCo: grupo.numeroSCo,
      atrados: atrados.map((m) => m.id),
      esperando: mismos.map((m) => m.id),
      texto: atrados.length > 0
        ? 'la SCo ' + grupo.numeroSCo + ' no sale de ' + sco.ESTADO_SOLICITUD +
          ' hasta que vuelvan: ' + atrados.map((m) => m.id).join(', ')
        : ''
    };
  }

  // Paso 1 de la pieza 4: correr el motor sobre UN expediente y decir a dónde
  // se llega, sin escribir nada. Así se valida a todos los miembros antes de
  // tocar el primer archivo.
  function calcular(actual, cuerpo, contexto, accion, grupoTexto) {
    const motor = SGC.core.estados;
    const resultado = accion === 'avanzar'
      ? motor.avanzar(actual, contexto.rol, cuerpo.destino, contexto)
      : motor.devolver(actual, contexto.rol, cuerpo.destino, cuerpo.idMotivo,
        cuerpo.observacion === undefined ? null : cuerpo.observacion, contexto);
    if (!resultado.ok) {
      return { ok: false, status: 403, cuerpo: { error: resultado.error } };
    }
    const nuevo = resultado.expediente;
    // ADR-033 (§3.5): el motor dejó rolEfectivo cuando un rol heredado ejecutó
    // el paso; se propaga al contexto para que el evento de ADR-024 lo copie.
    const entradas = Array.isArray(nuevo.auditoria) ? nuevo.auditoria : [];
    const ultimaEntrada = entradas.length > 0 ? entradas[entradas.length - 1] : null;
    if (ultimaEntrada && typeof ultimaEntrada.rolEfectivo === 'string') {
      contexto.rolEfectivo = ultimaEntrada.rolEfectivo;
    }
    // Pieza 4 §3: la auditoría de cada expediente dice en qué grupo se movió.
    if (grupoTexto) {
      if (ultimaEntrada) {
        ultimaEntrada.grupo = grupoTexto;
      }
      contexto.grupo = grupoTexto;
    }
    const requisitos = requisitosDeSCo(nuevo, contexto, actual);
    if (!requisitos.ok) {
      return { ok: false, status: 409, cuerpo: { error: requisitos.error } };
    }
    if (typeof contexto.timestamp === 'string') { nuevo.ultimaModificacion = contexto.timestamp; }
    if (typeof contexto.email === 'string') { nuevo.ultimoUsuario = contexto.email; }
    return { ok: true, nuevo: nuevo, nuevaVersion: actual.version + 1 };
  }

  // Paso 2: persistir UN expediente ya calculado. Deja el `hist/` de la versión
  // anterior, que es de donde se restaura si después falla otro del grupo. El
  // archivado (ORDEN-RONDA-08 §2.2) y los eventos (ADR-024) los hace el
  // llamador, para que ocurran una sola vez y sólo si el grupo entero quedó
  // escrito.
  function escribirUno(exp, id, actual, plan, contexto) {
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
    escribirAtomico(exp.datos, JSON.stringify(plan.nuevo, null, 2));
    escribirIndice(id, plan.nuevo, contexto);
  }

  function escribirIndice(id, expediente, contexto) {
    const entrada = repo.entradaIndice(id, expediente, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
  }

  // Pieza 4 §2: si una escritura falla a la mitad, se restauran las anteriores
  // desde `hist/`, que es la copia de la versión previa que se acaba de dejar.
  function restaurarUno(exp, id, versionPrevia, contextoPrevio) {
    const hist = path.join(exp.dir, 'hist', 'v' + versionPrevia + '.json');
    const previo = JSON.parse(fs.readFileSync(hist, 'utf8'));
    escribirAtomico(exp.datos, JSON.stringify(previo, null, 2));
    escribirIndice(id, previo, contextoPrevio);
    return previo;
  }

  function archivarSiCorresponde(id, plan, contexto) {
    if (plan.nuevo.estado && plan.nuevo.estado.id === SGC.core.config.ESTADO_FINAL) {
      return archivo.archivarExpediente(datosDir, id, contexto);
    }
    return plan.nuevo;
  }

  // ORDEN-RONDA-12 §3.1: el registro de eventos va después de escribir, para no
  // perder la línea si la escritura falla.
  function registrarEvento(id, actual, plan, cuerpo, contexto, accion) {
    if (!eventos || typeof eventos.registrarTransicion !== 'function') {
      return;
    }
    if (accion === 'devolver') {
      eventos.registrarDevolucion(datosDir, id, estadoIdDe(actual), estadoIdDe(plan.nuevo),
        cuerpo.idMotivo, cuerpo.observacion === undefined ? null : cuerpo.observacion, contexto);
    } else {
      eventos.registrarTransicion(datosDir, id, estadoIdDe(actual), estadoIdDe(plan.nuevo), contexto);
    }
  }

  // Movimiento de un expediente solo: el camino de siempre.
  function moverSolo(res, id, actual, cuerpo, contexto, accion, extra) {
    const plan = calcular(actual, cuerpo, contexto, accion, null);
    if (!plan.ok) {
      return responderJson(res, plan.status, plan.cuerpo);
    }
    escribirUno(rutaExpediente(datosDir, id), id, actual, plan, contexto);
    const contestado = archivarSiCorresponde(id, plan, contexto);
    registrarEvento(id, actual, plan, cuerpo, contexto, accion);
    return responderJson(res, 200,
      Object.assign({ version: plan.nuevaVersion, expediente: contestado }, extra || {}));
  }

  // ORDEN-RONDA-27 pieza 4: la SCo se mueve en bloque, todo o nada. Valida a
  // todos primero, recién después escribe, y si una escritura falla deshace las
  // anteriores desde `hist/`. El candado de la SCo cubre lectura, validación y
  // escritura, para que dos operadores no se entrelacen.
  function moverEnBloque(res, id, cuerpo, contextoBase, accion, grupo) {
    const grupoTexto = 'SCo ' + grupo.numeroSCo;
    const verbo = accion === 'avanzar' ? 'avanzar' : 'devolver';
    let salida;
    try {
      salida = sco.conCandadoGrupo(datosDir, grupo.registro, function () {
        const miembros = [];
        const ausentes = [];
        for (const idMiembro of grupo.ids) {
          const exp = rutaExpediente(datosDir, idMiembro);
          if (!fs.existsSync(exp.datos)) {
            ausentes.push(idMiembro);
            continue;
          }
          miembros.push({
            id: idMiembro,
            exp: exp,
            actual: JSON.parse(fs.readFileSync(exp.datos, 'utf8'))
          });
        }
        if (ausentes.length > 0) {
          return { status: 409, cuerpo: { error: 'no se puede ' + verbo + ' la ' + grupoTexto +
            ': el registro nombra ' + ausentes.join(', ') + ' y no está(n) en la carpeta. ' +
            'Sacá esos expedientes del número de SCo antes de moverla.' } };
        }

        // Paso 1: validar a todos, sin escribir nada.
        const planes = [];
        for (let i = 0; i < miembros.length; i++) {
          const contexto = Object.assign({}, contextoBase);
          const plan = calcular(miembros[i].actual, cuerpo, contexto, accion, grupoTexto);
          planes.push({ plan: plan, contexto: contexto });
          if (!plan.ok) {
            return { status: plan.status, cuerpo: { error: 'no se puede ' + verbo + ' la ' +
              grupoTexto + ' (' + miembros.length + ' expedientes): el ' + miembros[i].id +
              ' no cumple. ' + plan.cuerpo.error + '. No se movió ninguno.' } };
          }
        }

        // Paso 2: escribir a todos. Si algo falla, se deshace lo ya escrito.
        const escritos = [];
        try {
          for (let i = 0; i < miembros.length; i++) {
            escribirUno(miembros[i].exp, miembros[i].id, miembros[i].actual,
              planes[i].plan, planes[i].contexto);
            escritos.push(i);
          }
        } catch (e) {
          const restaurados = [];
          for (const i of escritos) {
            try {
              restaurarUno(miembros[i].exp, miembros[i].id, miembros[i].actual.version,
                { email: miembros[i].actual.ultimoUsuario, timestamp: miembros[i].actual.ultimaModificacion });
              restaurados.push(miembros[i].id);
            } catch (e2) {
              restaurados.push(miembros[i].id + ' (NO se pudo restaurar: ' + e2.message + ')');
            }
          }
          return { status: 500, cuerpo: { error: 'falló la escritura de la ' + grupoTexto +
            ' a mitad de camino (' + e.message + '). Se restauraron ' + restaurados.length +
            ' de ' + miembros.length + ': ' + (restaurados.join(', ') || '—') +
            '. La SCo quedó como estaba.' } };
        }

        // Todo el grupo quedó escrito: recién ahora se archiva y se registra.
        let propio = null;
        let versionPropia = 0;
        for (let i = 0; i < miembros.length; i++) {
          const contestado = archivarSiCorresponde(miembros[i].id, planes[i].plan, planes[i].contexto);
          registrarEvento(miembros[i].id, miembros[i].actual, planes[i].plan, cuerpo,
            planes[i].contexto, accion);
          if (miembros[i].id === id) {
            propio = contestado;
            versionPropia = planes[i].plan.nuevaVersion;
          }
        }
        return { status: 200, cuerpo: {
          version: versionPropia,
          expediente: propio,
          grupo: { numeroSCo: grupo.numeroSCo, movidos: miembros.map((m) => m.id) }
        } };
      });
    } catch (e) {
      // El candado no se pudo tomar: otro movimiento de esta SCo está en curso.
      return responderJson(res, e.codigo === 409 ? 409 : 500, { error: e.message });
    }
    return responderJson(res, salida.status, salida.cuerpo);
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
    const autorizacion = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), cuerpo.contexto);
    if (!autorizacion.ok) {
      return responderJson(res, 403, { error: autorizacion.error });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    if (actual.version !== cuerpo.versionEsperada) { return responderJson(res, 409, { conflicto: true, versionRemota: actual.version, ultimoUsuario: actual.ultimoUsuario || null, ultimaModificacion: actual.ultimaModificacion || null }); }
    const contexto = Object.assign({}, cuerpo.contexto, { origen });
    const plan = planDeMovimiento(datosDir, actual, accion);
    if (plan.modo === 'inconsistente') {
      return responderJson(res, 409, { error: 'el expediente dice el número de SCo ' +
        plan.grupo.numeroSCo + ' pero el registro de esa SCo no lo lista. ' +
        'Guardá otra vez el número para volver a incorporarlo: moverlo sólo partiría la SCo.' });
    }
    if (plan.modo === 'mixto') {
      const nombres = plan.atrados.map((m) => m.id + ' (en ' + (m.estado || 'un estado desconocido') + ')');
      return responderJson(res, 409, { error: 'no se puede ' +
        (accion === 'avanzar' ? 'avanzar' : 'devolver') + ' la SCo ' + plan.grupo.numeroSCo +
        ' en bloque: ' + nombres.join(', ') + ' está(n) en otro estado. ' +
        'La SCo no sale de ' + sco.ESTADO_SOLICITUD + ' hasta que estén todos de vuelta.',
        sco: textoEsperando(plan.grupo, id) });
    }
    if (plan.modo === 'grupo') {
      return moverEnBloque(res, id, cuerpo, contexto, accion, plan.grupo);
    }
    return moverSolo(res, id, actual, cuerpo, contexto, accion,
      plan.grupo ? { sco: textoEsperando(plan.grupo, id) } : null);
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
    // ORDEN-RONDA-23 §2: guardar un entregable es una operación del estado en
    // curso; la exige quien ejecuta ese estado (su rolEjecutor), no cualquier
    // usuario del padrón. Es el mismo cruce que apiCrear hace con la primera
    // etapa, aplicado a la etapa que está abierta ahora.
    const autorizacionDelEstado = SGC.core.autorizacion.autorizarRolDelEstado(
      entorno.padronVivo.usuarios(), contexto, actual.estado ? actual.estado.id : null);
    if (!autorizacionDelEstado.ok) {
      return responderJson(res, 403, { error: autorizacionDelEstado.error });
    }
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
    }
    // ADR-042: el servidor recuerda quién escribió la última versión. El campo
    // se guarda siempre (no sólo si ya existía) para que el 409 de conflicto
    // pueda distinguir "lo cambió otro operador" de "lo cambiaste vos en otra
    // pestaña" (ORDEN-RONDA-21 §1.1).
    if (typeof contexto.timestamp === 'string') { actualizado.ultimaModificacion = contexto.timestamp; }
    if (typeof contexto.email === 'string') { actualizado.ultimoUsuario = contexto.email; }
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
    if (actual.version !== versionEsperada) { return responderJson(res, 409, { conflicto: true, versionRemota: actual.version, ultimoUsuario: actual.ultimoUsuario || null, ultimaModificacion: actual.ultimaModificacion || null }); }
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
    // ORDEN-RONDA-25 §6: corregir los renglones de un requerimiento en curso es
    // una operación del estado en curso; la exige quien ejecuta ese estado con
    // autorizarRolDelEstado, la misma guardia que rige presupuestos y
    // entregables (ORDEN-RONDA-23 §2). Quien no ejecuta el estado recibe 403
    // antes de que se escriba nada. El resto del PUT no se toca: editar campos
    // con los renglones intactos sigue su curso normal.
    const renglonesActual = Array.isArray(actual.renglones) ? actual.renglones : [];
    const renglonesRecibidos = Array.isArray(expedienteNuevo.renglones) ? expedienteNuevo.renglones : [];
    if (JSON.stringify(renglonesActual) !== JSON.stringify(renglonesRecibidos)) {
      const autorizacionDeRenglones = SGC.core.autorizacion.autorizarRolDelEstado(
        entorno.padronVivo.usuarios(), contexto, actual.estado ? actual.estado.id : null);
      if (!autorizacionDeRenglones.ok) {
        return responderJson(res, 403, { error: autorizacionDeRenglones.error });
      }
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
      const autorizacion = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), contexto);
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
    // ORDEN-RONDA-27 pieza 3: la SCo es un registro propio, no un texto suelto.
    // Si el PUT cambia `campos.numeroSCo`, el servidor suma o saca el
    // expediente del registro correspondiente. Todas las validaciones (que el
    // número sirva como nombre de archivo, que se pueda sumar a esa SCo, que se
    // pueda salir de la anterior) pasan ANTES de que se escriba nada: un 409
    // aquí no deja ni el expediente a medio guardar ni el registro a medio
    // tocar. Cambiar el número de SCo es una operación del estado en curso y
    // lleva la misma guardia que los renglones (ORDEN-RONDA-25 §6).
    const numeroAnterior = sco.numeroUtil(repo.numeroSCoDe(actual));
    const numeroNuevo = sco.numeroUtil(repo.numeroSCoDe(expedienteNuevo));
    if (numeroNuevo !== null && numeroNuevo !== numeroAnterior) {
      const autorizacionDeSCo = SGC.core.autorizacion.autorizarRolDelEstado(
        entorno.padronVivo.usuarios(), contexto, actual.estado ? actual.estado.id : null);
      if (!autorizacionDeSCo.ok) {
        return responderJson(res, 403, { error: autorizacionDeSCo.error });
      }
      // Simulación de las dos operaciones: son las mismas funciones que van a
      // escribir después, pero sin escribir, para no dejar el registro
      // adelantado si la suma va a ser rechazada.
      const pruebaSalida = numeroAnterior === null
        ? { ok: true }
        : sco.sinEscribir(() => sco.salir(datosDir, {
          idExpediente: id, numeroSCo: numeroAnterior, contexto: contexto
        }));
      if (!pruebaSalida.ok) {
        return responderJson(res, pruebaSalida.codigo, { error: pruebaSalida.error });
      }
      const pruebaSuma = sco.sinEscribir(() => sco.sumarse(datosDir, {
        idExpediente: id,
        numeroSCo: numeroNuevo,
        contexto: contexto,
        versionEsperadaSCO: typeof cuerpo.versionEsperadaSCO === 'number'
          ? cuerpo.versionEsperadaSCO : undefined
      }));
      if (!pruebaSuma.ok) {
        return responderJson(res, pruebaSuma.codigo, {
          error: pruebaSuma.error,
          conflicto: pruebaSuma.conflicto || false,
          versionRemota: pruebaSuma.versionRemota === undefined ? null : pruebaSuma.versionRemota
        });
      }
      if (numeroAnterior !== null) {
        sco.salir(datosDir, { idExpediente: id, numeroSCo: numeroAnterior, contexto: contexto });
      }
      sco.sumarse(datosDir, {
        idExpediente: id,
        numeroSCo: numeroNuevo,
        contexto: contexto,
        versionEsperadaSCO: typeof cuerpo.versionEsperadaSCO === 'number'
          ? cuerpo.versionEsperadaSCO : undefined
      });
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
    if (typeof contexto.timestamp === 'string') { actualizado.ultimaModificacion = contexto.timestamp; }
    if (typeof contexto.email === 'string') { actualizado.ultimoUsuario = contexto.email; }
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
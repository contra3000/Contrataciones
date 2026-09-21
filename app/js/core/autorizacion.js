/*
 * autorizacion.js
 * ORDEN-RONDA-07 §2.1. Cruce del contexto declarado contra el padrón de
 * usuarios (config/usuarios.ejemplo.json) antes de que el motor autorice una
 * transición. El rol que declara el cliente tiene que pertenecer a los roles
 * del correo en el padrón; si no, el servidor no le cree (es la pregunta del
 * auditor en ordenes/ORDEN-RONDA-07-AUDITORIA.md §2.2: la autorización no
 * puede depender de un dato que el cliente elige).
 *
 * Es puro: no hace I/O. Quien consume (el servidor y repo.memoria) le pasa el
 * arreglo de usuarios del padrón, leído una vez al cargar el módulo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('autorizacion.js requiere que namespaces.js se cargue primero');
  }

  // Verifica que el contexto declare un correo del padrón activo y que el rol
  // declarado esté entre los efectos del rol de ese correo (el propio más los
  // heredados, ADR-033). Devuelve {ok:true} o {ok:false, error} con el motivo
  // en español. Un padrón vacío o ausente rechaza todo (fail closed).
  function verificar(usuarios, contexto) {
    var ctx = contexto || {};
    var email = typeof ctx.email === 'string' ? ctx.email.trim() : '';
    var rol = typeof ctx.rol === 'string' ? ctx.rol.trim() : '';
    if (!email || !rol) {
      return { ok: false, error: 'el contexto debe declarar el correo y el rol' };
    }
    var lista = Array.isArray(usuarios) ? usuarios : [];
    var usuario = null;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].email === email && lista[i].activo !== false) {
        usuario = lista[i];
        break;
      }
    }
    if (!usuario) {
      return { ok: false, error: 'el correo "' + email + '" no está en el padrón de usuarios' };
    }
    // ADR-033: un solo rol por persona. Se admite `roles` por compatibilidad
    // con los padrones viejos; el primero en un orden estable.
    var propio = typeof usuario.rol === 'string' && usuario.rol !== ''
      ? usuario.rol
      : (Array.isArray(usuario.roles) && usuario.roles.length > 0 ? usuario.roles[0] : '');
    var efectivos = SGC.core.config.rolesEfectivos(propio);
    for (var j = 0; j < efectivos.length; j++) {
      if (efectivos[j] === rol) {
        return { ok: true };
      }
    }
    return { ok: false, error: 'el rol "' + rol + '" no corresponde al correo "' + email + '" en el padrón' };
  }

  // ORDEN-RONDA-23 §2: hay operaciones que no son "de la persona" sino "del
  // estado": guardar el presupuesto o el entregable de la etapa en curso las
  // hace quien ejecuta esa etapa (config.ESTADOS[].rolEjecutor). Cruza primero
  // el contexto contra el padrón (como verificar) y después pregunta si el rol
  // de ese correo —con sus heredados, ADR-033— incluye el rol del estado.
  // Devuelve {ok:true} o {ok:false, error} en español.
  function autorizarRolDelEstado(usuarios, contexto, idEstado) {
    var v = verificar(usuarios, contexto);
    if (!v.ok) {
      return v;
    }
    var estados = SGC.core.config.ESTADOS;
    var estado = null;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === idEstado) {
        estado = estados[i];
        break;
      }
    }
    if (!estado) {
      return { ok: false, error: 'el expediente no tiene un estado actual válido' };
    }
    var rol = contexto.rol.trim();
    if (SGC.core.config.rolesEfectivos(rol).indexOf(estado.rolEjecutor) === -1) {
      return {
        ok: false,
        error: 'esta operación exige el rol "' + estado.rolEjecutor +
          '", el que ejecuta el estado actual ("' + estado.id + '")'
      };
    }
    return { ok: true };
  }

  SGC.core.autorizacion = {
    verificar: verificar,
    autorizarRolDelEstado: autorizarRolDelEstado
  };
})(typeof window !== 'undefined' ? window : globalThis);
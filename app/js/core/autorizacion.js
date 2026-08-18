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
  // declarado esté entre los roles de ese correo. Devuelve {ok:true} o
  // {ok:false, error} con el motivo en español. Un padrón vacío o ausente
  // rechaza todo (fail closed).
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
    var roles = Array.isArray(usuario.roles) ? usuario.roles : [];
    for (var j = 0; j < roles.length; j++) {
      if (roles[j] === rol) {
        return { ok: true };
      }
    }
    return { ok: false, error: 'el rol "' + rol + '" no corresponde al correo "' + email + '" en el padrón' };
  }

  SGC.core.autorizacion = { verificar: verificar };
})(typeof window !== 'undefined' ? window : globalThis);
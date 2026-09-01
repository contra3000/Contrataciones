'use strict';

/*
 * padron-administracion.js
 * ORDEN-RONDA-17 §1.3-§1.6 (H21). Administración del padrón desde la
 * aplicación. La marca `administrador: true` (ADB-037: un atributo de persona,
 * NO un rol agregado) gobierna qué puede tocar el padrón; el resto de reglas
 * siguen en la matriz de roles (config.js). El servidor nunca deja al sistema
 * sin al menos un administrador activo (regla anti-encierro).
 *
 * Todos los manejadores exigen sesión confirmada de un administrador activo,
 * verificado contra el padrón EN VIVO (el rol no lo elige el cliente).
 *
 * IMPORTANTE: estas rutas se cuelgan del servidor con "padronAdmin.enrutar" y
 * corren bajo protegerRuta() (capaSesion), así que el contexto viene de la
 * sesión, no del cuerpo.
 */

const credenciales = require('./credenciales.js');
const { diccionarioDePalabras } = require('./palabras.js');
const { crearCapaCsv } = require('./padron-csv.js');

const SUFIJOS_INVALIDOS = [';', '\r', '\n'];
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function crearManejadoresPadron(entorno) {
  const { responderJson, parsearCuerpo } = entorno.ayudantes;
  const SGC = globalThis.SGC;
  const ROLES = SGC.core.config.ROLES.map((r) => r.id);

  function leerPadron() {
    return entorno.padronVivo.leer() || { schemaVersion: '2.0.0', usuarios: [] };
  }

  function guardarPadron(padron) {
    entorno.padronVivo.guardar(padron);
  }

  function buscar(padron, email) {
    return Array.isArray(padron.usuarios)
      ? padron.usuarios.find((u) => u && u.email === email) || null
      : null;
  }

  // Administrador activo autenticado (la sesión manda el email y el rol; el
  // cruce contra el padrón lo hace autorizacion.verificar como en el resto).
  // Contexto para el cruce de autorización: primero el del cuerpo (la sesión
  // ya se inyectó server-side) y, si la petición no trae cuerpo (GET exportar),
  // la sesión que protegerRuta adjuntó en req.sgcSesion.
  function contextoDe(cuerpo, req) {
    if (cuerpo && cuerpo.contexto) {
      return cuerpo.contexto;
    }
    const s = req && req.sgcSesion;
    return s ? { email: s.email, rol: s.rol } : null;
  }

  function esAdministrador(contexto) {
    const cx = contexto || {};
    const usuarios = entorno.padronVivo.usuarios();
    const v = SGC.core.autorizacion.verificar(usuarios, cx);
    if (!v.ok) {
      return { ok: false, error: v.error };
    }
    const usuario = usuarios.find((u) => u && u.email === cx.email);
    if (!usuario || usuario.activo === false) {
      return { ok: false, error: 'su cuenta no está activa en el padrón' };
    }
    if (usuario.administrador !== true) {
      return { ok: false, error: 'solo el administrador puede administrar el padrón' };
    }
    return { ok: true, usuario };
  }

  function exigirAdmin(res, req, cuerpo) {
    const cx = contextoDe(cuerpo, req);
    if (!cx) {
      responderJson(res, 403, { ok: false, error: 'esta operación exige una sesión de administrador' });
      return null;
    }
    const r = esAdministrador(cx);
    if (!r.ok) {
      responderJson(res, 403, r);
      return null;
    }
    return r;
  }

  function adminsActivos(padron) {
    return padron.usuarios.filter((u) => u && u.administrador === true && u.activo !== false);
  }

  // Prohibido dejar al sistema sin administrador activo (anti-encierro).
  function chequearAntiEncierro(padron, email, accion) {
    const target = buscar(padron, email);
    if (!target || target.administrador !== true || target.activo === false) {
      return null;
    }
    if (adminsActivos(padron).length <= 1) {
      return 'no se puede ' + accion + ' al único administrador activo (el sistema no puede quedarse sin administrador)';
    }
    return null;
  }

  function detallePublico(padron) {
    return padron.usuarios.map((u) => ({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      rol: u.rol,
      sector: u.sector || null,
      activo: u.activo !== false,
      administrador: u.administrador === true,
      provisoria: !!(u.credenciales && u.credenciales.provisoria === true),
      bloqueado: !!(u.credenciales && u.credenciales.bloqueado === true)
    }));
  }

  // ---------------------------------------------------------------------------
  // Rutas
  // ---------------------------------------------------------------------------

  function apiListar(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    return responderJson(res, 200, { usuarios: detallePublico(leerPadron()) });
  }

  function apiAlta(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
    const apellido = typeof cuerpo.apellido === 'string' ? cuerpo.apellido.trim() : '';
    const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : '';
    const rol = typeof cuerpo.rol === 'string' ? cuerpo.rol.trim() : '';
    const sector = typeof cuerpo.sector === 'string' && cuerpo.sector.trim() !== ''
      ? cuerpo.sector.trim()
      : null;
    if (!nombre || !apellido || !email || !rol) {
      return responderJson(res, 400, { error: 'alta: faltan datos (nombre, apellido, email y rol son obligatorios)' });
    }
    if (SUFIJOS_INVALIDOS.some((c) => email.indexOf(c) !== -1) || !RE_EMAIL.test(email)) {
      return responderJson(res, 400, { error: 'alta: el email "' + email + '" no es válido' });
    }
    if (ROLES.indexOf(rol) === -1) {
      return responderJson(res, 400, { error: 'alta: el rol "' + rol + '" no existe (roles: ' + ROLES.join(', ') + ')' });
    }
    const padron = leerPadron();
    if (buscar(padron, email)) {
      return responderJson(res, 409, { error: 'alta: el correo "' + email + '" ya está en el padrón' });
    }
    const clave = credenciales.generarClave(diccionarioDePalabras());
    padron.usuarios.push({
      nombre,
      apellido,
      email,
      rol,
      sector,
      activo: true,
      credenciales: Object.assign(credenciales.crearHash(clave), {
        provisoria: true,
        fallosContinuos: 0,
        bloqueado: false
      })
    });
    guardarPadron(padron);
    return responderJson(res, 200, { creado: { email, nombre, apellido, rol }, clave });
  }

  function apiBaja(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    const bloqueo = chequearAntiEncierro(padron, email, 'dar de baja');
    if (bloqueo) {
      return responderJson(res, 422, { error: bloqueo });
    }
    usuario.activo = false;
    guardarPadron(padron);
    return responderJson(res, 200, { email, activo: false });
  }

  function apiReactivar(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    usuario.activo = true;
    guardarPadron(padron);
    return responderJson(res, 200, { email, activo: true });
  }

  function apiCambiarRol(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const rol = typeof cuerpo.rol === 'string' ? cuerpo.rol.trim() : '';
    if (ROLES.indexOf(rol) === -1) {
      return responderJson(res, 400, { error: 'el rol "' + rol + '" no existe (roles: ' + ROLES.join(', ') + ')' });
    }
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    // Anti-encierro (§1.6): el único administrador activo no puede cambiarse
    // el rol (quedaría el sistema sin administrador).
    const esAdminActivo = usuario.administrador === true && usuario.activo !== false
      && usuario.rol !== rol;
    if (esAdminActivo && adminsActivos(padron).length <= 1) {
      return responderJson(res, 422, {
        error: 'no se puede cambiar el rol al único administrador activo (el sistema no puede quedarse sin administrador)'
      });
    }
    usuario.rol = rol;
    guardarPadron(padron);
    return responderJson(res, 200, { email, rol });
  }

  function apiReponerClave(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    const clave = credenciales.generarClave(diccionarioDePalabras());
    usuario.credenciales = Object.assign(credenciales.crearHash(clave), {
      provisoria: true,
      fallosContinuos: 0,
      bloqueado: false
    });
    guardarPadron(padron);
    return responderJson(res, 200, { email, clave });
  }

  function apiDesbloquear(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    if (usuario.credenciales) {
      usuario.credenciales.bloqueado = false;
      usuario.credenciales.fallosContinuos = 0;
    }
    guardarPadron(padron);
    return responderJson(res, 200, { email, bloqueado: false });
  }

  function apiMarcarAdministrador(req, res, textoCuerpo, email) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const administrador = cuerpo.administrador === true;
    const padron = leerPadron();
    const usuario = buscar(padron, email);
    if (!usuario) {
      return responderJson(res, 404, { error: 'no existe el operador "' + email + '" en el padrón' });
    }
    if (!administrador) {
      const bloqueo = chequearAntiEncierro(padron, email, 'quitarle la marca de administrador');
      if (bloqueo) {
        return responderJson(res, 422, { error: bloqueo });
      }
    }
    usuario.administrador = administrador;
    guardarPadron(padron);
    return responderJson(res, 200, { email, administrador });
  }

  // Importación/exportación CSV (diff, todo-o-nada, BOM) en padron-csv.js.
  const csvCapa = crearCapaCsv(entorno, exigirAdmin);

  // ---------------------------------------------------------------------------
  // Despacho por ruta (se cuelga del router general del servidor).
  // ---------------------------------------------------------------------------

  function enrutar(req, res, conCuerpo, api) {
    const ruta = (req.url || '').split('?')[0];
    if (ruta === '/api/padron' && req.method === 'GET') {
      return conCuerpo((r, s, texto) => api.apiPadronListar(r, s, texto));
    }
    if (ruta === '/api/padron/alta' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => api.apiPadronAlta(r, s, texto));
    }
    if (ruta === '/api/padron/exportar' && req.method === 'GET') {
      return conCuerpo((r, s, texto) => api.apiPadronExportar(r, s, texto));
    }
    if (ruta === '/api/padron/importar' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => api.apiPadronImportar(r, s, texto));
    }
    if (ruta.startsWith('/api/padron/')) {
      const partes = ruta.slice('/api/padron/'.length).split('/').filter(Boolean);
      if (partes.length === 2) {
        const email = decodeURIComponent(partes[0]);
        const accion = partes[1];
        if (accion === 'baja' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronBaja(r, s, texto, email));
        }
        if (accion === 'reactivar' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronReactivar(r, s, texto, email));
        }
        if (accion === 'rol' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronRol(r, s, texto, email));
        }
        if (accion === 'clave' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronClave(r, s, texto, email));
        }
        if (accion === 'desbloquear' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronDesbloquear(r, s, texto, email));
        }
        if (accion === 'administrador' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => api.apiPadronAdministrador(r, s, texto, email));
        }
      }
    }
    return null;
  }

  return {
    apiPadronListar: apiListar,
    apiPadronAlta: apiAlta,
    apiPadronBaja: apiBaja,
    apiPadronReactivar: apiReactivar,
    apiPadronRol: apiCambiarRol,
    apiPadronClave: apiReponerClave,
    apiPadronDesbloquear: apiDesbloquear,
    apiPadronAdministrador: apiMarcarAdministrador,
    apiPadronExportar: csvCapa.apiExportarCsv,
    apiPadronImportar: csvCapa.apiImportar,
    esAdministrador,
    enrutar
  };
}

module.exports = { crearManejadoresPadron };
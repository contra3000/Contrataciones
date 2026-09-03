/*
 * sesion.js
 * ORDEN-RONDA-14 §3.4 a §3.6 (ADR-033, ADR-027). Sesión del operador y modo
 * autenticado del servidor.
 *
 * MODO AUTENTICADO: con un padrón real con credenciales en <datos>/padron.json,
 * toda /api/* exige sesión vía cookie `sgc_sesion=<id>` (HttpOnly, SameSite=
 * Strict), de 15 minutos de inactividad. El contexto lo fabrica el servidor
 * desde la sesión: el cliente no declara su rol. Sin padrón real, el servidor
 * queda en modo declarado (tests y desarrollo).
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const credenciales = require('./credenciales.js');
const identidad = require('./identidad.js');

const NOMBRE_COOKIE = 'sgc_sesion';
const TIEMPO_SESION_MS = 15 * 60 * 1000;
const MAX_FALLOS = 10;
const DEMORA_FALLO_MS = 1000;
const RUTA_PADRON = 'padron.json';
const RUTA_EVENTOS = 'padron.eventos.jsonl';

// En modo autenticado lo público es los estáticos más /api/salud y el login.
function esPublica(ruta, metodo) {
  return ruta === '/api/salud' ||
    (ruta === '/api/sesion/login' && metodo === 'POST');
}

// Con sesión provisoria el operador no puede operar: sólo cambiar la clave,
// salir y ver su propio estado.
function esDeTransicionProvisoria(ruta) {
  return ruta === '/api/sesion/cambio-clave' ||
    ruta === '/api/sesion/salir' ||
    ruta === '/api/sesion/actual';
}

function crearCapaSesion(datosDir, ayudantes, padronVivo) {
  const { responderJson, escribirAtomico } = ayudantes;

  const rutaPadron = path.join(datosDir, RUTA_PADRON);
  const rutaEventos = path.join(datosDir, RUTA_EVENTOS);
  const sesiones = new Map();

  // -- Padrón real ---------------------------------------------------------
  function esModoAutenticado() {
    if (!padronVivo || !padronVivo.existe()) {
      return false;
    }
    try {
      const usuarios = padronVivo.usuarios();
      return usuarios.some((u) => u && u.credenciales && typeof u.credenciales.hash === 'string');
    } catch (e) {
      return false;
    }
  }

  // Lee el padrón completo (para lectura+escritura, ej. login que actualiza fallos).
  function leerPadron() {
    return padronVivo ? padronVivo.leer() : null;
  }

  function persistirPadron(padron) {
    if (padronVivo) {
      padronVivo.guardar(padron);
    } else {
      escribirAtomico(rutaPadron, JSON.stringify(padron, null, 2));
    }
  }

  function registrarEvento(tipo, quien, para) {
    const linea = JSON.stringify({
      tipo,
      timestamp: new Date().toISOString(),
      quien: quien || null,
      para: para || null
    });
    fs.appendFileSync(rutaEventos, linea + '\n', 'utf8');
  }

  // -- Sesiones -------------------------------------------------------------
  function idDeCookie(req) {
    const encabezado = req.headers.cookie || '';
    for (const par of encabezado.split(';')) {
      const [nombre, valor] = par.trim().split('=');
      if (nombre === NOMBRE_COOKIE && valor) {
        return valor;
      }
    }
    return null;
  }

  function conectarSesion(req) {
    const id = idDeCookie(req);
    if (!id) {
      return null;
    }
    const sesion = sesiones.get(id);
    if (!sesion) {
      return null;
    }
    if (Date.now() - sesion.ultimaActividad > TIEMPO_SESION_MS) {
      sesiones.delete(id);
      return null;
    }
    // ORDEN-RONDA-15 §2: revalidar contra el padrón vigente. Si el operador
    // fue dado de baja, bloqueado o su rol cambió, la sesión lo refleja.
    if (padronVivo && padronVivo.existe()) {
      const usuario = padronVivo.buscar(sesion.email);
      if (!usuario || usuario.activo === false) {
        sesiones.delete(id);
        return null;
      }
      if (usuario.credenciales && usuario.credenciales.bloqueado) {
        sesiones.delete(id);
        return null;
      }
      const rolActual = typeof usuario.rol === 'string' && usuario.rol !== ''
        ? usuario.rol
        : (Array.isArray(usuario.roles) && usuario.roles.length > 0 ? usuario.roles[0] : '');
      if (rolActual && rolActual !== sesion.rol) {
        sesion.rol = rolActual;
      }
      sesion.administrador = usuario.administrador === true;
    }
    sesion.ultimaActividad = Date.now();
    return sesion;
  }

  function crearSesion(usuario) {
    const id = crypto.randomBytes(24).toString('base64url');
    const sesion = {
      id,
      email: usuario.email,
      rol: usuario.rol || (Array.isArray(usuario.roles) ? usuario.roles[0] : ''),
      nombre: usuario.nombre + ' ' + usuario.apellido,
      equipo: usuario.sector || null,
      administrador: usuario.administrador === true,
      provisoria: !!(usuario.credenciales && usuario.credenciales.provisoria),
      ultimaActividad: Date.now()
    };
    sesiones.set(id, sesion);
    return sesion;
  }

  function cerrarSesion(req) {
    const id = idDeCookie(req);
    if (id) {
      sesiones.delete(id);
    }
  }

  // Contexto con el que el servidor ejecuta el motor para la sesión.
  function contextoDeSesion(sesion) {
    return {
      timestamp: new Date().toISOString(),
      email: sesion.email,
      rol: sesion.rol,
      nombre: sesion.nombre,
      equipo: sesion.equipo
    };
  }

  // Reemplaza (o agrega) el contexto del cuerpo por el de la sesión.
  function inyectarContextoEn(textoSinCodificar, sesion) {
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(textoSinCodificar);
    } catch (e) {
      cuerpo = null;
    }
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
      return textoSinCodificar;
    }
    cuerpo.contexto = contextoDeSesion(sesion);
    return JSON.stringify(cuerpo);
  }

  // -- Login -----------------------------------------------------------------
  function demorarFallo() {
    const inicio = Date.now();
    while (Date.now() - inicio < DEMORA_FALLO_MS) {
      // espera activa equivalente a la del lock de numeración (ADR-009)
    }
  }

  function cuerpoDe(textoCuerpo) {
    try {
      const cuerpo = JSON.parse(textoCuerpo || '{}');
      return cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
    } catch (e) {
      return {};
    }
  }

  function apiLogin(req, res, textoCuerpo) {
    if (!esModoAutenticado()) {
      return responderJson(res, 403, { error: 'este servidor no pide credenciales (no hay padrón con claves)' });
    }
    const cuerpo = cuerpoDe(textoCuerpo);
    // ORDEN-RONDA-18 §3.5: el correo es identidad y no distingue mayúsculas.
    const email = identidad.normalizarEmail(typeof cuerpo.email === 'string' ? cuerpo.email : '');
    const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : '';
    if (!email || !clave) {
      return responderJson(res, 400, { error: 'email y clave son obligatorios para ingresar' });
    }
    const padron = leerPadron();
    const usuario = padron && Array.isArray(padron.usuarios) ? padron.usuarios.find((u) => u && u.email === email) : null;

    if (!usuario || usuario.activo === false) {
      demorarFallo();
      return responderJson(res, 401, { error: 'usuario o clave incorrecta' });
    }
    if (usuario.credenciales && usuario.credenciales.bloqueado) {
      demorarFallo();
      return responderJson(res, 401, {
        error: 'usuario bloqueado: se superaron los ' + MAX_FALLOS + ' intentos fallidos consecutivos; avise al Jefe de Contrataciones'
      });
    }

    if (!credenciales.verificarClave(clave, usuario.credenciales)) {
      usuario.credenciales = usuario.credenciales || {};
      usuario.credenciales.fallosContinuos = (usuario.credenciales.fallosContinuos || 0) + 1;
      if (usuario.credenciales.fallosContinuos >= MAX_FALLOS) {
        usuario.credenciales.bloqueado = true;
      }
      persistirPadron(padron);
      demorarFallo();
      return responderJson(res, 401, { error: 'usuario o clave incorrecta' });
    }

    usuario.credenciales = usuario.credenciales || {};
    usuario.credenciales.fallosContinuos = 0;
    usuario.credenciales.bloqueado = false;
    persistirPadron(padron);

    const sesion = crearSesion(usuario);
    registrarEvento('ingreso', sesion.email, null);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': NOMBRE_COOKIE + '=' + sesion.id + '; Path=/; HttpOnly; SameSite=Strict'
    });
    res.end(JSON.stringify({
      autenticado: true,
      email: sesion.email,
      rol: sesion.rol,
      nombre: sesion.nombre,
      provisoria: sesion.provisoria
    }));
  }

  function apiSalir(req, res, sesion) {
    const email = sesion ? sesion.email : null;
    cerrarSesion(req);
    if (email) {
      registrarEvento('salida', email, null);
    }
    return responderJson(res, 200, { ok: true });
  }

  function apiActual(req, res, sesion) {
    if (!sesion) {
      return responderJson(res, 401, { error: 'sin sesión' });
    }
    return responderJson(res, 200, {
      autenticado: true,
      email: sesion.email,
      rol: sesion.rol,
      nombre: sesion.nombre,
      equipo: sesion.equipo,
      provisoria: sesion.provisoria,
      administrador: sesion.administrador === true
    });
  }

  // Reglas de la reposición: claveVieja obligatoria, sin reutilizar la actual.
  function claveNuevaValida(claveNueva, claveVieja, provisoria) {
    if (typeof claveNueva !== 'string' || claveNueva.trim() === '') {
      return 'la clave nueva no puede quedar vacía';
    }
    if (claveNueva === claveVieja) {
      return 'la clave nueva no puede ser igual a la actual';
    }
    if (typeof provisoria === 'string' && provisoria !== '' && claveNueva === provisoria) {
      return 'la clave nueva no puede ser igual a la provisoria';
    }
    return null;
  }

  function apiCambioClave(req, res, textoCuerpo, sesion) {
    if (!sesion) {
      return responderJson(res, 401, { error: 'hay que estar en sesión para cambiar la clave' });
    }
    const cuerpo = cuerpoDe(textoCuerpo);
    const claveVieja = typeof cuerpo.claveVieja === 'string' ? cuerpo.claveVieja : '';
    const claveNueva = typeof cuerpo.claveNueva === 'string' ? cuerpo.claveNueva : '';
    if (!claveVieja) {
      return responderJson(res, 400, { error: 'la clave actual es obligatoria para cambiarla' });
    }
    const padron = leerPadron();
    const usuario = padron && Array.isArray(padron.usuarios) ? padron.usuarios.find((u) => u && u.email === sesion.email) : null;
    if (!usuario || usuario.activo === false) {
      return responderJson(res, 401, { error: 'usuario no encontrado en el padrón' });
    }
    if (!credenciales.verificarClave(claveVieja, usuario.credenciales)) {
      return responderJson(res, 401, { error: 'la clave actual no es correcta' });
    }
    const provisoria = usuario.credenciales && usuario.credenciales.provisoria ? claveVieja : '';
    const error = claveNuevaValida(claveNueva, claveVieja, provisoria);
    if (error) {
      return responderJson(res, 400, { error });
    }
    usuario.credenciales = credenciales.crearHash(claveNueva);
    usuario.credenciales.provisoria = false;
    usuario.credenciales.fallosContinuos = 0;
    usuario.credenciales.bloqueado = false;
    persistirPadron(padron);
    sesion.provisoria = false;
    registrarEvento('clave_cambiada', sesion.email, null);
    return responderJson(res, 200, { ok: true });
  }

  // Extrae el contexto de un cuerpo ya leído (para el log de origen).
  function contextoDelCuerpo(texto) {
    try {
      const cuerpo = JSON.parse(texto);
      if (cuerpo && typeof cuerpo === 'object' && cuerpo.contexto) {
        return cuerpo.contexto;
      }
    } catch (e) {
      // el cuerpo inválido lo reporta el manejador
    }
    return null;
  }

  // -- Puerta de acceso y enrutado (para que servidor.js no crezca: 400 líneas max)
  // Decisión de acceso a una ruta de API en modo autenticado. Devuelve
  // {permitido:true, sesion} o {permitido:false, estado, error}.
  function protegerRuta(ruta, metodo, req) {
    if (!esModoAutenticado()) {
      return { permitido: true, sesion: null };
    }
    // Estáticos y /config/* no son API: se sirven sin sesión, igual que hoy.
    if (ruta.indexOf('/api/') !== 0) {
      return { permitido: true, sesion: null };
    }
    if (esPublica(ruta, metodo)) {
      return { permitido: true, sesion: null };
    }
    const conectada = conectarSesion(req);
    if (!conectada) {
      return { permitido: false, estado: 401, error: 'hay que ingresar al SGC para operar la API' };
    }
    if (conectada.provisoria && !esDeTransicionProvisoria(ruta)) {
      return { permitido: false, estado: 403, error: 'tenés que cambiar la clave provisoria antes de operar: use /api/sesion/cambio-clave' };
    }
    return { permitido: true, sesion: conectada };
  }

  // URLs /api/sesion/*: el login es público; el resto atiende con la cookie.
  function enrutarSesion(req, res, ruta, sesionDePeticion, conCuerpo, originResuelto, peticion) {
    if (ruta === '/api/sesion/login' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => apiLogin(r, s, texto));
    }
    if (ruta === '/api/sesion/actual' && req.method === 'GET') {
      ayudantes.registrarOrigen(datosDir, originResuelto, peticion, null, null);
      return apiActual(req, res, sesionDePeticion);
    }
    if (ruta === '/api/sesion/salir' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => apiSalir(r, s, sesionDePeticion));
    }
    if (ruta === '/api/sesion/cambio-clave' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => apiCambioClave(r, s, texto, sesionDePeticion));
    }
    return null;
  }

  return {
    esModoAutenticado,
    esPublica,
    esDeTransicionProvisoria,
    crearSesion,
    conectarSesion,
    inyectarContextoEn,
    protegerRuta,
    enrutarSesion,
    contextoDelCuerpo
  };
}

module.exports = {
  crearCapaSesion,
  NOMBRE_COOKIE,
  TIEMPO_SESION_MS,
  MAX_FALLOS,
  RUTA_PADRON,
  RUTA_EVENTOS
};
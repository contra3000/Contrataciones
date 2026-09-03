'use strict';

/*
 * padron-inicial.js
 * ORDEN-RONDA-17 §1.1/§1.2 (H21) y ORDEN-RONDA-18 §1.1 (ADR-037 §8, ADR-038).
 * Bootstrap del padrón en el primer arranque.
 *
 * Si no hay padrón, el servidor lo crea con un solo usuario: el administrador
 * (marca `administrador: true`, no un octavo rol — ADR-037). La clave se genera
 * con el formato de ADR-034 §2 —cuatro palabras en castellano—, nace provisoria
 * y se muestra una vez en la salida del servidor. Ninguna clave por omisión.
 *
 * ADR-038 (ORDEN-RONDA-18 §1.1): la identidad del administrador NO se completa
 * por omisión. Sin el bloque `administrador` completo y válido en la
 * configuración, el servidor no arranca y dice qué falta y dónde ponerlo. Esto
 * sólo aplica cuando hay que crear el padrón: con padrón ya existente, la
 * configuración del administrador es irrelevante (ahí manda el padrón).
 *
 * El modo declarado no bootstrapa nada: si se pidió --declarado, el padrón de
 * ejemplo de configuración sigue mandando (desarrollo/tests).
 */

const fs = require('node:fs');
const path = require('node:path');

const credenciales = require('./credenciales.js');
const { diccionarioDePalabras } = require('./palabras.js');
const { normalizarEmail, validarEmail } = require('./identidad.js');

// Valida el bloque `administrador` de la configuración y devuelve los datos
// limpios para sembrar. Lanza con un mensaje que dice qué falta y dónde
// ponerlo (ADR-038): quien lo lee está instalando por primera vez.
function validarAdministrador(configuracion, rutaConfig) {
  const SGC = globalThis.SGC;
  const ROLES = (SGC && SGC.core && SGC.core.config && SGC.core.config.ROLES)
    ? SGC.core.config.ROLES.map((r) => r.id)
    : [];
  const admin = (configuracion && configuracion.administrador) || null;
  if (!admin || typeof admin !== 'object') {
    throw new Error(
      'la configuración no trae el bloque "administrador"; agregue ' +
      '"{ administrador: { nombre, apellido, email, rol } }" en "' + rutaConfig + '"');
  }
  for (const campo of ['nombre', 'apellido', 'email', 'rol']) {
    if (typeof admin[campo] !== 'string' || admin[campo].trim() === '') {
      throw new Error(
        'el bloque "administrador" de "' + rutaConfig + '" no trae el campo "' +
        campo + '"; completelo antes del primer arranque');
    }
  }
  const email = normalizarEmail(admin.email);
  if (!validarEmail(email)) {
    throw new Error(
      'el correo del administrador "' + admin.email + '" no es válido; revise ' +
      '"administrador.email" en "' + rutaConfig + '"');
  }
  if (ROLES.indexOf(admin.rol) === -1) {
    throw new Error(
      'el rol del administrador "' + admin.rol + '" no existe; use uno de: ' +
      ROLES.join(', ') + ' (los roles válidos salen de config.js)');
  }
  return {
    nombre: admin.nombre.trim(),
    apellido: admin.apellido.trim(),
    email,
    rol: admin.rol.trim()
  };
}

// Devuelve el padrón ya armado con el administrador. No escribe: lo hace
// guardar. `admin` ya viene validado por validarAdministrador.
function armarPadronConAdministrador(admin) {
  const clave = credenciales.generarClave(diccionarioDePalabras());
  return {
    clave,
    padron: {
      schemaVersion: '2.0.0',
      usuarios: [{
        nombre: admin.nombre,
        apellido: admin.apellido,
        email: admin.email,
        rol: admin.rol,
        sector: null,
        activo: true,
        administrador: true,
        credenciales: Object.assign(credenciales.crearHash(clave), {
          provisoria: true,
          fallosContinuos: 0,
          bloqueado: false
        })
      }]
    }
  };
}

// Siembra el padrón inicial si no existe. Devuelve { clave, email } del
// administrador para mostrarla una vez, o null si ya había padrón o era
// modo declarado. Invalid-con-ruta arroja (ADR-038).
function sembrarAdministrador(datosDir, configuracion, modoDeclarado, rutaConfig) {
  const ruta = path.join(datosDir, 'padron.json');
  if (modoDeclarado || fs.existsSync(ruta)) {
    return null;
  }
  const admin = validarAdministrador(configuracion, rutaConfig);
  const armado = armarPadronConAdministrador(admin);
  const dir = path.dirname(ruta);
  const tmp = path.join(dir, '.padron-bootstrap-' + process.pid + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(armado.padron, null, 2), 'utf8');
  fs.renameSync(tmp, ruta);
  return { clave: armado.clave, email: armado.padron.usuarios[0].email };
}

module.exports = { sembrarAdministrador, armarPadronConAdministrador, validarAdministrador };
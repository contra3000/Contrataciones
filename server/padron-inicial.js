'use strict';

/*
 * padron-inicial.js
 * ORDEN-RONDA-17 §1.1/§1.2 (H21). Bootstrap del padrón en el primer arranque.
 *
 * Si no hay padrón, el servidor lo crea con un solo usuario: el administrador
 * (marca `administrador: true`, no un octavo rol — ADR-037). La clave se genera
 * con el formato de ADR-034 §2 —cuatro palabras en castellano—, nace provisoria
 * y se muestra una vez en la salida del servidor. Ninguna clave por omisión.
 *
 * El modo declarado no bootstrapa nada: si se pidió --declarado, el padrón de
 * ejemplo de configuración sigue mandando (desarrollo/tests).
 */

const fs = require('node:fs');
const path = require('node:path');

const credenciales = require('./credenciales.js');
const { diccionarioDePalabras } = require('./palabras.js');

// Devuelve el padrón ya armado con el administrador, o null si el padrón ya
// existía (o no hay datos para el administrador). No escribe: lo hace guardar.
function armarPadronConAdministrador(configuracion) {
  const admin = (configuracion && configuracion.administrador) || {};
  const texto = (v, d) => typeof v === 'string' && v.trim() !== '' ? v.trim() : d;
  const nombre = texto(admin.nombre, 'Administrador');
  const apellido = texto(admin.apellido, 'del Sistema');
  const email = texto(admin.email, 'administrador@sgc.local');
  const clave = credenciales.generarClave(diccionarioDePalabras());
  const rol = texto(admin.rol, 'contrataciones_supervisor');
  const sector = typeof admin.sector === 'string' && admin.sector.trim() !== ''
    ? admin.sector.trim()
    : null;
  return {
    clave,
    padron: {
      schemaVersion: '2.0.0',
      usuarios: [{
        nombre,
        apellido,
        email,
        rol,
        sector,
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

// Siembra el padrón inicial si no existe. Devuelve { clave } del administrador
// para mostrarla una vez, o null si no hubo bootstrap (ya había padrón, era
// declarado, o falta la configuración del administrador).
function sembrarAdministrador(datosDir, configuracion, modoDeclarado) {
  const ruta = path.join(datosDir, 'padron.json');
  if (modoDeclarado || fs.existsSync(ruta)) {
    return null;
  }
  const armado = armarPadronConAdministrador(configuracion);
  if (!armado) {
    return null;
  }
  const dir = path.dirname(ruta);
  const tmp = path.join(dir, '.padron-bootstrap-' + process.pid + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(armado.padron, null, 2), 'utf8');
  fs.renameSync(tmp, ruta);
  return { clave: armado.clave, email: armado.padron.usuarios[0].email };
}

module.exports = { sembrarAdministrador, armarPadronConAdministrador };
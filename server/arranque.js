'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const RAIZ = path.resolve(__dirname, '..');
const DIR_APP = path.join(RAIZ, 'app');

function leerArgumentos(argv) {
  const opciones = { datos: null, puerto: 8123, config: null, declarado: false, administrador: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) {
      opciones.datos = argv[i + 1];
      i++;
    } else if (argv[i] === '--puerto' && i + 1 < argv.length) {
      opciones.puerto = parseInt(argv[i + 1], 10);
      i++;
    } else if (argv[i] === '--config' && i + 1 < argv.length) {
      opciones.config = argv[i + 1];
      i++;
    } else if (argv[i] === '--declarado') {
      opciones.declarado = true;
    }
  }
  return opciones;
}

function cargarConfig(opciones) {
  if (!opciones.config) {
    return;
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(opciones.config, 'utf8'));
    if (!opciones.datos && typeof cfg.datos === 'string') {
      opciones.datos = cfg.datos;
    }
    if (opciones.puerto === 8123 && typeof cfg.puerto === 'number') {
      opciones.puerto = cfg.puerto;
    }
    if (cfg.declarado === true) {
      opciones.declarado = true;
    }
    opciones.administrador = (typeof cfg.administrador === 'object' && cfg.administrador !== null)
      ? cfg.administrador
      : null;
  } catch (e) {
    throw new Error('el archivo de configuración "' + opciones.config + '" no se pudo leer: revise que exista y sea JSON válido');
  }
}

function verificarArranque(opciones, nodeMinVersion, ayudantes) {
  if (!opciones.datos) {
    throw new Error('falta el argumento obligatorio --datos <ruta> o el campo "datos" en el archivo de configuración');
  }
  if (!fs.existsSync(opciones.datos)) {
    throw new Error('la carpeta de datos no existe: "' + opciones.datos + '". Creela o pase otra ruta con --datos');
  }
  if (!fs.statSync(opciones.datos).isDirectory()) {
    throw new Error('--datos debe apuntar a una carpeta, y "' + opciones.datos + '" es un archivo');
  }
  var sonda = path.join(opciones.datos, '.arranque-' + process.pid + '.tmp');
  try {
    ayudantes.escribirAtomico(sonda, 'ok');
    fs.unlinkSync(sonda);
  } catch (e) {
    throw new Error('la carpeta de datos no es escribible: "' + opciones.datos + '". Verifique los permisos de la carpeta y su cuenta');
  }
  var partes = process.version.replace(/^v/, '').split('.').map(Number);
  var major = partes[0];
  if (!Number.isFinite(major) || major < nodeMinVersion) {
    throw new Error('se necesita Node ' + nodeMinVersion + ' o superior (versión actual: ' + process.version + ')');
  }
  // ORDEN-RONDA-17: el puerto se valida SIEMPRE, también cuando no hay padrón
  // (el bootstrap hace válido arrancar sin padrón). Antes este chequeo quedaba
  // detrás del retorno temprano del padrón, y "--puerto abc" escapaba como un
  // RangeError de node en lugar de un mensaje claro en español.
  if (!Number.isInteger(opciones.puerto) || opciones.puerto < 0 || opciones.puerto > 65535) {
    throw new Error('--puerto debe ser un número entre 0 y 65535 (recibido: ' + opciones.puerto + ')');
  }
  var rutaPadron = path.join(opciones.datos, 'padron.json');
  // ORDEN-RONDA-17 §1.1: sin padrón, el primer arranque del servidor lo crea
  // con el administrador (padron-inicial.js). Ya no es un error: sólo exige
  // credenciales si el padrón ya existe. El modo declarado sigue sirviendo el
  // padrón de ejemplo de configuración (desarrollo y tests).
  if (!fs.existsSync(rutaPadron)) {
    return;
  }
  var padron = null;
  try {
    padron = JSON.parse(fs.readFileSync(rutaPadron, 'utf8'));
  } catch (e) {
    throw new Error('el padrón no es JSON válido: revise el contenido de "' + rutaPadron + '"');
  }
  var usuarios = Array.isArray(padron.usuarios) ? padron.usuarios : [];
  var conCredencial = usuarios.some(function (u) { return u && u.credenciales && typeof u.credenciales.hash === 'string'; });
  if (!conCredencial) {
    throw new Error('el padrón en "' + rutaPadron + '" no tiene ningún operador con credencial: cargue al menos uno con tools/padron.js antes de arrancar');
  }
  var rutaManifiesto = path.join(DIR_APP, 'catalogo', 'manifiesto.json');
  if (!fs.existsSync(rutaManifiesto)) {
    throw new Error('falta el catálogo: "' + rutaManifiesto + '". Verifique que app/catalogo/ esté completo');
  }
  try {
    JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
  } catch (e) {
    throw new Error('el manifiesto del catálogo no es JSON válido: "' + rutaManifiesto + '"');
  }
}

function verificarPuerto(puerto) {
  if (puerto === 0) {
    return Promise.resolve();
  }
  return new Promise(function (resolve, reject) {
    var probe = net.createServer();
    probe.once('error', function (e) {
      if (e.code === 'EADDRINUSE') {
        reject(new Error('el puerto ' + puerto + ' ya está en uso. Cambie el puerto con --puerto o en el archivo de configuración'));
      } else {
        reject(e);
      }
    });
    probe.once('listening', function () {
      probe.close(function () { resolve(); });
    });
    probe.listen(puerto);
  });
}

module.exports = { leerArgumentos, cargarConfig, verificarArranque, verificarPuerto };

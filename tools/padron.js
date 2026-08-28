#!/usr/bin/env node
/*
 * padron.js
 * ORDEN-RONDA-14 §3.9 (ADR-027, ADR-033). Administración del padrón real de
 * usuarios con credenciales:
 *
 *   node tools/padron.js alta         --datos <dir> --archivo <ruta> [--quien <email> --clave <secret>]
 *   node tools/padron.js reponer      --datos <dir> --quien <email> --clave <secret> --para <email>
 *   node tools/padron.js baja         --datos <dir> --quien <email> --clave <secret> --para <email>
 *   node tools/padron.js desbloquear  --datos <dir> --quien <email> --clave <secret> --para <email>
 *   node tools/padron.js listar       --datos <dir>
 *
 * - El padrón vive en <datos>/padron.json y el servidor NUNCA lo sirve por
 *   HTTP. La clave provisoria sale de config/palabras.json (cuatro palabras en
 *   castellano sin tildes, ~44 bits) y se imprime UNA sola vez; en disco sólo
 *   queda su hash scrypt (ADR-034).
 * - Sin padrón, el primer `alta` es bootstrap y no exige --quien (todavía no
 *   hay nadie). Con padrón, toda operación exige --quien + --clave del Jefe de
 *   Contrataciones; la herramienta ignora la regla de bloqueo (así el Jefe
 *   puede desbloquear) y cada operación deja rastro en padron.eventos.jsonl.
 * - La baja nunca borra: activo:false y el nombre sigue en el padrón.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ayudantes = require('../server/ayudantes.js');
const credenciales = require('../server/credenciales.js');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));

const SGC = globalThis.SGC;
const ROLES = SGC.core.config.ROLES.map((r) => r.id);
const ROL_JEFE = 'contrataciones_supervisor';
const RUTA_PADRON = 'padron.json';
const RUTA_EVENTOS = 'padron.eventos.jsonl';
const SUFIJOS_INVALIDOS = [';', '\r', '\n'];

function rutaPadron(datos) {
  return path.join(datos, RUTA_PADRON);
}

function rutaEventos(datos) {
  return path.join(datos, RUTA_EVENTOS);
}

function leerPadron(datos) {
  const ruta = rutaPadron(datos);
  if (!fs.existsSync(ruta)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function guardarPadron(datos, padron) {
  fs.mkdirSync(datos, { recursive: true });
  ayudantes.escribirAtomico(rutaPadron(datos), JSON.stringify(padron, null, 2));
}

function registrarEvento(datos, tipo, quien, para) {
  const linea = JSON.stringify({
    tipo,
    timestamp: new Date().toISOString(),
    quien: quien || null,
    para: para || null
  });
  fs.appendFileSync(rutaEventos(datos), linea + '\n', 'utf8');
}

// Usuario del padrón por correo; nada de borrar, activo:false es la baja.
function buscar(padron, email) {
  if (!padron || !Array.isArray(padron.usuarios)) {
    return null;
  }
  for (let i = 0; i < padron.usuarios.length; i++) {
    if (padron.usuarios[i].email === email) {
      return padron.usuarios[i];
    }
  }
  return null;
}

// --quien + --clave contra el padrón: Jefe activo con su clave correcta.
// La herramienta IGNORA la regla de bloqueo (así el Jefe puede desbloquearse a
// sí mismo y a los demás); está documentado en la cabecera y en el informe.
function verificarJefe(datos, quien, clave) {
  const padron = leerPadron(datos);
  const usuario = buscar(padron, quien);
  if (!usuario || usuario.activo === false || usuario.rol !== ROL_JEFE) {
    return { ok: false, error: '--quien debe ser el Jefe de Contrataciones (contrataciones_supervisor) activo del padrón' };
  }
  if (!credenciales.verificarClave(clave, usuario.credenciales)) {
    return { ok: false, error: 'la clave de --quien no es correcta' };
  }
  return { ok: true, padron };
}

function validarRol(rol) {
  return ROLES.indexOf(rol) !== -1;
}

// Alta batch: archivo con una línea por operador `nombre;apellido;email;rol;[sector];[activo]`. Todo o nada: si una sola línea está mal, no se escribe nada.
function leerLineasAlta(rutaArchivo) {
  if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
    return { ok: false, error: 'falta el archivo de altas: --archivo <ruta> debe existir' };
  }
  const lineas = fs.readFileSync(rutaArchivo, 'utf8').split(/\r?\n/);
  const entradas = [];
  const errores = [];
  for (let n = 0; n < lineas.length; n++) {
    const linea = lineas[n];
    if (linea.trim() === '') {
      continue;
    }
    const partes = linea.split(';').map((p) => p.trim());
    const [nombre, apellido, email, rol, sector, activo] = partes;
    if (partes.length < 4 || !nombre || !apellido || !email || !rol) {
      errores.push('línea ' + (n + 1) + ': se espera nombre;apellido;email;rol;[sector];[activo]');
      continue;
    }
    if (SUFIJOS_INVALIDOS.some((c) => email.indexOf(c) !== -1) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errores.push('línea ' + (n + 1) + ': el email "' + email + '" no es válido');
      continue;
    }
    if (!validarRol(rol)) {
      errores.push('línea ' + (n + 1) + ': el rol "' + rol + '" no existe (roles: ' + ROLES.join(', ') + ')');
      continue;
    }
    entradas.push({
      nombre,
      apellido,
      email,
      rol,
      sector: sector || null,
      activo: activo === undefined || activo === '' ? true : activo.toLowerCase() === 'true'
    });
  }
  if (errores.length > 0) {
    return { ok: false, error: errores.join(' · ') };
  }
  const emails = {};
  for (const e of entradas) {
    if (emails[e.email]) {
      return { ok: false, error: 'email repetido en el archivo: ' + e.email };
    }
    emails[e.email] = true;
  }
  return { ok: true, entradas };
}

function diccionarioDePalabras() {
  const ruta = path.join(__dirname, '..', 'config', 'palabras.json');
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

// Alta: crea los que no existen y deja intactos a los que ya estaban. Cada
// recién creado devuelve su clave provisoria: se imprime una vez y no se
// guarda en ningún archivo.
function alta(opciones) {
  const { datos, archivo } = opciones;
  const leidas = leerLineasAlta(archivo);
  if (!leidas.ok) {
    return leidas;
  }
  const padron = leerPadron(datos);
  const bootstrap = !padron;
  if (!bootstrap) {
    const check = verificarJefe(datos, opciones.quien, opciones.clave);
    if (!check.ok) {
      return check;
    }
  }
  const diccionario = diccionarioDePalabras();
  const creados = [];
  const yaExistentes = [];
  const actual = padron || { schemaVersion: '2.0.0', usuarios: [] };
  for (const entrada of leidas.entradas) {
    const existente = buscar({ usuarios: actual.usuarios }, entrada.email);
    if (existente) {
      yaExistentes.push(entrada.email);
      continue;
    }
    const clave = credenciales.generarClave(diccionario);
    actual.usuarios.push({
      nombre: entrada.nombre,
      apellido: entrada.apellido,
      email: entrada.email,
      rol: entrada.rol,
      sector: entrada.sector,
      activo: entrada.activo,
      credenciales: Object.assign(credenciales.crearHash(clave), {
        provisoria: true,
        fallosContinuos: 0,
        bloqueado: false
      })
    });
    creados.push({ email: entrada.email, clave });
  }
  guardarPadron(datos, actual);
  for (const c of creados) {
    registrarEvento(datos, 'alta', bootstrap ? null : opciones.quien, c.email);
  }
  return {
    ok: true,
    bootstrap,
    creados,
    yaExistentes
  };
}

// Reposición: nueva clave provisoria; deja rastro de quién/para/cuándo. El
// hash anterior deja de servir y el operador vuelve a estar en provisoria.
function reponer(opciones) {
  const check = verificarJefe(opciones.datos, opciones.quien, opciones.clave);
  if (!check.ok) {
    return check;
  }
  const usuario = buscar(check.padron, opciones.para);
  if (!usuario) {
    return { ok: false, error: 'el correo --para "' + opciones.para + '" no está en el padrón' };
  }
  const clave = credenciales.generarClave(diccionarioDePalabras());
  usuario.credenciales = Object.assign(credenciales.crearHash(clave), {
    provisoria: true,
    fallosContinuos: 0,
    bloqueado: false
  });
  guardarPadron(opciones.datos, check.padron);
  registrarEvento(opciones.datos, 'clave_reponer', opciones.quien, opciones.para);
  return { ok: true, clave, email: opciones.para };
}

// Baja: activo:false, sin borrar. El nombre queda en el padrón y en la traza.
function baja(opciones) {
  const check = verificarJefe(opciones.datos, opciones.quien, opciones.clave);
  if (!check.ok) {
    return check;
  }
  const usuario = buscar(check.padron, opciones.para);
  if (!usuario) {
    return { ok: false, error: 'el correo --para "' + opciones.para + '" no está en el padrón' };
  }
  usuario.activo = false;
  guardarPadron(opciones.datos, check.padron);
  registrarEvento(opciones.datos, 'baja', opciones.quien, opciones.para);
  return { ok: true, email: opciones.para };
}

// Desbloqueo: limpia el flag del padrón; únicamente la herramienta lo hace.
function desbloquear(opciones) {
  const check = verificarJefe(opciones.datos, opciones.quien, opciones.clave);
  if (!check.ok) {
    return check;
  }
  const usuario = buscar(check.padron, opciones.para);
  if (!usuario) {
    return { ok: false, error: 'el correo --para "' + opciones.para + '" no está en el padrón' };
  }
  usuario.credenciales = Object.assign({}, usuario.credenciales, {
    bloqueado: false,
    fallosContinuos: 0
  });
  guardarPadron(opciones.datos, check.padron);
  registrarEvento(opciones.datos, 'desbloqueo', opciones.quien, opciones.para);
  return { ok: true, email: opciones.para };
}

// Listar: sin hashes ni claves.
function listar(opciones) {
  const padron = leerPadron(opciones.datos);
  if (!padron) {
    return { ok: true, usuarios: [] };
  }
  const usuarios = (Array.isArray(padron.usuarios) ? padron.usuarios : []).map(function (u) {
    return {
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      sector: u.sector || null,
      activo: u.activo !== false,
      provisoria: !!(u.credenciales && u.credenciales.provisoria),
      bloqueado: !!(u.credenciales && u.credenciales.bloqueado)
    };
  });
  return { ok: true, usuarios };
}

// CLI
// ---------------------------------------------------------------------------
function usarArgumentos(argv) {
  const opciones = {
    comando: null, datos: null, archivo: null,
    quien: null, clave: null, para: null
  };
  if (argv.length > 0) {
    opciones.comando = argv[0];
  }
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) { opciones.datos = argv[++i]; }
    else if (argv[i] === '--archivo' && i + 1 < argv.length) { opciones.archivo = argv[++i]; }
    else if (argv[i] === '--quien' && i + 1 < argv.length) { opciones.quien = argv[++i]; }
    else if (argv[i] === '--clave' && i + 1 < argv.length) { opciones.clave = argv[++i]; }
    else if (argv[i] === '--para' && i + 1 < argv.length) { opciones.para = argv[++i]; }
  }
  return opciones;
}

function verificarComun(opciones) {
  const comandos = ['alta', 'reponer', 'clave', 'baja', 'desbloquear', 'listar'];
  if (comandos.indexOf(opciones.comando) === -1) {
    return 'subcomando inválido: use ' + comandos.join(', ') + '. --datos es obligatorio en todos';
  }
  if (!opciones.datos) {
    return 'falta el argumento obligatorio --datos <ruta>: la carpeta donde vive padron.json';
  }
  return null;
}

function delegar(opciones) {
  if (opciones.comando === 'alta') {
    return alta(opciones);
  }
  if (opciones.comando === 'reponer' || opciones.comando === 'clave') {
    if (!opciones.para) {
      return { ok: false, error: 'falta --para <email>: a quién se repone la clave' };
    }
    return reponer(opciones);
  }
  if (opciones.comando === 'baja') {
    if (!opciones.para) {
      return { ok: false, error: 'falta --para <email>: a quién se da de baja' };
    }
    return baja(opciones);
  }
  if (opciones.comando === 'desbloquear') {
    if (!opciones.para) {
      return { ok: false, error: 'falta --para <email>: a quién se desbloquea' };
    }
    return desbloquear(opciones);
  }
  return listar(opciones);
}

function main() {
  const opciones = usarArgumentos(process.argv.slice(2));
  const errorComun = verificarComun(opciones);
  if (errorComun) {
    console.error('padron: ' + errorComun);
    process.exit(1);
  }
  const resultado = delegar(opciones);
  if (!resultado.ok) {
    console.error('padron: ' + resultado.error);
    process.exit(1);
  }
  if (resultado.creados) {
    for (const c of resultado.creados) {
      // La clave en claro sólo existe en la consola de quien la administra.
      console.log('CLAVE ' + c.email + ' = ' + c.clave);
    }
    console.log('Alta: ' + resultado.creados.length + ' creado(s), ' +
      (resultado.yaExistentes ? resultado.yaExistentes.length : 0) + ' ya existente(s).');
    if (resultado.yaExistentes && resultado.yaExistentes.length > 0) {
      console.log('Ya estaban: ' + resultado.yaExistentes.join(', '));
    }
    if (resultado.bootstrap) {
      console.log('Padrón creado (bootstrap). Guardá las claves: no se vuelven a mostrar.');
    }
  } else if (resultado.clave) {
    console.log('CLAVE ' + resultado.email + ' = ' + resultado.clave);
    console.log('Clave repuesta para ' + resultado.email + ' (provisoria).');
  } else if (resultado.email) {
    console.log('OK: ' + resultado.email);
  } else if (resultado.usuarios) {
    for (const u of resultado.usuarios) {
      console.log([u.email, u.rol, u.activo ? 'activo' : 'baja',
        u.provisoria ? 'provisoria' : 'fija',
        u.bloqueado ? 'bloqueado' : ''].filter(Boolean).join('\t'));
    }
    console.log('Total: ' + resultado.usuarios.length);
  } else {
    console.log('OK');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  alta,
  reponer,
  baja,
  desbloquear,
  listar,
  verificarJefe
};
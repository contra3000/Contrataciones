'use strict';

/*
 * servidor-util.js
 * Utilidades para levantar y apretar el servidor real en los tests de ronda 3.
 *
 * - arrancarServidor: hace spawn de `node server/servidor.js --datos <dir>`,
 *   espera la línea "SGC-SERVIDOR-PUERTO <n>" y devuelve el puerto real.
 * - pedir / pedirCrudo: cliente HTTP mínimo con node:http. pedirCrudo envía el
 *   path tal cual (sin normalizar) para poder probar el recorrido de rutas.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const NODE = process.execPath;
const SERVIDOR = path.join(__dirname, '..', '..', 'server', 'servidor.js');
const ESPERA_ARRANQUE = 15000;

function crearDirDatos(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function esperarLinea(proc, prefijo, timeoutMs) {
  return new Promise((resolve, reject) => {
    let acumulado = '';
    const temporizador = setTimeout(() => {
      proc.stdout.removeListener('data', onData);
      reject(new Error('el servidor no imprimió "' + prefijo + '" a tiempo. Salida: ' + acumulado));
    }, timeoutMs);
    function onData(trozo) {
      acumulado += String(trozo);
      const indice = acumulado.indexOf(prefijo);
      if (indice !== -1) {
        clearTimeout(temporizador);
        proc.stdout.removeListener('data', onData);
        const resto = acumulado.slice(indice + prefijo.length);
        resolve(resto.split(/\r?\n/)[0]);
      }
    }
    proc.stdout.on('data', onData);
  });
}

// Espera hasta que aparezcan TODOS los prefijos en la salida, con UN solo
// listener armado desde el arranque (así no se pierden las líneas emitidas en
// el MISMO trozo, p.ej. la caja del administrador justo después de LISTO).
// Devuelve la salida acumulada. Rechaza si pasa el plazo.
function esperarMarcas(proc, prefijos, timeoutMs) {
  return new Promise((resolve, reject) => {
    let acumulado = '';
    const temporizador = setTimeout(() => {
      proc.stdout.removeListener('data', onData);
      reject(new Error('el servidor no imprimió ' + JSON.stringify(prefijos) + ' a tiempo. Salida: ' + acumulado));
    }, timeoutMs);
    function onData(trozo) {
      acumulado += String(trozo);
      const faltan = prefijos.filter((p) => acumulado.indexOf(p) === -1);
      if (faltan.length === 0) {
        clearTimeout(temporizador);
        proc.stdout.removeListener('data', onData);
        resolve(acumulado);
      }
    }
    proc.stdout.on('data', onData);
  });
}

async function arrancarServidor(datosDir, puerto, opciones) {
  const opts = opciones || {};
  const args = [SERVIDOR, '--datos', datosDir, '--puerto', String(puerto === undefined ? 0 : puerto)];
  // ADR-036 (§2.1): sin padrón real, el modo declarado sólo se activa
  // pidiéndolo. Por defecto los tests que no crean un padrón real lo piden
  // explícitamente ('auto'); ronda-17 pasa { declarado: false | true } para
  // probar el bootstrap del administrador (H21) y que el modo no se elige solo.
  const modo = opts.declarado === undefined ? 'auto' : opts.declarado === true;
  if (modo === true || (modo === 'auto' && !fs.existsSync(path.join(datosDir, 'padron.json')))) {
    args.push('--declarado');
  }
  // ORDEN-RONDA-18 §1.1: el bootstrap exige el bloque `administrador` completo
  // y válido (ADR-038). Para simular una instalación real, se escribe un
  // archivo de configuración y se pasa --config.
  if (opts.administrador) {
    const rutaCfg = path.join(datosDir, 'servidor-test.json');
    fs.writeFileSync(rutaCfg, JSON.stringify({
      datos: datosDir,
      puerto: puerto === undefined ? 0 : puerto,
      administrador: opts.administrador
    }, null, 2), 'utf8');
    args.push('--config', rutaCfg);
  }
  // RONDA-18 §4.3: start with a caller-provided config path (p.ej. una
  // configuración SIN bloque administrador) manteniendo el resto del arranque.
  if (!opts.administrador && opts.rutaConfig) {
    args.push('--config', opts.rutaConfig);
  }
  const proc = spawn(NODE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  proc.stdout.on('data', (d) => {
    salida += String(d);
  });
  // Lo que el servidor escribe en stderr se guarda en la salida acumulada: si
  // el hijo revienta al atender una petición, el error tiene que quedar escrito
  // para que el fallo se pueda entender.
  proc.stderr.on('data', (d) => {
    salida += String(d);
  });
  // En cualquier fallo se mata el hijo para no dejar huérfanos (ronda-18).
  try {
    // Marcas a esperar con UN solo listener, armado antes de cualquier salida:
    // el bootstrap (ORDEN-RONDA-18 §1.3) imprime la caja del administrador
    // DESPUÉS de LISTO, a veces en el mismo trozo. La clave provisoria queda
    // garantizada en `salida` cuando el arranque la va a sembrar.
    const marcas = ['SGC-SERVIDOR-LISTO'];
    const vaASembrar = !!opts.administrador && !fs.existsSync(path.join(datosDir, 'padron.json'));
    if (vaASembrar) {
      marcas.push('SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA');
    }
    await esperarMarcas(proc, marcas, ESPERA_ARRANQUE);
  } catch (e) {
    try { proc.kill('SIGKILL'); } catch (ign) { /* ya terminó */ }
    throw e;
  }
  const coincidencia = salida.match(/SGC-SERVIDOR-PUERTO\s+([0-9]+)/);
  const puertoReal = coincidencia ? parseInt(coincidencia[1], 10) : NaN;
  if (Number.isNaN(puertoReal)) {
    try { proc.kill('SIGKILL'); } catch (ign) { /* ya terminó */ }
    throw new Error('el servidor no imprimió un puerto válido: "' + salida + '"');
  }
  return { proc, puerto: puertoReal, salida, datosDir };
}

// ORDEN-RONDA-26 pieza 6: un cierre normal deja la carpeta de datos sin
// candado. En un sistema operativo donde el proceso puede reaccionar a SIGTERM
// (los despliegues reales) lo borra el propio servidor; en Windows la señal
// termina el proceso sin correr código, así que quien detiene el servidor
// borra el candado si el proceso que terminó era su dueño.
function limpiarCandado(ctx) {
  if (!ctx || !ctx.datosDir || !ctx.proc || !ctx.proc.pid) {
    return;
  }
  try {
    const ruta = path.join(ctx.datosDir, 'candado.json');
    const candado = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (candado && candado.pid === ctx.proc.pid) {
      fs.unlinkSync(ruta);
    }
  } catch (e) {
    // Sin candado o de otro proceso: no se toca nada.
  }
}

function detenerServidor(ctx) {
  return new Promise((resolve) => {
    function cerrar() {
      limpiarCandado(ctx);
      resolve();
    }
    if (!ctx.proc) {
      return resolve();
    }
    if (ctx.proc.exitCode !== null || ctx.proc.signalCode !== null) {
      return cerrar();
    }
    const terminador = setTimeout(() => {
      try {
        ctx.proc.kill('SIGKILL');
      } catch (e) {
        // ya terminó
      }
      cerrar();
    }, 2000);
    ctx.proc.on('exit', () => {
      clearTimeout(terminador);
      cerrar();
    });
    try {
      ctx.proc.kill();
    } catch (e) {
      clearTimeout(terminador);
      cerrar();
    }
  });
}

function pedirConPath(baseUrl, metodo, rutaCruda, cuerpo, encabezados) {
  return new Promise((resolve, reject) => {
    const base = new URL(baseUrl);
    const opciones = {
      hostname: base.hostname,
      port: base.port,
      path: rutaCruda,
      method: metodo,
      headers: Object.assign({}, encabezados || {})
    };
    if (cuerpo !== undefined) {
      // Los métodos sin cuerpo (GET, DELETE...) no reciben framing automático
      // del cliente node:http; el Content-Length explícito evita el 400 vacío
      // del lado del servidor.
      opciones.headers['Content-Type'] = 'application/json';
      opciones.headers['Content-Length'] = String(Buffer.byteLength(JSON.stringify(cuerpo)));
    }
    const req = http.request(opciones, (res) => {
      let datos = '';
      res.on('data', (trozo) => {
        datos += trozo;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(datos);
        } catch (e) {
          // no era JSON
        }
        resolve({ status: res.statusCode, body: json, raw: datos, encabezados: res.headers });
      });
    });
    req.on('error', reject);
    if (cuerpo !== undefined) {
      req.write(JSON.stringify(cuerpo));
    }
    req.end();
  });
}

function pedir(baseUrl, metodo, ruta, cuerpo, encabezados) {
  return pedirConPath(baseUrl, metodo, ruta, cuerpo, encabezados);
}

// Envía un cuerpo binario crudo con las cabeceras dadas (ORDEN-RONDA-23 §3): a
// diferencia de pedir(), no serializa JSON ni fuerza Content-Type.
function enviarBytes(baseUrl, ruta, bytes, encabezados) {
  return new Promise((resolve, reject) => {
    const base = new URL(baseUrl);
    const cuerpo = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const opciones = {
      hostname: base.hostname,
      port: base.port,
      path: ruta,
      method: 'POST',
      headers: Object.assign({ 'Content-Length': String(cuerpo.length) }, encabezados || {})
    };
    const req = http.request(opciones, (res) => {
      let datos = '';
      res.on('data', (trozo) => {
        datos += trozo;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(datos);
        } catch (e) {
          // no era JSON
        }
        resolve({ status: res.statusCode, body: json, raw: datos, encabezados: res.headers });
      });
    });
    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

function ejecutarYEsperar(args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(NODE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d) => {
      stdout += d;
    });
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    const temporizador = setTimeout(() => {
      proc.kill('SIGKILL');
    }, timeoutMs || 10000);
    proc.on('close', (codigo, senal) => {
      clearTimeout(temporizador);
      resolve({ exitCode: codigo, senal, stdout, stderr });
    });
  });
}

module.exports = {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  pedir,
  pedirConPath,
  enviarBytes,
  ejecutarYEsperar,
  SERVIDOR,
  NODE
};
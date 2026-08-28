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

async function arrancarServidor(datosDir, puerto) {
  const args = [SERVIDOR, '--datos', datosDir, '--puerto', String(puerto === undefined ? 0 : puerto)];
  const proc = spawn(NODE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const linea = await esperarLinea(proc, 'SGC-SERVIDOR-PUERTO', ESPERA_ARRANQUE);
  const puertoReal = parseInt(linea.trim(), 10);
  if (Number.isNaN(puertoReal)) {
    proc.kill();
    throw new Error('el servidor no imprimió un puerto válido: "' + linea + '"');
  }
  return { proc, puerto: puertoReal };
}

function detenerServidor(ctx) {
  return new Promise((resolve) => {
    if (!ctx.proc) {
      return resolve();
    }
    if (ctx.proc.exitCode !== null || ctx.proc.signalCode !== null) {
      return resolve();
    }
    const terminador = setTimeout(() => {
      try {
        ctx.proc.kill('SIGKILL');
      } catch (e) {
        // ya terminó
      }
      resolve();
    }, 2000);
    ctx.proc.on('exit', () => {
      clearTimeout(terminador);
      resolve();
    });
    try {
      ctx.proc.kill();
    } catch (e) {
      clearTimeout(terminador);
      resolve();
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
  ejecutarYEsperar,
  SERVIDOR,
  NODE
};
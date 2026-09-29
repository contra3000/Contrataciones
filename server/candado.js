'use strict';

/*
 * candado.js
 * ORDEN-RONDA-26 pieza 6: un solo servidor por carpeta de datos.
 *
 * Al arrancar, el servidor deja `candado.json` en la carpeta de datos con la
 * máquina, el proceso y la hora, y lo renueva cada 30 segundos:
 *
 *  - si al arrancar hay un candado VIVO (renovado hace menos de 2 minutos),
 *    el servidor NO arranca y dice qué máquina lo tiene;
 *  - si el candado quedó ABANDONADO (no se renovó desde hace más de 2
 *    minutos), se reemplaza y se avisa (SGC-SERVIDOR-CANDADO-REEMPLAZADO);
 *  - al cerrar normalmente se borra: en un sistema operativo donde el proceso
 *    puede reaccionar a la señal (SIGTERM/SIGINT en los despliegues reales),
 *    lo borra el propio servidor; en Windows el cierre forzado no deja correr
 *    código, así que la limpieza de un cierre normal la hace quien detiene el
 *    servidor (helpers/servidor-util.detenerServidor) cuando el proceso que
 *    termina era el dueño del candado.
 *
 * Si un servidor muere de golpe (SIGKILL, apagón), su candado deja de
 * renovarse y queda abandonado a los 2 minutos: el siguiente arranque lo
 * reemplaza y avisa. La renuncia a borrar sobre SIGKILL es deliberada: un
 * proceso muerto no pertenece al candado y el tiempo lo dice.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { escribirAtomico } = require('./ayudantes.js');

const NOMBRE_CANDADO = 'candado.json';
const RENOVAR_MS = 30000;
const VIVO_MS = 120000;

function rutaCandado(datosDir) {
  return path.join(datosDir, NOMBRE_CANDADO);
}

function leer(datosDir) {
  try {
    return JSON.parse(fs.readFileSync(rutaCandado(datosDir), 'utf8'));
  } catch (e) {
    return null;
  }
}

// La vida del candado se mide por su última renovación: si un proceso dejó de
// renovar hace 2 minutos o más, ya no cuenta a nadie adentro.
function estaVivo(candado, ahoraMs) {
  if (!candado || typeof candado.renovado !== 'string') {
    return false;
  }
  const renovado = Date.parse(candado.renovado);
  return Number.isFinite(renovado) && (ahoraMs - renovado) < VIVO_MS;
}

// vivosAhora(): para los tests, cuándo un candado dado está vivo.
function vivosAhora(candado) {
  return estaVivo(candado, Date.now());
}

// Un candado de ESTA máquina cuyo proceso ya no existe está abandonado aunque
// tenga menos de 2 minutos: es el caso de cerrar la ventana negra en Windows,
// que no deja correr código de salida, y volver a abrir enseguida.
function abandonadoEnEstaMaquina(candado) {
  if (!candado || candado.maquina !== os.hostname() || !Number.isInteger(candado.pid) ||
      candado.pid === process.pid) {
    return false;
  }
  try {
    process.kill(candado.pid, 0);
    return false;
  } catch (e) {
    return !!e && e.code === 'ESRCH';
  }
}

let liberarActual = null;

function vigilarSalida() {
  const limpiar = () => {
    if (liberarActual && typeof liberarActual === 'function') {
      liberarActual();
    }
  };
  process.on('SIGINT', () => { limpiar(); process.exit(0); });
  process.on('SIGTERM', () => { limpiar(); process.exit(0); });
  // Windows emite SIGHUP al cerrar la ventana de consola.
  process.on('SIGHUP', () => { limpiar(); process.exit(0); });
  process.on('exit', limpiar);
}

function tomar(datosDir) {
  const ruta = rutaCandado(datosDir);
  const existente = leer(datosDir);
  if (estaVivo(existente, Date.now()) && !abandonadoEnEstaMaquina(existente)) {
    const maquina = existente && existente.maquina
      ? existente.maquina
      : 'desconocida';
    throw new Error('la carpeta de datos ya está en uso por la máquina "' +
      maquina + '". Cierre ese servidor antes de arrancar otro sobre la misma carpeta');
  }
  if (existente) {
    console.log('SGC-SERVIDOR-CANDADO-REEMPLAZADO ' +
      (existente.maquina || 'desconocida'));
  }

  const ahora = new Date().toISOString();
  const propio = { maquina: os.hostname(), pid: process.pid, iniciado: ahora, renovado: ahora };
  escribirAtomico(ruta, JSON.stringify(propio, null, 2) + '\n');

  // Si en el ínterin otro proceso alcanzó a escribir su candado, este arranque
  // NO es el dueño y no debe seguir: se rechaza con el mismo mensaje.
  const releido = leer(datosDir);
  if (!releido || releido.pid !== process.pid) {
    throw new Error('la carpeta de datos ya está en uso por otra instancia: ' +
      'el candado cambió de dueño durante el arranque');
  }

  const renovador = setInterval(() => {
    try {
      const actual = leer(datosDir);
      if (!actual || actual.pid !== process.pid) {
        return;
      }
      const fresco = Object.assign({}, actual, { renovado: new Date().toISOString() });
      escribirAtomico(ruta, JSON.stringify(fresco, null, 2) + '\n');
    } catch (e) {
      // Si el disco falla, el candado envejece solo y otro servidor podrá
      // entrar; no se mata el proceso por eso.
    }
  }, RENOVAR_MS);
  if (typeof renovador.unref === 'function') {
    renovador.unref();
  }

  function liberar() {
    clearInterval(renovador);
    try {
      const actual = leer(datosDir);
      if (actual && actual.pid === process.pid) {
        fs.unlinkSync(ruta);
      }
    } catch (e) {
      // Ya sin candado: nada que borrar.
    }
  }
  liberarActual = liberar;

  return { liberar };
}

module.exports = {
  NOMBRE_CANDADO,
  RENOVAR_MS,
  VIVO_MS,
  rutaCandado,
  leer,
  estaVivo,
  vivosAhora,
  tomar,
  vigilarSalida
};
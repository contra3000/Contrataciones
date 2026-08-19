#!/usr/bin/env node
/*
 * respaldo.js
 * ORDEN-RONDA-08 §2.3. Respaldo de la carpeta de datos del SGC:
 *
 *   node tools/respaldo.js --datos <ruta> --destino <ruta> [--retener N]
 *
 * - Copia toda la carpeta de datos (expedientes, índice, histórico, contador)
 *   a <destino>/sgc-respaldo-<fecha>.<hora>, con lock de respaldo y rename
 *   atómico como punto de commit: nunca queda un respaldo a medias.
 * - Retención: por defecto se conservan los últimos 14 respaldos; los más
 *   viejos se borran. Con --retener 0 se conservan todos.
 * - El informe se imprime por consola y se exporta `crear(datosDir, destino,
 *   retener)` para que los tests corran la misma lógica.
 *
 * Sin dependencias: sólo la biblioteca estándar de Node.
 */
'use strict';

const path = require('node:path');

const { crearRespaldo } = require('./ayudantes-respaldo.js');

function usarArgumentos(argv) {
  const opciones = { datos: null, destino: null, retener: 14 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) {
      opciones.datos = argv[i + 1];
      i++;
    } else if (argv[i] === '--destino' && i + 1 < argv.length) {
      opciones.destino = argv[i + 1];
      i++;
    } else if (argv[i] === '--retener' && i + 1 < argv.length) {
      opciones.retener = parseInt(argv[i + 1], 10);
      i++;
    }
  }
  return opciones;
}

function verificar(opciones) {
  if (!opciones.datos) {
    throw new Error('falta el argumento obligatorio --datos <ruta>: la carpeta que se respalda');
  }
  if (!opciones.destino) {
    throw new Error('falta el argumento obligatorio --destino <ruta>: la carpeta donde se guardan los respaldos');
  }
  if (!Number.isInteger(opciones.retener) || opciones.retener < 0) {
    throw new Error('--retener debe ser un número entero mayor o igual a 0 (recibido: ' + opciones.retener + ')');
  }
}

function main() {
  const opciones = usarArgumentos(process.argv.slice(2));
  try {
    verificar(opciones);
    const informe = crearRespaldo(opciones.datos, opciones.destino, opciones.retener);
    console.log('Respaldo creado: ' + informe.ruta);
    console.log('Retenidos (' + opciones.retener + '): ' + informe.retenidos.length + ' respaldo(s).');
    if (informe.eliminados.length > 0) {
      console.log('Eliminados por retención:');
      for (const nombre of informe.eliminados) {
        console.log('  - ' + path.join(opciones.destino, nombre));
      }
    }
  } catch (e) {
    console.error('respaldo: ' + e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crear: crearRespaldo };
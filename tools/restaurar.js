#!/usr/bin/env node
/*
 * restaurar.js
 * ORDEN-RONDA-08 §2.3. Restaura un respaldo del SGC en una carpeta de datos:
 *
 *   node tools/restaurar.js --origen <backup> --destino <ruta>
 *
 * - El origen debe ser un respaldo creado por tools/respaldo.js
 *   (sgc-respaldo-<fecha>.<hora>).
 * - Antes de copiar valida el respaldo (ORDEN-RONDA-09 corrección 2.3):
 *   contador.json, idx/ y que los JSON parseen; si algo falla aborta y dice
 *   qué está mal.
 * - Copia el contenido del respaldo en el destino (creándolo si hace falta),
 *   por encima de lo que haya. Es una restauración destructiva: el operador
 *   debe apuntar a una carpeta de datos vacía o descartable, y se le listan
 *   los archivos del destino que no estaban en el respaldo y quedan mezclados
 *   (corrección 2.2).
 * - Exporta `restaurar(origen, destino)` para que los tests corran la misma
 *   lógica.
 *
 * Sin dependencias: sólo la biblioteca estándar de Node.
 */
'use strict';

const { restaurarRespaldo } = require('./ayudantes-respaldo.js');

function usarArgumentos(argv) {
  const opciones = { origen: null, destino: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--origen' && i + 1 < argv.length) {
      opciones.origen = argv[i + 1];
      i++;
    } else if (argv[i] === '--destino' && i + 1 < argv.length) {
      opciones.destino = argv[i + 1];
      i++;
    }
  }
  return opciones;
}

function verificar(opciones) {
  if (!opciones.origen) {
    throw new Error('falta el argumento obligatorio --origen <backup>: el respaldo a restaurar');
  }
  if (!opciones.destino) {
    throw new Error('falta el argumento obligatorio --destino <ruta>: la carpeta de datos donde restaurar');
  }
}

function main() {
  const opciones = usarArgumentos(process.argv.slice(2));
  try {
    verificar(opciones);
    const resultado = restaurarRespaldo(opciones.origen, opciones.destino);
    console.log('Restaurado: ' + resultado.origen + ' -> ' + resultado.destino);
    if (resultado.huerfanos && resultado.huerfanos.length > 0) {
      console.log('Archivos del destino que NO estaban en el respaldo (quedan mezclados con lo restaurado):');
      for (const rel of resultado.huerfanos) {
        console.log('  - ' + rel);
      }
    } else {
      console.log('El destino no tenía archivos ajenos al respaldo.');
    }
    console.log('ADVERTENCIA: la restauración copió por encima de lo que hubiera en el destino.');
  } catch (e) {
    console.error('restaurar: ' + e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { restaurar: restaurarRespaldo };
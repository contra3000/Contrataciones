'use strict';

/*
 * transiciones-servidor-matriz-2.test.js
 * Segunda mitad de la matriz 18 × 7 por el servidor (ORDEN-RONDA-07 §2.1).
 * ORDEN-RONDA-09 corrección 2.1: se ejecuta en paralelo con
 * transiciones-servidor-matriz.test.js, cada test con su timeout explícito.
 */

const { correrMatriz, config } = require('./helpers/matriz-servidor-bateria.js');

const segundaMitad = config.ESTADOS.filter((e, i) => i >= Math.ceil(config.ESTADOS.length / 2));

correrMatriz(segundaMitad);
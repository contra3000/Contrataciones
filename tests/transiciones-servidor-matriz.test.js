'use strict';

/*
 * transiciones-servidor-matriz.test.js
 * ORDEN-RONDA-07 §2.1 (condición de entrada): matriz 18 × 7 por el servidor.
 * ORDEN-RONDA-09 corrección 2.1: la matriz se parte en dos archivos que el
 * runner ejecuta en paralelo (primera mitad acá, segunda en
 * transiciones-servidor-matriz-2.test.js) y cada test lleva su timeout
 * explícito, para que la suite completa corra en verde de una sola pasada.
 */

const { correrMatriz, config } = require('./helpers/matriz-servidor-bateria.js');

const primeraMitad = config.ESTADOS.filter((e, i) => i < Math.ceil(config.ESTADOS.length / 2));

correrMatriz(primeraMitad);
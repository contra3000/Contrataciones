/*
 * credenciales.js
 * ORDEN-RONDA-14 §3.2 (ADR-027, ADR-034). Credenciales de acceso al SGC.
 *
 * Sólo el hash sobrevive: la clave en claro jamás se guarda en disco. El hash
 * es scrypt (node:crypto, N=16384, r=8, p=1, sal de 16 bytes, 64 bytes de
 * salida, comparación en tiempo constante). Parámetros de OWASP para contraseñas;
 * la clave real del SGC es larga por construcción (cuatro palabras del
 * diccionario, ~44 bits, ADR-034), así que el factor de trabajo alcanza.
 *
 * Este módulo no toca el disco ni la red: recibe y devuelve valores. La
 * generación de claves y el padrón viven en tools/padron.js y server/sesion.js.
 */
'use strict';

const crypto = require('node:crypto');

const PARAMETROS_SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const LARGO_SAL = 16; // bytes
const LARGO_HASH = 64; // bytes

function crearSal() {
  return crypto.randomBytes(LARGO_SAL).toString('hex');
}

function hashClave(clave, salHex) {
  return crypto.scryptSync(String(clave), salHex, LARGO_HASH, PARAMETROS_SCRYPT)
    .toString('hex');
}

// {sal, hash} listos para guardar en el padrón.
function crearHash(clave) {
  const sal = crearSal();
  return { sal, hash: hashClave(clave, sal) };
}

function verificarClave(clave, credenciales) {
  if (!credenciales || !credenciales.hash || !credenciales.sal) {
    return false;
  }
  const esperado = Buffer.from(credenciales.hash, 'hex');
  const calculado = Buffer.from(hashClave(clave, credenciales.sal), 'hex');
  if (esperado.length !== calculado.length) {
    return false;
  }
  return crypto.timingSafeEqual(esperado, calculado);
}

// Clave provisoria: cuatro palabras del diccionario en minúsculas y sin
// tildes, separadas por guiones (ADR-034). El diccionario lo pasa quien la
// genera (config/palabras.json); aquí sólo se arma la forma.
function generarClave(diccionario) {
  const palabras = Array.isArray(diccionario) ? diccionario : [];
  if (palabras.length < 4) {
    throw new Error('el diccionario de palabras debe tener al menos 4 entradas para generar una clave provisoria');
  }
  const elegidas = [];
  for (let i = 0; i < 4; i++) {
    elegidas.push(String(palabras[Math.floor(Math.random() * palabras.length)]).trim());
  }
  return elegidas.join('-');
}

module.exports = {
  PARAMETROS_SCRYPT,
  crearSal,
  hashClave,
  crearHash,
  verificarClave,
  generarClave
};
/*
 * auditoria.js
 * Cadena de auditoría con hash encadenado (ADR-006, ADR-017).
 *
 * Alcance honesto de la garantía: el hash es determinista y no criptográfico,
 * y el algoritmo es público. La cadena detecta edición casual y corrupción
 * accidental del registro, pero NO resiste una manipulación deliberada por
 * parte de alguien que conozca el algoritmo. La identidad de quien origina una
 * entrada es declarada por el propio operador (ADR-017): no se verifica contra
 * el servidor de correo.
 *
 * Reglas de construcción:
 *  - Cada entrada guarda el hash de la anterior en `hashPrevio`. La primera
 *    tiene `hashPrevio: null`.
 *  - La serialización recorre los campos en orden fijo, así dos entradas
 *    iguales producen siempre el mismo texto y el mismo hash.
 *  - Todo instante llega en `datos.timestamp`: nunca se consulta el reloj.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('auditoria.js requiere que namespaces.js se cargue primero');
  }

  var CAMPOS_ENTRADA = [
    'timestamp', 'email', 'rol', 'equipo', 'accion',
    'de', 'a', 'motivo', 'observacion', 'hashPrevio'
  ];

  // Serialización estable en orden fijo. Un campo ausente se serializa como
  // cadena vacía; los presentes, con JSON.stringify para distinguir los tipos.
  function serializarEntrada(entrada) {
    var partes = [];
    for (var i = 0; i < CAMPOS_ENTRADA.length; i++) {
      var clave = CAMPOS_ENTRADA[i];
      var valor = entrada[clave];
      partes.push(clave + '=' + (valor === undefined ? '' : JSON.stringify(valor)));
    }
    return partes.join('|');
  }

  // FNV-1a de 32 bits en hexadecimal. Determinista: mismo texto, mismo hash.
  function hash(texto) {
    var h = 0x811c9dc5;
    for (var i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  // Crea la entrada siguiente de la cadena. `entradaPrevia` es la última
  // entrada existente (o null si es la primera): su hash queda como hashPrevio.
  function crearEntrada(entradaPrevia, datos) {
    return {
      timestamp: datos.timestamp,
      email: datos.email,
      rol: datos.rol,
      equipo: datos.equipo,
      accion: datos.accion,
      de: datos.de,
      a: datos.a,
      motivo: datos.motivo === undefined ? null : datos.motivo,
      observacion: datos.observacion === undefined ? null : datos.observacion,
      hashPrevio: entradaPrevia ? hash(serializarEntrada(entradaPrevia)) : null
    };
  }

  // Verifica la cadena de hash. Devuelve el índice de la primera entrada cuya
  // cadena no cierra (su hashPrevio no coincide con el hash de la anterior;
  // en la primera entrada el hashPrevio debe ser null) o null si está íntegra.
  // Una cadena vacía se considera íntegra. Alcance: edición casual y
  // corrupción; ver la cabecera del archivo.
  function verificarCadena(auditLog) {
    if (!Array.isArray(auditLog)) {
      return { integra: false, rotaEn: 0 };
    }
    for (var i = 0; i < auditLog.length; i++) {
      var esperado = i === 0 ? null : hash(serializarEntrada(auditLog[i - 1]));
      var presente = auditLog[i] ? auditLog[i].hashPrevio : null;
      if (presente !== esperado) {
        return { integra: false, rotaEn: i };
      }
    }
    return { integra: true, rotaEn: null };
  }

  SGC.core.auditoria = {
    hash: hash,
    crearEntrada: crearEntrada,
    verificarCadena: verificarCadena
  };
})(typeof window !== 'undefined' ? window : globalThis);

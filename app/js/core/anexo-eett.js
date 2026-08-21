/*
 * anexo-eett.js
 * Regla de desborde del anexo de Especificaciones Técnicas
 * (ORDEN-RONDA-10 §3.2, H12, ADR-022).
 *
 * La aclaración de un renglón se imprime en el requerimiento hasta el límite
 * MAX_ACLARACION (config.js, hoy 256, enmienda ADR-014). Lo que supera ese
 * límite no se recorta ni se rechaza: va COMPLETO al anexo y en la celda del
 * requerimiento queda la referencia "según anexo <nombre>".
 *
 * Nomenclatura automática: alfabeto fonético OTAN (alfa, bravo, charly...),
 * un nombre por renglón desbordado, en orden de renglón. Si el alfabeto se
 * agota (más de 26 anexos) se agrega un sufijo numérico: alfa-2, bravo-2...
 * Si ningún renglón desborda pero hay condiciones particulares, queda un
 * único anexo con sólo esas condiciones.
 *
 * Criterio de conteo de caracteres: puntos de código Unicode (Array.from),
 * no unidades UTF-16. Así 'ñ', 'á' o un emoji cuentan 1 cada uno y el número
 * que ve el operador coincide con lo que imprime.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('anexo-eett.js requiere que namespaces.js se cargue primero');
  }

  var NOMBRES = ['alfa', 'bravo', 'charly', 'delta', 'echo', 'foxtrot', 'golf',
    'hotel', 'india', 'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar',
    'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor',
    'whiskey', 'x-ray', 'yankee', 'zulu'];

  // Definición única en core/utils.js (ORDEN-RONDA-10-CIERRE §2): puntos de
  // código, el mismo criterio del validador y del contador visible. La función
  // queda expuesta acá por compatibilidad con los consumidores de la ronda 10.
  function contarCaracteres(texto) {
    return SGC.core.utils.contarCaracteres(texto);
  }

  function limiteImpreso() {
    return SGC.core.config.MAX_ACLARACION;
  }

  function desborda(texto) {
    return contarCaracteres(texto) > limiteImpreso();
  }

  function nombreAnexo(n) {
    if (typeof n !== 'number' || n < 1 || n !== Math.floor(n)) {
      return null;
    }
    var i = n - 1;
    var vuelta = Math.floor(i / NOMBRES.length);
    var base = NOMBRES[i % NOMBRES.length];
    return vuelta === 0 ? base : base + '-' + (vuelta + 1);
  }

  function textoLimpio(t) {
    return typeof t === 'string' && t.trim() !== '' ? t : '';
  }

  function condicionesParticulares(expediente) {
    // El expediente puede llegar plano o con wrapper .datos (misma
    // normalización que hace core/requerimiento.js).
    var datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
    var req = datos.requerimiento && typeof datos.requerimiento === 'object'
      ? datos.requerimiento : {};
    return textoLimpio(req.condicionesParticulares);
  }

  function renglonesDe(expediente) {
    var datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
    return Array.isArray(datos.renglones) ? datos.renglones : [];
  }

  // planificar(expediente) → {anexos:[{nombre, indice}], referencias:{i:nombre}}
  // `indice` es la posición del renglón desbordado en datos.renglones, o null
  // cuando el anexo sólo lleva condiciones particulares.
  function planificar(expediente) {
    var renglones = renglonesDe(expediente);
    var anexos = [];
    var referencias = {};
    for (var i = 0; i < renglones.length; i++) {
      if (desborda(renglones[i].aclaracion)) {
        var nombre = nombreAnexo(anexos.length + 1);
        anexos.push({ nombre: nombre, indice: i });
        referencias[i] = nombre;
      }
    }
    if (anexos.length === 0 && condicionesParticulares(expediente) !== '') {
      anexos.push({ nombre: nombreAnexo(1), indice: null });
    }
    return { anexos: anexos, referencias: referencias };
  }

  function tieneContenido(expediente) {
    return planificar(expediente).anexos.length > 0;
  }

  // Lo que imprime la celda Aclaración del requerimiento para un renglón.
  // `nombre` es el nombre asignado por planificar(); si el llamador no lo
  // tiene todavía, se pasa null y se imprime la referencia genérica.
  function aclaracionImpresa(renglon, nombre) {
    if (desborda(renglon.aclaracion)) {
      return 'según anexo ' + (nombre || 'de EETT');
    }
    return typeof renglon.aclaracion === 'string' ? renglon.aclaracion : '';
  }

  SGC.core.anexoEett = {
    contarCaracteres: contarCaracteres,
    limiteImpreso: limiteImpreso,
    desborda: desborda,
    nombreAnexo: nombreAnexo,
    condicionesParticulares: condicionesParticulares,
    planificar: planificar,
    tieneContenido: tieneContenido,
    aclaracionImpresa: aclaracionImpresa,
    NOMBRES: NOMBRES
  };
})(typeof window !== 'undefined' ? window : globalThis);

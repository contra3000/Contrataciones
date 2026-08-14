/*
 * borrador.js
 * Borrador local de la Fase 1 (ORDEN-RONDA-05 §3.2, FSD §5,
 * InstruccionesCodigo.md §11.2).
 *
 * Vive en sessionStorage (nunca localStorage) y sobrevive a un cierre
 * accidental de la pestaña. Guarda el correo del operador que lo creó: si
 * entra otro operador no se le ofrece el borrador ajeno. Nunca se aplica en
 * silencio: la vista decide ofrecerlo o descartarlo.
 *
 * El storage es inyectable (interfaz getItem/setItem/removeItem) para poder
 * probarlo en Node sin navegador. En producción se pasa sessionStorage.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('borrador.js requiere que namespaces.js se cargue primero');
  }

  var CLAVE = 'sgc.borrador.v1';

  function guardar(storage, datos, operador) {
    var registro = {
      operador: operador,
      guardado: new Date().toISOString(),
      datos: datos
    };
    storage.setItem(CLAVE, JSON.stringify(registro));
    return true;
  }

  function leer(storage) {
    var texto = storage.getItem(CLAVE);
    if (!texto) {
      return null;
    }
    try {
      var registro = JSON.parse(texto);
      if (!registro || typeof registro !== 'object' ||
          typeof registro.operador !== 'string' || !registro.datos) {
        return null;
      }
      return registro;
    } catch (e) {
      return null;
    }
  }

  function limpiar(storage) {
    storage.removeItem(CLAVE);
  }

  function operadorDe(storage) {
    var registro = leer(storage);
    return registro ? registro.operador : null;
  }

  SGC.views.borrador = {
    CLAVE: CLAVE,
    guardar: guardar,
    leer: leer,
    limpiar: limpiar,
    operadorDe: operadorDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
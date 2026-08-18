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

  // Verifica la forma interna de los datos de un borrador antes de aplicarlos
  // (ORDEN-RONDA-06 §2.1). El borrador vive en sessionStorage y puede venir de
  // una versión anterior del formulario, así que no basta con que `operador`
  // sea una cadena y `datos` un objeto: cada sección debe tener la forma que
  // la aplicación espera. Devuelve {valido, motivo}; el motivo es un texto
  // legible para el usuario.
  function validarForma(datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      return { valido: false, motivo: 'los datos no son un objeto' };
    }
    if (!datos.identificacion || typeof datos.identificacion !== 'object' ||
        Array.isArray(datos.identificacion)) {
      return { valido: false, motivo: 'falta la sección de identificación' };
    }
    if (!Array.isArray(datos.renglones)) {
      return { valido: false, motivo: 'la lista de renglones no es un arreglo' };
    }
    for (var i = 0; i < datos.renglones.length; i++) {
      var r = datos.renglones[i];
      if (!r || typeof r !== 'object' || typeof r.codigo !== 'string' ||
          typeof r.cantidad !== 'number' || typeof r.unidad !== 'string') {
        return { valido: false, motivo: 'el renglón ' + (i + 1) + ' no tiene la forma esperada' };
      }
    }
    if (!datos.fundamentacion || typeof datos.fundamentacion !== 'object' ||
        Array.isArray(datos.fundamentacion)) {
      return { valido: false, motivo: 'falta la sección de fundamentación' };
    }
    return { valido: true, motivo: null };
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
    validarForma: validarForma,
    operadorDe: operadorDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
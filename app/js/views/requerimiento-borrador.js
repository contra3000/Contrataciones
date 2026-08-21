/*
 * requerimiento-borrador.js
 * ORDEN-RONDA-10 §3.1 (H11). Borrador local de la pantalla de carga del
 * requerimiento: una entrada de localStorage por expediente (clave distinta de
 * la del wizard), que sobrevive cierres y recargas mientras el expediente no
 * pasó todavía a la Afectación.
 *
 * Vive separado de requerimiento-formulario.js para que ningún archivo de la
 * pantalla supere las 400 líneas (ORDEN-RONDA-10 §3.1). El borrador es una
 * ayuda, no una condición: sin storage disponible, corrupto o viejo, la
 * pantalla arranca igual y el guardado real es el del servidor.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-borrador.js requiere que namespaces.js se cargue primero');
  }

  var CLAVE_BORRADOR = 'sgc.borrador-requerimiento.v1';

  var estado = {
    storage: null,
    proveedor: null,
    expedienteId: null
  };

  // Inyección para pruebas: mismo trato que el resto de las vistas
  // (fijarStorage antes de montar).
  function fijarStorage(s) {
    estado.storage = s;
  }

  // El contenido lo aporta el formulario en el momento del guardado: campos
  // del encabezado, condiciones particulares y lo leído del bloque de valores.
  function definirProveedor(proveedor) {
    estado.proveedor = proveedor;
  }

  function fijarExpedienteId(id) {
    estado.expedienteId = id;
  }

  function storage() {
    if (estado.storage) {
      return estado.storage;
    }
    try {
      return root.localStorage;
    } catch (e) {
      return null;
    }
  }

  function claveBorrador() {
    return CLAVE_BORRADOR + '.' + (estado.expedienteId || '');
  }

  function leer() {
    var s = storage();
    if (!s || typeof s.getItem !== 'function') {
      return null;
    }
    try {
      var datos = JSON.parse(s.getItem(claveBorrador()));
      if (!datos || typeof datos !== 'object' || !datos.datos || typeof datos.datos !== 'object') {
        return null;
      }
      return datos;
    } catch (e) {
      return null;
    }
  }

  function guardar() {
    var s = storage();
    if (!s || typeof s.setItem !== 'function' || !estado.expedienteId || !estado.proveedor) {
      return;
    }
    var p = estado.proveedor;
    var leido = typeof p.valoresLeidos === 'function' ? p.valoresLeidos() : null;
    var paquete = {
      operador: typeof p.operadorEmail === 'function' ? p.operadorEmail() : '',
      guardado: new Date().toISOString(),
      datos: {
        campos: p.campos(),
        condicionesParticulares: p.condiciones(),
        valores: leido ? leido.valores : [],
        cantidades: leido ? leido.cantidades : []
      }
    };
    try {
      s.setItem(claveBorrador(), JSON.stringify(paquete));
    } catch (e) {
      // Sin storage disponible (o lleno): el borrador es una ayuda, no una
      // condición; el guardado real es el del servidor.
    }
  }

  function limpiar() {
    var s = storage();
    if (s && typeof s.removeItem === 'function') {
      s.removeItem(claveBorrador());
    }
  }

  SGC.views.requerimientoBorrador = {
    fijarStorage: fijarStorage,
    definirProveedor: definirProveedor,
    fijarExpedienteId: fijarExpedienteId,
    leer: leer,
    guardar: guardar,
    limpiar: limpiar
  };
})(typeof window !== 'undefined' ? window : globalThis);

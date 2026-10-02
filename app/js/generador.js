/*
 * generador.js
 * ORDEN-RONDA-28 §2 · "generador.html: rol, nombre y nada de red" (ADR-044).
 *
 * Arranque del segundo punto de entrada del mismo repositorio. Se abre con
 * doble clic (file://), sin servidor, sin puerto y sin instalar nada: el Jefe
 * lo usa mientras se tramita el servidor.
 *
 * Tres reglas que este archivo sostiene, y que la aplicación con servidor no
 * necesita porque sí tiene red:
 *
 *  1. NINGUNA llamada de red: ni fetch, ni XMLHttpRequest, ni <script> que pida
 *     algo. El catálogo llega inyectando <script> con los .js hermanos que
 *     escribe el build (carga.js), y la configuración llega como .js.
 *  2. NUNCA repo.http ni repo.sesion. El repositorio es el de memoria, que
 *     tiene el mismo contrato (ADR-002): los repositorios son intercambiables,
 *     así que las vistas no se enteran de cuál es.
 *  3. SIN login y SIN padrón (ADR-017 no aplica acá): se escribe un nombre libre
 *     y se elige el rol de una lista cerrada. El nombre queda sellado en cada
 *     exportación (pieza 4).
 *
 * Este rol tiene una sola vista habilitada. Abastecimiento y Contrataciones
 * avisan que llegan en la ronda 29 y 30: no es un error ni una pantalla
 * vacía, es el estado del proyecto, y se dice en castellano.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views || !SGC.adapters) {
    throw new Error('generador.js requiere el núcleo completo: namespaces, core, views y adapters');
  }

  // Guardián de la regla 2. Si alguien deja repo.http.js o repo.sesion.js en
  // generador.html, el arranque falla acá y no en el medio de una operación
  // donde el síntoma sería más difícil de entender.
  if (SGC.adapters.repoHttp || SGC.adapters.sesion) {
    throw new Error('generador.js no puede arrancar con los adaptadores de red cargados ' +
      '(repo.http, repo.sesion): el generador no tiene servidor');
  }
  if (!SGC.adapters.repoMemoria || typeof SGC.adapters.repoMemoria.crear !== 'function') {
    throw new Error('generador.js requiere el repositorio en memoria (repo.memoria.js)');
  }
  if (!SGC.cargaConfig) {
    throw new Error('generador.js requiere el cargador de configuración (generador/config-carga.js)');
  }

  // El rol que ejecuta el primer estado del circuito: el mismo id que usa el
  // padrón de la aplicación con servidor (config.js ROLES[0]). Con el mismo id,
  // los permisos que el núcleo calcula dan lo mismo en las dos caras.
  var ROL_GENERADOR = 'generador';

  // Los otros dos roles del generador, con la ronda en la que llegan
  // (ORDEN-RONDA-28 §2; ADR-044, tabla de rondas).
  var ROLES_FUTUROS = {
    abastecimiento: 'Abastecimiento (número de SCo y ANEXO I consolidado) está disponible en la próxima versión.',
    contrataciones: 'Contrataciones (número de procedimiento y pliego) está disponible en la próxima versión.'
  };

  var RUTA_CONFIG = 'config/aplicacion.json';

  var estado = {
    config: null,
    operador: null,
    repo: null,
    dom: {}
  };

  function porId(id) {
    return document.getElementById(id);
  }

  // Aviso de la pantalla de identidad: falta el nombre.
  function avisar(texto) {
    var nodo = estado.dom.error;
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
  }

  function limpiarAviso() {
    if (estado.dom.error) {
      estado.dom.error.textContent = '';
      estado.dom.error.hidden = true;
    }
  }

  // Aviso de estado: "este rol llega en la ronda 29". Vive en un nodo con
  // role="status", para que un lector de pantalla lo anuncie sin que haga
  // falta mover el foco.
  function informar(texto) {
    var nodo = estado.dom.msj;
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
  }

  function mostrarError(texto) {
    var nodo = porId('sgc-app-error');
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
  }

  function nombreDeLaPantalla() {
    var nodo = estado.dom.nombre;
    return nodo ? String(nodo.value || '').trim() : '';
  }

  /*
   * El operador del generador.
   *
   * Sin padrón no hay correo: la identidad declarada es el nombre que la
   * persona escribió. El campo `email` se completa con ese nombre porque el
   * núcleo lo usa como identificador del operador en el borrador local y en la
   * validación del paso 1 ("El operador es obligatorio"); ponerlo vacío haría
   * que un requerimiento lleno no se pueda confirmar. No es un correo y no
   * viaja como tal: lo que se sella en la exportación es `nombre` y `rol`
   * (pieza 4), y el correo es sólo el identificador interno del operador.
   */
  function operadorDe(nombre) {
    return {
      nombre: nombre,
      apellido: '',
      email: nombre,
      rol: ROL_GENERADOR,
      roles: SGC.core.config.rolesEfectivos(ROL_GENERADOR),
      sector: 'usuario',
      administrador: false,
      origen: 'generador'
    };
  }

  function abrirAlta() {
    estado.dom.identidad.hidden = true;
    // El wizard deja a la vista el nombre y el rol, y esconde la pantalla de
    // selección de operador por su cuenta.
    SGC.views.wizard.seleccionarOperador(estado.operador, estado.repo);
  }

  function elegirRol(boton) {
    var rol = boton.getAttribute('data-rol');
    if (!rol) {
      return;
    }
    limpiarAviso();
    if (rol !== ROL_GENERADOR) {
      informar(ROLES_FUTUROS[rol] ||
        'Ese rol todavía no está en el generador.');
      return;
    }
    var nombre = nombreDeLaPantalla();
    if (nombre === '') {
      avisar('Escribí tu nombre para continuar.');
      return;
    }
    estado.operador = operadorDe(nombre);
    abrirAlta();
  }

  function montar() {
    var contenedor = porId('app');
    if (!contenedor) {
      throw new Error('No se encontró el contenedor #app');
    }

    estado.dom.identidad = porId('sgc-generador-identidad');
    estado.dom.nombre = porId('sgc-generador-nombre');
    estado.dom.error = porId('sgc-generador-error');
    estado.dom.msj = porId('sgc-generador-msj');
    estado.dom.roles = porId('sgc-generador-roles');
    if (!estado.dom.nombre || !estado.dom.roles) {
      throw new Error('generador.html no tiene la pantalla de identidad (#sgc-generador-nombre, #sgc-generador-roles)');
    }

    // La configuración llegó como .js (config/aplicacion.js), no por fetch. Si
    // no está, el generador no arranca: el nombre y la versión del sistema van
    // en el sello de cada exportación y no se pueden inventar.
    estado.config = SGC.cargaConfig.obtener(RUTA_CONFIG);
    if (!estado.config) {
      mostrarError('No se encontró la configuración del generador (' + RUTA_CONFIG +
        '). Corré: node tools/build-config.js');
      return;
    }

    // El repositorio es el de memoria. Se registra como el de la sesión (lo
    // llama SGC.adapters.repo.usar) porque es la única puerta por la que las
    // vistas piden datos; así, las mismas vistas sirven para las dos caras.
    estado.repo = SGC.adapters.repoMemoria.crear();
    SGC.adapters.repo.usar(estado.repo);

    // El alta es la de siempre: el mismo asistente, los mismos cuatro pasos y
    // el mismo buscador de catálogo. Montarla acá, y no cablearla de otro modo,
    // es lo que hace que un arreglo de un archivo valga para las dos
    // aplicaciones (ADR-044).
    SGC.views.wizard.montar(contenedor);
    SGC.views.wizard.fijarRepo(estado.repo);
    SGC.catalogo.buscador.montar(porId('sgc-paso-renglones'));
    SGC.views.wizard.vincularRenglones();

    var botones = estado.dom.roles.querySelectorAll('button');
    for (var i = 0; i < botones.length; i++) {
      (function (boton) {
        boton.addEventListener('click', function () {
          elegirRol(boton);
        });
      })(botones[i]);
    }
  }

  SGC.generador = {
    ROL_GENERADOR: ROL_GENERADOR,
    ROLES_FUTUROS: ROLES_FUTUROS,
    RUTA_CONFIG: RUTA_CONFIG,
    montar: montar,
    operadorActual: function () {
      return estado.operador;
    },
    config: function () {
      return estado.config;
    },
    repo: function () {
      return estado.repo;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
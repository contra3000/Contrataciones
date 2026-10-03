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
 *  3. SIN login y SIN padrón (ADR-017 no aplica acá): se escriben los cuatro
 *     datos de la persona —grado, nombre, apellido y número de control— y se
 *     elige el rol de una lista cerrada (ORDEN-RONDA-29 pieza 2). Los cuatro
 *     quedan a la vista en el asistente y sellados en cada exportación.
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
  if (!SGC.views.requerimientoValores) {
    throw new Error('generador.js requiere el bloque de valores de referencia (views/requerimiento-valores.js)');
  }
  if (!SGC.generadorPresupuestos || !SGC.generadorValores || !SGC.generadorDocumentos) {
    throw new Error('generador.js requiere los módulos del rol Usuario ' +
      '(generador/presupuestos.js, generador/valores.js, generador/documentos.js)');
  }
  if (!SGC.generadorIntercambio) {
    throw new Error('generador.js requiere el módulo de plantilla e intercambio (generador/intercambio.js)');
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

  /*
   * ORDEN-RONDA-29 pieza 2: los grados, en el orden en que se listan. Es la
   * lista cerrada que se ofrece en el desplegable, de menor a mayor.
   */
  var GRADOS = [
    'Personal Civil',
    'Cabo',
    'Cabo Primero',
    'Cabo Principal',
    'Suboficial Auxiliar',
    'Suboficial Ayudante',
    'Suboficial Principal',
    'Suboficial Mayor',
    'Alférez',
    'Teniente',
    'Primer Teniente',
    'Capitán',
    'Mayor',
    'Vicecomodoro',
    'Comodoro',
    'Brigadier'
  ];

  var estado = {
    config: null,
    operador: null,
    repo: null,
    dom: {}
  };

  function porId(id) {
    return document.getElementById(id);
  }

  // Aviso de la pantalla de identidad: falta un dato de los cuatro.
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
   * Los cuatro datos, obligatorios (ORDEN-RONDA-29 pieza 2).
   *
   * El número de control es un entero: se leen los dígitos, se sacan los puntos
   * de miles que muestra el campo y, si queda algo que no es un dígito, no se
   * entra. No se "limpia" lo que la persona escribió para admitirlo: si él
   * escribió `12a`, el número de control es `12a` y no es un número entero, y
   * el aviso tiene que decirlo. Formatear y avisar son cosas distintas.
   *
   * Vuelve {ok:true, datos:{grado, nombre, apellido, numeroControl}} o
   * {ok:false, motivo}.
   */
  function leerIdentidad() {
    var grado = estado.dom.grado ? String(estado.dom.grado.value || '').trim() : '';
    var nombre = nombreDeLaPantalla();
    var apellido = estado.dom.apellido ? String(estado.dom.apellido.value || '').trim() : '';

    if (grado === '') {
      return { ok: false, motivo: 'Elegí el grado.' };
    }
    if (GRADOS.indexOf(grado) === -1) {
      return { ok: false, motivo: 'Ese grado no está en la lista.' };
    }
    if (nombre === '') {
      return { ok: false, motivo: 'Escribí tu nombre.' };
    }
    if (apellido === '') {
      return { ok: false, motivo: 'Escribí tu apellido.' };
    }

    var escrito = estado.dom.numeroControl ? String(estado.dom.numeroControl.value || '').trim() : '';
    var digitos = escrito.replace(/\./g, '');
    if (digitos === '') {
      return { ok: false, motivo: 'Escribí tu número de control.' };
    }
    if (!/^\d+$/.test(digitos)) {
      return { ok: false, motivo: 'El número de control es un número entero: quitá "' +
        escrito + '" y dejá sólo los dígitos.' };
    }
    return {
      ok: true,
      datos: {
        grado: grado,
        nombre: nombre,
        apellido: apellido,
        numeroControl: parseInt(digitos, 10)
      }
    };
  }

  // El campo se muestra con puntos de miles mientras se escribe: 12345 ->
  // 12.345. Sólo se reformatea cuando lo escrito son dígitos, para no pisar lo
  // que la persona está escribiendo cuando todavía no es un número.
  function formatearNumeroControl() {
    var nodo = estado.dom.numeroControl;
    if (!nodo) {
      return;
    }
    var escrito = String(nodo.value || '').trim();
    var digitos = escrito.replace(/\./g, '');
    if (/^\d+$/.test(digitos)) {
      nodo.value = SGC.core.utils.numeroConPuntos(digitos);
    }
  }

  function operadorDe(datos) {
    return {
      grado: datos.grado,
      nombre: datos.nombre,
      apellido: datos.apellido,
      numeroControl: datos.numeroControl,
      // El `email` es el identificador interno del operador: con él se separa
      // el borrador de una persona del de otra y el núcleo valida que el
      // operador esté. Acá no hay correo, y sin padrón tampoco lo hay: lo que
      // se escribe es la identidad completa, con el número de control, que es
      // lo único que no se repite. No es un correo y no viaja como tal.
      email: datos.nombre + ' ' + datos.apellido + ' · ' +
        SGC.core.utils.numeroConPuntos(datos.numeroControl),
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
    // ORDEN-RONDA-28 §3: el rol Usuario hace, en el generador, todo lo que hace
    // el generador de Fase 1. Los presupuestos son referencias (no hay a dónde
    // subir un archivo), los valores de referencia se citan igual que en la
    // aplicación con servidor, y en vez de "Avanzar" están imprimir y exportar.
    montarRolUsuario();
  }

  /*
   * El paso 2 del generador tiene dos bloques que la aplicación con servidor
   * tiene en otra pantalla (la de carga del requerimiento del expediente): los
   * presupuestos de referencia y los valores de referencia por renglón. Se
   * montan acá y se re-sincronizan cada vez que cambia la lista de renglones,
   * porque el bloque se arma con los renglones de ese momento.
   */
  function montarRolUsuario() {
    var raiz = porId('app');
    // Empezar de cero: lo que esté en memoria es de una pantalla anterior.
    SGC.generadorPresupuestos.limpiar();
    SGC.generadorValores.limpiar();
    SGC.generadorPresupuestos.montar(raiz);
    SGC.generadorPresupuestos.alCambio(sincronizarValores);
    SGC.generadorValores.montar(raiz);
    SGC.generadorValores.alCambio(publicarDatos);
    SGC.generadorDocumentos.montar();
    SGC.generadorDocumentos.seleccionarOperador(estado.operador);
    // ORDEN-RONDA-28 §4: "Exportar para Abastecimiento" ya no es un aviso de que
    // la descarga llega después: arma el archivo con el sello y lo baja. La
    // validación del botón la hace el propio módulo, que vuelve con el motivo.
    SGC.generadorDocumentos.onExportar(function () {
      SGC.generadorIntercambio.exportar().then(function (resultado) {
        if (resultado.ok) {
          avisarEnRevision('Se descargó ' + resultado.nombre + ' (versión ' + resultado.version +
            '). Ese archivo es el que pasa a Abastecimiento.');
        } else {
          avisarEnRevision(resultado.errores.join(' '));
        }
      });
    });
    // La lista de renglones del asistente y el bloque de valores de referencia
    // son la misma información vista de dos maneras: si cambia una, se rearma el
    // otro (el renglón recién agregado nace con sus dos filas de valores, como en
    // la pantalla del servidor).
    SGC.catalogo.renglones.alCambiar(sincronizarValores);
    SGC.views.wizard.alRender(publicarDatos);
    sincronizarValores();
  }

  // Los renglones del asistente. Los valores no viajan con ellos: el bloque de
  // valores se los pone sobre la misma lista al sincronizarse.
  function renglonesDelAsistente() {
    return SGC.catalogo.renglones.obtener();
  }

  function sincronizarValores() {
    SGC.generadorValores.sincronizar(renglonesDelAsistente(),
      SGC.generadorPresupuestos.listar());
  }

  // Los documentos del paso 4 se calculan sobre los datos que el asistente tiene
  // ahora, no sobre los que tenía cuando se montó.
  function publicarDatos() {
    SGC.views.wizard.sincronizar();
    SGC.generadorDocumentos.fijarDatos(SGC.views.wizard.datos());
  }

  function avisarEnRevision(texto) {
    var nodo = porId('sgc-generador-msj-revision');
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
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
    var identidad = leerIdentidad();
    if (!identidad.ok) {
      avisar(identidad.motivo);
      return;
    }
    estado.operador = operadorDe(identidad.datos);
    abrirAlta();
  }

  function montar() {
    var contenedor = porId('app');
    if (!contenedor) {
      throw new Error('No se encontró el contenedor #app');
    }

    estado.dom.identidad = porId('sgc-generador-identidad');
    estado.dom.grado = porId('sgc-generador-grado');
    estado.dom.nombre = porId('sgc-generador-nombre');
    estado.dom.apellido = porId('sgc-generador-apellido');
    estado.dom.numeroControl = porId('sgc-generador-numero-control');
    estado.dom.error = porId('sgc-generador-error');
    estado.dom.msj = porId('sgc-generador-msj');
    estado.dom.roles = porId('sgc-generador-roles');
    if (!estado.dom.nombre || !estado.dom.roles || !estado.dom.grado ||
        !estado.dom.apellido || !estado.dom.numeroControl) {
      throw new Error('generador.html no tiene la pantalla de identidad completa (#sgc-generador-grado, ' +
        '#sgc-generador-nombre, #sgc-generador-apellido, #sgc-generador-numero-control, #sgc-generador-roles)');
    }

    // El desplegable se arma con la lista de grados, en orden. La primera
    // opción es la de "no eligió": sin grado no se entra.
    for (var g = 0; g < GRADOS.length; g++) {
      var opcion = document.createElement('option');
      opcion.value = GRADOS[g];
      opcion.textContent = GRADOS[g];
      estado.dom.grado.appendChild(opcion);
    }
    if (estado.dom.numeroControl.addEventListener) {
      estado.dom.numeroControl.addEventListener('input', formatearNumeroControl);
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

    // ORDEN-RONDA-28 §4: una sesión arranca en la versión 0. El contador vive en
    // el módulo de intercambio, no acá, porque es lo único que tiene que saber
    // cuánto se exportó y se importó.
    SGC.generadorIntercambio.reiniciar();

    // La alta es la de siempre: el mismo asistente, los mismos cuatro pasos y
    // el mismo buscador de catálogo. Montarla acá, y no cablearla de otro modo,
    // es lo que hace que un arreglo de un archivo valga para las dos
    // aplicaciones (ADR-044).
    //
    // Lo único propio del generador es el importador: en la aplicación es el
    // Fast-Track contra el servidor, y acá el archivo puede venir por el mismo
    // camino (una plantilla) o ser un requerimiento ya exportado. Lo que el
    // archivo traía de más —sus presupuestos y sus valores por renglón— lo
    // restaura este archivo, porque son estado local del generador y no forma
    // parte de los pasos del asistente.
    SGC.views.wizard.montar(contenedor, {
      importador: function (texto) {
        return SGC.generadorIntercambio.importar(texto);
      },
      alImportar: function (resultado) {
        SGC.generadorPresupuestos.cargar(resultado.presupuestos);
        SGC.generadorValores.fijar(
          SGC.catalogo.renglones.obtener(),
          SGC.generadorPresupuestos.listar(),
          resultado.valoresPorRenglon
        );
      }
    });
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
    GRADOS: GRADOS,
    RUTA_CONFIG: RUTA_CONFIG,
    montar: montar,
    leerIdentidad: leerIdentidad,
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
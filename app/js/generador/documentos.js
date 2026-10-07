/*
 * documentos.js
 * ORDEN-RONDA-28 §3 (ADR-044). Los documentos del rol Usuario en el generador:
 * imprimir la Solicitud de Gastos y la Especificación Técnica (con sus anexos
 * cuando la aclaración desborda) y, en su lugar, "Exportar para Abastecimiento".
 *
 * Lo importante de este módulo es que NO reimplanta reglas: monta el expediente
 * local con la misma forma que el del servidor y llama a las mismas funciones.
 *
 *  - SGC.views.pasos.datosParaPersistir arma los datos iniciales igual que en el
 *    alta de la aplicación con servidor.
 *  - SGC.renders.requerimiento / renders.especificacionTecnica / renders.anexoEett
 *    componen los documentos con nodos DOM (nunca innerHTML, ADR-011) y con el
 *    mismo modelo que usa el servidor.
 *  - SGC.core.validacion.validarParaAvanzar + itemsFaltantes deciden si se puede
 *    exportar, con el texto de la ronda 26 y de la ronda 31 ("2 valores de
 *    referencia de fuentes distintas, o 1 valor y una justificación, en Renglón
 *    N", "guardar Especificación Técnica").
 *
 * El expediente local es de ESPECIFICACIONES_TECNICAS y no tiene número de
 * expediente real: lleva uno local y el sello va en el archivo exportado (pieza
 * 4). Lo que se "guarda" acá son los documentos compuestos: por eso generar e
 * imprimir marca el entregable `especificacion-tecnica`, que es lo que el estado
 * exige para poder avanzar.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders || !SGC.renders.documento) {
    throw new Error('generador/documentos.js requiere que namespaces.js y los renders se carguen primero');
  }

  var ESTADO = 'ESPECIFICACIONES_TECNICAS';
  var ID_ENTREGABLE = 'especificacion-tecnica';

  var estado = {
    operador: null,
    generados: false,
    datosActuales: null,
    onExportar: null,
    dom: {},
    onRevision: null
  };

  function versionCatalogo() {
    var est = SGC.catalogo.carga.obtenerEstado();
    return est && est.manifiesto ? est.manifiesto.catalogoVersion : null;
  }

  /*
   * El expediente local. Misma forma que el del servidor:
   *   {expedienteId, estado, campos, entregables, renglones, datos}
   * donde `datos` es lo que leen los renders (renders/documento.js modelo) y
   * `campos`/`entregables` lo que mira la validación del núcleo.
   */
  function expedienteLocal(datos) {
    var datosWizard = datos || {};
    var renglones = SGC.generadorValores.renglonesConValores();
    var presupuestos = SGC.generadorPresupuestos.listar();
    var datosIniciales = SGC.views.pasos.datosParaPersistir(
      datosWizard, estado.operador, versionCatalogo());
    // Los valores y las referencias van DENTRO de datos.renglones /
    // datos.presupuestos: es donde los leen core/requerimiento.js (y donde los
    // imprime el documento), igual que en el expediente del servidor.
    datosIniciales.renglones = renglones;
    datosIniciales.presupuestos = presupuestos;
    var resultado = {
      expedienteId: estado.operador ? ('generador-' + estado.operador.email) : 'generador',
      estado: { id: ESTADO },
      titulo: datosIniciales.titulo,
      fechaCreacion: new Date().toISOString(),
      campos: datosIniciales.campos,
      renglones: renglones,
      presupuestos: presupuestos,
      entregables: [],
      datos: datosIniciales
    };
    // ORDEN-RONDA-31 pieza 2a: "Imprimir" compone el anexo de EETT cuando hay
    // aclaraciones que desbordan o condiciones particulares, y el entregable
    // también hay que registrarlo: la validación del núcleo lo exige (ADR-029:
    // exigir, no saltear) y sin el registro "Exportar" queda deshabilitado para
    // siempre aunque el anexo se vea en la impresión.
    if (estado.generados) {
      resultado.entregables.push({
        id: ID_ENTREGABLE,
        nombre: SGC.renders.especificacionTecnica.nombre,
        ruta: 'local'
      });
      if (SGC.core.anexoEett.tieneContenido(resultado)) {
        resultado.entregables.push({
          id: 'anexo-eett',
          nombre: SGC.renders.anexoEett.nombre,
          ruta: 'local'
        });
      }
    }
    return resultado;
  }

  // La misma validación que usa el servidor para el botón "Avanzar" y el mismo
  // texto de lo que falta (itemsFaltantes, ORDEN-RONDA-26 pieza 2).
  function revision(datos) {
    var expediente = expedienteLocal(datos);
    var r = SGC.core.validacion.validarParaAvanzar(expediente);
    var items = SGC.core.validacion.itemsFaltantes(r);
    if (items.length === 0 && !r.valido) {
      items.push('el requerimiento todavía no está completo');
    }
    return { revision: r, items: items, expediente: expediente };
  }

/*
   * Un contenedor por documento: cada hoja del PDF es un documento, y con un
   * solo contenedor los anexos se encimarían entre sí (impresion.css pone
   * .documento-impresion en position:absolute justamente para que el flujo no
   * se mezcle).
   */
  function hoja(clase) {
    var div = document.createElement('div');
    div.className = clase || 'documento-generador';
    estado.dom.impresion.appendChild(div);
    return div;
  }

  function componer(contenedor, expediente) {
    var d = SGC.renders.documento;
    d.limpiar(contenedor);
    SGC.renders.requerimiento.montar(contenedor, expediente);
    return contenedor;
  }

  // La EETT y sus anexos. El plan lo dice el núcleo (core/anexo-eett.js): si no
  // hay nada que anexar, no hay anexo — tampoco vacío.
  function componerEett(contenedor, expediente) {
    var d = SGC.renders.documento;
    d.limpiar(contenedor);
    SGC.renders.especificacionTecnica.montar(contenedor, expediente);
    return SGC.core.anexoEett.planificar(expediente).anexos;
  }

  /*
   * Generar e imprimir. Se compone en el DOM (así el operador ve lo que va a
   * salir antes de que salga) y después se llama a la impresión del navegador
   * con la clase que impresion.css usa para dejar sólo el documento, igual que
   * hace la vista de expediente con el botón "Imprimir".
   */
  function imprimir(datos) {
    var info = revision(datos);
    if (info.revision.faltantes.campos.length > 0 ||
        (info.revision.faltantes.renglones && info.revision.faltantes.renglones.length > 0)) {
      // Falta algo de fondo: el texto del botón de exportar lo dice, y componer
      // un documento incompleto sería imprimir un papel inútil.
      actualizar();
      return { ok: false, items: info.items };
    }
    var expediente = info.expediente;
    var seccion = estado.dom.impresion;
    var d = SGC.renders.documento;
    d.limpiar(seccion);
    componer(hoja(), expediente);
    var anexos = componerEett(hoja(), expediente);
    for (var i = 0; i < anexos.length; i++) {
      var bloque = hoja();
      bloque.setAttribute('data-anexo', anexos[i].nombre);
      SGC.renders.anexoEett.montar(bloque, expediente, anexos[i].nombre);
    }
    // El EETT quedó compuesto: para el estado eso es el entregable que exige,
    // y a partir de acá se puede exportar (validarParaAvanzar).
    estado.generados = true;
    actualizar();
    SGC.renders.documento.fijarTituloImpresion('Solicitud de Gastos y Especificación Técnica');
    document.body.classList.add('imprimiendo');
    if (typeof root.print === 'function') {
      root.print();
    }
    document.body.classList.remove('imprimiendo');
    return { ok: true, items: [] };
  }

  // El botón de exportar se habilita con la validación del núcleo, y cuando no
  // puede, el texto dice qué falta (nunca un número de error).
  function actualizar() {
    if (!estado.dom.exportar) {
      return null;
    }
    var info = revision(estado.datosActuales || {});
    estado.dom.exportar.disabled = !info.revision.valido;
    var msj = estado.dom.exportarMsj;
    if (msj) {
      if (info.revision.valido) {
        msj.textContent = '';
        msj.hidden = true;
      } else {
        msj.textContent = 'Todavía no se puede exportar. Falta: ' + info.items.join(' · ');
        msj.hidden = false;
      }
    }
    return info;
  }

  /*
   * Los nodos están repartidos por la página: los botones van en el paso 4 del
   * asistente (dentro de #app) y la sección de impresión es hermana de #app,
   * porque tiene que sobrevivir a la regla que oculta el asistente al imprimir.
   * Por eso se busca en el documento entero y no en la raíz del asistente.
   */
  function montar() {
    var dom = {};
    estado.dom = dom;
    dom.impresion = document.getElementById('sgc-generador-impresion');
    dom.exportar = document.getElementById('sgc-btn-exportar');
    dom.exportarMsj = document.getElementById('sgc-exportar-msj');
    dom.imprimir = document.getElementById('sgc-btn-imprimir');
    if (!dom.impresion || !dom.exportar || !dom.imprimir) {
      throw new Error('generador/documentos.js requiere #sgc-generador-impresion, ' +
        '#sgc-btn-exportar y #sgc-btn-imprimir');
    }
    dom.imprimir.addEventListener('click', function () {
      SGC.generadorDocumentos.imprimir();
    });
    dom.exportar.addEventListener('click', function () {
      if (typeof estado.onExportar === 'function') {
        estado.onExportar();
      }
    });
  }

  SGC.generadorDocumentos = {
    ESTADO: ESTADO,
    // La sección de impresión, para los tests y para la pieza 4 (que compone
    // el archivo a partir de lo mismo que se imprime).
    seccion: function () {
      return estado.dom.impresion;
    },
    montar: montar,
    seleccionarOperador: function (operador) {
      estado.operador = operador;
      estado.generados = false;
    },
    fijarDatos: function (datos) {
      estado.datosActuales = datos;
      actualizar();
    },
    // El botón de exportar no decide nada: avisa que se puede exportar y que
    // la pieza 4 pone el archivo. Decir "todavía no" sería mentira al revés.
    onExportar: function (fn) {
      estado.onExportar = fn;
    },
    imprimir: function () {
      return imprimir(estado.datosActuales || {});
    },
    expedienteLocal: function () {
      return expedienteLocal(estado.datosActuales || {});
    },
    revision: function () {
      return revision(estado.datosActuales || {});
    },
    imprimirSolicitado: function () {
      return estado.generados;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
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

  // El último día del trimestre pedido, en dd/mm/aaaa: 31/03, 30/06, 30/09 o
  // 31/12 del año del requerimiento (ORDEN-RONDA-34 pieza 1).
  function ultimoDiaDelTrimestre(anio, trimestre) {
    var dias = { 1: '31/03/', 2: '30/06/', 3: '30/09/', 4: '31/12/' };
    var dia = dias[String(trimestre)];
    var y = String(anio === undefined || anio === null ? '' : anio);
    if (!dia || !/^\d{4}$/.test(y)) {
      return '—';
    }
    return dia + y;
  }

  function trimestreElegido(datosWizard) {
    var identificacion = datosWizard && typeof datosWizard.identificacion === 'object'
      ? datosWizard.identificacion : {};
    return typeof identificacion.trimestre === 'string' ? identificacion.trimestre : '';
  }

  /*
   * ORDEN-RONDA-34 pieza 2 (ORDEN-RONDA-35 pieza 2a): el PAC del wizard,
   * resuelto para los documentos. Queda {numero, justificacion, proceso}, donde
   * `proceso` es el del PAC (o null si no está autorizado). Si no hay número
   * elegido, o el número no está en el PAC, no hay pac: el documento sale como
   * siempre. Ya no lleva el preventivo en dólares escrito a mano: la moneda sale
   * del proceso y el preventivo, de los valores de referencia.
   */
  function pacDelWizard(datosWizard) {
    var identificacion = datosWizard && typeof datosWizard.identificacion === 'object'
      ? datosWizard.identificacion : {};
    var pac = identificacion.pac;
    if (!pac || typeof pac !== 'object') {
      return null;
    }
    var numero = pac.numero === undefined || pac.numero === null ? '' : String(pac.numero);
    if (numero === '') {
      return null;
    }
    var resultado = {
      numero: numero,
      justificacion: typeof pac.justificacion === 'string' ? pac.justificacion : '',
      proceso: null
    };
    // ORDEN-RONDA-37 pieza 2: las causas que cubría la justificación viajan con
    // el PAC (es lo que el formulario guardó y lo que la exportación escribe),
    // para que al reimportar se sepa si la justificación sigue al día.
    if (Array.isArray(pac.causas)) {
      resultado.causas = pac.causas;
    }
    // ORDEN-RONDA-38 pieza 1: el proceso contra el que se escribió la
    // justificación viaja con el PAC, por la misma razón: al reimportar, cambiar
    // de proceso pide revisarla.
    if (typeof pac.procesoJustificado === 'string') {
      resultado.procesoJustificado = pac.procesoJustificado;
    }
    if (numero !== 'no-autorizado') {
      resultado.proceso = SGC.core.validacion.procesoDelPac(numero);
      if (resultado.proceso === null) {
        return null;
      }
    }
    return resultado;
  }

  // ORDEN-RONDA-35 pieza 2a: la moneda del proceso elegido en el wizard. Manda
  // el proceso del PAC; sin proceso (o con "No autorizado") es ARS. El bloque de
  // valores de referencia y el PAC la comparten, para no decir "USD" en un lado
  // y "$" en el otro.
  function monedaDe(datosWizard) {
    var identificacion = datosWizard && typeof datosWizard.identificacion === 'object'
      ? datosWizard.identificacion : {};
    var pac = identificacion.pac;
    var numero = pac && pac.numero !== undefined && pac.numero !== null ? pac.numero : '';
    return SGC.core.validacion.monedaDelProceso(numero);
  }

  // ORDEN-RONDA-38 pieza 2: la modalidad de compra del wizard, normalizada a
  // 'oca', 'comun' o '' (sin elegir). Es del generador (ADR-044).
  function modalidadDe(datosWizard) {
    var identificacion = datosWizard && typeof datosWizard.identificacion === 'object'
      ? datosWizard.identificacion : {};
    if (identificacion.modalidad === 'oca') {
      return 'oca';
    }
    if (identificacion.modalidad === 'comun') {
      return 'comun';
    }
    return '';
  }

  function justificacionOcaDe(datosWizard) {
    var fundamentacion = datosWizard && typeof datosWizard.fundamentacion === 'object'
      ? datosWizard.fundamentacion : {};
    return typeof fundamentacion.ocaJustificacion === 'string'
      ? fundamentacion.ocaJustificacion.trim() : '';
  }

  /*
   * ORDEN-RONDA-36 pieza 1: lo que falta para exportar por el PAC (y por lo
   * tanto lo que frena "Imprimir" y "Exportar"). Las causas —fuera del PAC,
   * año, trimestre y monto— y sus palabras viven en el núcleo
   * (core/validacion.js causasDelPac), que es la MISMA cuenta que decide la
   * visibilidad y la obligación del campo en Fundamentación. Acá sólo se le
   * pasa la identificación del expediente y sus renglones.
   */
  function identificacionDelPac(expediente) {
    var datos = expediente && expediente.datos ? expediente.datos : {};
    var identificacion = datos.identificacion && typeof datos.identificacion === 'object'
      ? datos.identificacion : {};
    return {
      anio: datos.anio,
      trimestre: identificacion.trimestre,
      pac: datos.pac
    };
  }

  function itemsDelPac(expediente) {
    var pac = expediente && expediente.datos ? expediente.datos.pac : null;
    if (!pac) {
      return [];
    }
    var causas = SGC.core.validacion.causasDelPac(
      identificacionDelPac(expediente), expediente.renglones || []);
    var items = causas.items.slice();
    // ORDEN-RONDA-37 pieza 2: si la causa cambió desde que se escribió la
    // justificación, hay que revisarla antes de imprimir y de exportar. Es la
    // misma cuenta que frena "Siguiente" en Fundamentación (views/pasos.js).
    if (causas.revisar) {
      items.push('revisar la justificación del PAC: cambiaron las causas');
    }
    return items;
  }

  // ORDEN-RONDA-37 pieza 2: la justificación del PAC quedó desactualizada
  // (hay causa y las claves no son las que se guardaron). Mira la misma cuenta
  // que itemsDelPac, sobre el expediente que se acaba de componer.
  function revisionPacPendiente(expediente) {
    if (!expediente || !expediente.datos || !expediente.datos.pac) {
      return false;
    }
    return SGC.core.validacion.causasDelPac(
      identificacionDelPac(expediente), expediente.renglones || []).revisar === true;
  }

  // ORDEN-RONDA-38 pieza 2b: con la modalidad "orden de compra abierta", el
  // requerimiento no sale sin la justificación de la OCA ni sin la cantidad
  // máxima de cada renglón. El expediente lleva la marca `requerimiento.oca` y
  // la justificación (expedienteLocal); acá se dice, con las mismas palabras de
  // la exportación, qué falta. Sin OCA no hay nada que frenar.
  function itemsOca(expediente) {
    var datos = expediente && expediente.datos ? expediente.datos : {};
    var rq = datos.requerimiento;
    if (!rq || rq.oca !== true) {
      return [];
    }
    var items = [];
    if (ocaJustificacionFaltante(expediente)) {
      items.push('justificar la modalidad orden de compra abierta');
    }
    var renglones = Array.isArray(expediente.renglones) ? expediente.renglones : [];
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      if (r && (r.cantidadMaxima === undefined || r.cantidadMaxima === null)) {
        items.push('Renglón ' + (i + 1) +
          ': falta la cantidad máxima por Solicitud de Provisión');
      }
    }
    return items;
  }

  function ocaJustificacionFaltante(expediente) {
    var datos = expediente && expediente.datos ? expediente.datos : {};
    var rq = datos.requerimiento;
    return !!rq && rq.oca === true &&
      (typeof rq.ocaJustificacion !== 'string' || rq.ocaJustificacion.trim() === '');
  }

  /*
   * El expediente local. Misma forma que el del servidor:
   *   {estado, campos, entregables, renglones, datos}
   * donde `datos` es lo que leen los renders (renders/documento.js modelo) y
   * `campos`/`entregables` lo que mira la validación del núcleo.
   *
   * ORDEN-RONDA-34 pieza 1: el expediente local no lleva `expedienteId`: el
   * identificador interno no se muestra en ningún documento (el Jefe, 13/10), y
   * los renders ya caen en '—' cuando no está. En `datos.identificacion` salen
   * el lugar (una sola constante), la vigencia (el último día del trimestre en
   * dd/mm/aaaa), la finalidad (la misma justificación) y el trimestre elegido.
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
    var trimestre = trimestreElegido(datosWizard);
    // ORDEN-RONDA-36 pieza 2: el requerimiento del generador ya no lleva
    // "Lugar" (la constante salió de config/aplicacion.json). El lugar de
    // entrega que escribe la persona queda sólo en la EETT. La aplicación con
    // servidor no cambia: su `identificacion.lugar` sigue en sus datos.
    var lugar = datosWizard && typeof datosWizard.identificacion === 'object'
      ? datosWizard.identificacion : {};
    datosIniciales.identificacion = {
      lugarEntrega: typeof lugar.lugarEntrega === 'string' ? lugar.lugarEntrega.trim() : '',
      vigencia: ultimoDiaDelTrimestre(datosIniciales.anio, trimestre),
      finalidad: datosIniciales.campos.justificacion || '',
      trimestre: trimestre
    };
    // ORDEN-RONDA-34 pieza 2: el proceso del PAC (o su ausencia) viaja en el
    // expediente para el documento impreso y para el JSON. Sin pac elegido,
    // queda null y los documentos salen igual que antes.
    datosIniciales.pac = pacDelWizard(datosWizard);
    // ORDEN-RONDA-36 pieza 1e: lo escrito se conserva en el formulario, pero
    // sólo viaja —y sólo se imprime— mientras haya una causa. Sin causa, el
    // documento sale sin "Justificación del PAC" aunque la persona haya escrito
    // algo (la causa pudo desaparecer al corregir el trimestre, el año o los
    // valores). La cuenta es la del núcleo, la misma que la de la pantalla.
    if (datosIniciales.pac) {
      var causasPac = SGC.core.validacion.causasDelPac({
        anio: datosIniciales.anio,
        trimestre: trimestre,
        pac: datosIniciales.pac
      }, renglones);
      if (!causasPac.requerida) {
        datosIniciales.pac.justificacion = '';
      }
    }
    // ORDEN-RONDA-35 pieza 2a: la moneda del proceso viaja en el expediente,
    // resuelta una sola vez, para que el documento impreso y el JSON digan lo
    // mismo. Sin procesos en dólares (o sin PAC) es ARS, como siempre.
    datosIniciales.moneda = monedaDe(datosWizard);
    // ORDEN-RONDA-38 pieza 2: la modalidad de compra viaja en el expediente.
    // Con OCA, la justificación se imprime —el render la mira en
    // `datos.requerimiento`— y la marca `requerimiento.oca` enciende el bloque
    // de la OCA (la tabla de máximos y la nota de la causal). Sin OCA no se
    // toca `requerimiento`, así que el documento sale como siempre.
    var modalidad = modalidadDe(datosWizard);
    datosIniciales.modalidad = modalidad;
    datosIniciales.ocaJustificacion = modalidad === 'oca' ? justificacionOcaDe(datosWizard) : '';
    if (modalidad === 'oca') {
      datosIniciales.requerimiento = {
        oca: true,
        ocaJustificacion: justificacionOcaDe(datosWizard)
      };
    }
    var resultado = {
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
    // ORDEN-RONDA-33 pieza 2: un renglón "por buscar" no tiene ítem elegido, y
    // la exportación final no lo acepta. El núcleo ya lo marca por sus valores,
    // pero el motivo tiene que decir también que falta elegir el ítem.
    var renglones = Array.isArray(expediente.renglones) ? expediente.renglones : [];
    for (var i = 0; i < renglones.length; i++) {
      if (renglones[i] && renglones[i].porBuscar === true) {
        r.valido = false;
        items.push('elegir el ítem del catálogo en los renglones por buscar');
        break;
      }
    }
    // ORDEN-RONDA-34 pieza 2c: el PAC también frena la exportación, con su
    // motivo. El avance se guarda igual (exportarAvance no mira esta revisión).
    var itemsPac = itemsDelPac(expediente);
    if (itemsPac.length > 0) {
      r.valido = false;
      items = items.concat(itemsPac);
      // ORDEN-RONDA-36 pieza 1d: la justificación del PAC es del paso
      // Fundamentación; marcar el campo hace que el paso quede con "· falta"
      // (generador.js pasosPendientes) y que Imprimir frene junto con Exportar.
      if (r.faltantes.campos.indexOf('pacJustificacion') === -1) {
        r.faltantes.campos.push('pacJustificacion');
      }
    }
    // ORDEN-RONDA-38 pieza 2b: con OCA, la justificación de la OCA y la cantidad
    // máxima de cada renglón frenan la exportación, con su motivo.
    var itemsOcaPendientes = itemsOca(expediente);
    if (itemsOcaPendientes.length > 0) {
      r.valido = false;
      items = items.concat(itemsOcaPendientes);
      if (ocaJustificacionFaltante(expediente) &&
          r.faltantes.campos.indexOf('ocaJustificacion') === -1) {
        r.faltantes.campos.push('ocaJustificacion');
      }
    }
    // ORDEN-RONDA-35 pieza 1: con la marca del generador, la Identificación
    // frena la exportación igual que frena "Siguiente": el trimestre, el proceso
    // del PAC y el lugar de entrega se piden aunque el archivo importado no los
    // traiga (un exportado de la 33, por ejemplo). Sin la marca, nada cambia.
    if (SGC.core.validacion.exigirIdentificacionCompleta &&
        SGC.core.validacion.exigirIdentificacionCompleta()) {
      var identificacion = SGC.views.pasos.validarPaso('identificacion', datos || {});
      if (!identificacion.valido) {
        r.valido = false;
        for (var k = 0; k < identificacion.errores.length; k++) {
          var err = identificacion.errores[k];
          items.push(err.mensaje);
          if (err.campo && r.faltantes.campos.indexOf(err.campo) === -1) {
            r.faltantes.campos.push(err.campo);
          }
        }
      }
    }
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
    // ORDEN-RONDA-35 pieza 2d: Imprimir frena también cuando el PAC tiene algo
    // pendiente (el preventivo que supera el monto del proceso, sin
    // justificación). Antes sólo miraba los campos y los renglones, así que
    // dejaba imprimir un papel que el botón Exportar no dejaba exportar.
    var itemsPac = itemsDelPac(info.expediente);
    // ORDEN-RONDA-38 pieza 2b: con OCA, Imprimir frena con el mismo motivo que
    // Exportar (la justificación de la OCA y las cantidades máximas).
    var itemsOcaPendientes = itemsOca(info.expediente);
    if (info.revision.faltantes.campos.length > 0 ||
        (info.revision.faltantes.renglones && info.revision.faltantes.renglones.length > 0) ||
        itemsPac.length > 0 ||
        itemsOcaPendientes.length > 0) {
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
    // ORDEN-RONDA-37 pieza 2: si cambiaron las causas desde que se escribió la
    // justificación, el documento compuesto ya no puede salir —Imprimir y
    // Exportar están frenados—, así que se descarta: si quedara a la vista,
    // mostraría una justificación vieja. Vuelve a componerse al apretar
    // "Imprimir" con la justificación revisada.
    if (revisionPacPendiente(info.expediente)) {
      SGC.renders.documento.limpiar(estado.dom.impresion);
    }
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
    // ORDEN-RONDA-35 pieza 2a: la moneda del proceso elegido ahora, para que el
    // bloque de valores de referencia hable en la misma moneda que el PAC.
    monedaActual: function () {
      return monedaDe(estado.datosActuales || {});
    },
    // ORDEN-RONDA-38 pieza 2: la modalidad de compra elegida ahora, para que el
    // bloque de valores de referencia encienda las cantidades de la OCA.
    modalidadActual: function () {
      return modalidadDe(estado.datosActuales || {});
    },
    revision: function () {
      return revision(estado.datosActuales || {});
    },
    imprimirSolicitado: function () {
      return estado.generados;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
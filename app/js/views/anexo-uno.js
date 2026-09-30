/*
 * anexo-uno.js
 * ORDEN-RONDA-11 §3.1. Formulario del ANEXO 1 para el rol abastecimiento en
 * el estado ANALISIS_SCo. Las catorce secciones del análisis de Abastecimiento;
 * §9–§12 son condicionales según el tipo de contratación.
 *
 * Precarga desde el requerimiento (§1, §4, §7) y permite guardar en
 * expediente.datos.anexo1 para que renders/anexo-1.js lo componga.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('anexo-uno.js requiere que namespaces.js se cargue primero');
  }

  var ESTADO_OBJETIVO = 'ANALISIS_SCo';
  var TRIMESTRES = ['', '1°', '2°', '3°', '4°'];

  // ORDEN-RONDA-27 pieza 5: el ANEXO I es de la SCo, no del expediente. Cuando
  // el expediente tiene SCo, los datos se leen y se guardan en el REGISTRO de la
  // SCo (contra la versión del registro), y los renglones que se muestran son los
  // consolidados de todos los miembros con el desglose por debajo. Sin SCo, el
  // ANEXO I sigue siendo del expediente, como antes de esta ronda.
  var estado = {
    repo: null,
    operador: null,
    dom: {},
    expedienteId: null,
    version: null,
    // El expediente que se está mostrando, para poder colgarle el registro de la
    // SCo a los datos que lee la plantilla del documento (pieza 5).
    expedienteEnPantalla: null,
    sco: {
      numero: null,
      version: null,
      registro: null,
      cargando: false,
      // La carga en vuelo del registro. El guardado la espera en vez de
      // pedirle al operador que vuelva a hacer clic.
      carga: null
    }
  };

  function qs(raiz, sel) { return raiz.querySelector(sel); }

  // ADR-029 aplicado al DOM (ORDEN-RONDA-20 §1.3 · H3): cuando la vista busca
  // un nodo por identificador y no lo encuentra, falla de forma visible en
  // vez de escribir sobre null en silencio.
  function requerir(raiz, id) {
    var el = qs(raiz, id);
    if (!el) {
      throw new Error('anexo-uno: no se encuentra el nodo "' + id + '" (ADR-029: lo que falta, falla ruidosamente)');
    }
    return el;
  }

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }

  function datosDe(exp) {
    return (exp && typeof exp.datos === 'object' && exp.datos) || exp || {};
  }

  function expedienteActual() {
    if (!SGC.views.expediente || typeof SGC.views.expediente.obtener !== 'function') {
      return null;
    }
    var a = SGC.views.expediente.obtener();
    return a && a.expediente ? a.expediente : null;
  }

  function contextoActual() {
    var op = estado.operador || {};
    return {
      timestamp: new Date().toISOString(),
      email: op.email || 'anonimo',
      rol: op.roles && op.roles[0],
      equipo: op.equipo || 'PC-NAVEGADOR'
    };
  }

  function avisar(m, err) {
    if (!estado.dom.msj) return;
    estado.dom.msj.textContent = m;
    estado.dom.msj.className = err ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.msj.hidden = false;
  }

  function valorTexto(raiz, id) {
    return requerir(raiz, id).value.trim();
  }

  function fijarValor(raiz, id, v) {
    requerir(raiz, id).value = v || '';
  }

  // Empresas consultadas: input con una empresa por línea
  function leerEmpresas(raiz) {
    var txt = valorTexto(raiz, '#sgc-anexo1-empresas');
    if (!txt) return [];
    return txt.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  }

  function fijarEmpresas(raiz, arr) {
    requerir(raiz, '#sgc-anexo1-empresas').value = Array.isArray(arr) ? arr.join('\n') : '';
  }

  // Resumen de renglones para §7
  function resumenRenglones(expediente) {
    var datos = datosDe(expediente);
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    if (renglones.length === 0) return '';
    var lineas = [];
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      var desc = str(r.descripcion || r.detalle || r.nombre || '');
      var cant = r.cantidad;
      var um = str(r.unidadMedida || r.unidad || '');
      lineas.push((i + 1) + '. ' + desc + (cant ? ' (' + cant + (um ? ' ' + um : '') + ')' : ''));
    }
    return lineas.join('\n');
  }

  // Precio de referencia derivado de preventivoContratacion (§2.3).
  function precioDerivado(expediente) {
    var datos = datosDe(expediente);
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    if (renglones.length === 0) return { total: null, valido: false, empresas: [] };
    var req = SGC.core.requerimiento;
    var prev = req.preventivoContratacion(renglones);
    var empresas = [];
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      var vals = Array.isArray(r.valoresReferencia) ? r.valoresReferencia : [];
      for (var j = 0; j < vals.length; j++) {
        var v = vals[j];
        if (v && v.empresa && empresas.indexOf(v.empresa) === -1) {
          empresas.push(v.empresa);
        }
      }
    }
    return { total: prev.total, valido: prev.valido, empresas: empresas };
  }

  // Formatea un monto numérico como "$ 1.234.567,89"
  function formatearMonto(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    var texto = n.toFixed(2);
    var partes = texto.split('.');
    return '$ ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
  }

  // ---------------------------------------------------------------------------
  // Precarga desde el requerimiento (SGC.core.requerimiento.requerimientoDe)
  // ---------------------------------------------------------------------------
  function precarga(expediente) {
    var datos = datosDe(expediente);
    var info = SGC.core.requerimiento.requerimientoDe(expediente);
    var rq = info.requerimiento || {};
    var solicitante = datos.solicitante || {};

    var objeto = rq.objeto || str(expediente.titulo) || str(datos.titulo) || '';
    var justificacion = rq.justificacionNecesidad || str(datos.fundamentacion && datos.fundamentacion.justificacion) || '';
    var unidad = rq.unidadSolicitante || str(solicitante.unidad || solicitante.dependencia) || '';

    var prev = precioDerivado(expediente);

    return {
      objeto: objeto,
      justificacion: justificacion,
      unidad: unidad,
      responsables: [
        str(solicitante.responsable || rq.responsable || ''),
        str(solicitante.usuarioGde || rq.usuarioGde || '')
      ],
      direccion: str(solicitante.direccion || rq.direccion || ''),
      telefono: str(solicitante.telefono || rq.telefono || ''),
      correo: str(solicitante.correo || rq.correo || ''),
      entrega: str(solicitante.lugarEntrega || rq.lugarEntrega || ''),
      facturacion: str(solicitante.lugarFacturacion || rq.lugarFacturacion || ''),
      renglones: resumenRenglones(expediente),
      precioReferenciaCalculado: prev.valido && prev.total !== null ? formatearMonto(prev.total) : '',
      empresasCalculadas: prev.empresas
    };
  }

  // ---------------------------------------------------------------------------
  // Carga de valores previos guardados en expediente.datos.anexo1
  // ---------------------------------------------------------------------------
  function valoresGuardados(expediente) {
    var datos = datosDe(expediente);
    var a = (datos.anexo1 && typeof datos.anexo1 === 'object') ? datos.anexo1 : {};
    return a;
  }

  // ---------------------------------------------------------------------------
  // montar: wiring del DOM
  // ---------------------------------------------------------------------------
  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.msj = requerir(raiz, '#sgc-anexo1-msj');
    // Bloque de SCo de la pieza 5. Se busca con `qs` y no con `requerir` a
    // propósito: es opcional, y una vista más nueva sobre un HTML más viejo no
    // debe romperse por un nodo que no está.
    estado.dom.sco = qs(raiz, '#sgc-anexo1-sco');

    var trimSel = requerir(raiz, '#sgc-anexo1-pac-trimestre');
    for (var i = 0; i < TRIMESTRES.length; i++) {
      var opt = document.createElement('option');
      opt.value = TRIMESTRES[i];
      opt.textContent = TRIMESTRES[i] || '— Seleccionar —';
      trimSel.appendChild(opt);
    }

    var chkPac = requerir(raiz, '#sgc-anexo1-pac-previsto');
    var numOrden = requerir(raiz, '#sgc-anexo1-pac-orden');
    var trimestre = requerir(raiz, '#sgc-anexo1-pac-trimestre');
    function togglePac() {
      var activo = chkPac.checked;
      numOrden.disabled = !activo;
      trimestre.disabled = !activo;
      if (!activo) {
        numOrden.value = '';
        trimestre.value = '';
      }
    }
    chkPac.addEventListener('change', togglePac);
    togglePac();

    requerir(raiz, '#sgc-anexo1-guardar').addEventListener('click', guardar);
  }

  // ---------------------------------------------------------------------------
  // actualizar: show/hide + precarga
  // ---------------------------------------------------------------------------
  // ORDEN-RONDA-27 pieza 5: el número de SCo del expediente, o null.
  //
  // Va por el lector compartido `SGC.adapters.repo.numeroSCoDe`: el número vive
  // en `campos.numeroSCo` (ORDEN-RONDA-26 §P4, forma plana del expediente) y no
  // en `datos.numeroSCo`, así que buscarlo sólo en `datos` hacía que esta vista no
  // viera nunca la SCo. El plan B cubre un repo sin esa función.
  function numeroSCoDe(expediente) {
    if (!expediente) {
      return null;
    }
    if (SGC.adapters && SGC.adapters.repo &&
        typeof SGC.adapters.repo.numeroSCoDe === 'function') {
      var compartido = SGC.adapters.repo.numeroSCoDe(expediente);
      return typeof compartido === 'string' && compartido.trim() !== ''
        ? compartido.trim() : null;
    }
    var datos = datosDe(expediente);
    var fuentes = [
      datos.numeroSCo,
      expediente.campos && expediente.campos.numeroSCo,
      datos.campos && datos.campos.numeroSCo
    ];
    for (var i = 0; i < fuentes.length; i++) {
      if (typeof fuentes[i] === 'string' && fuentes[i].trim() !== '') {
        return fuentes[i].trim();
      }
    }
    return null;
  }

  function pintarRenglonesSco(registro) {
    var bloque = estado.dom.sco;
    var raiz = estado.dom.raiz;
    if (!bloque || !raiz) return;
    // El cuerpo de la tabla se busca por su propio identificador y no por
    // `#tabla tbody`: los nodos que la vista usa tienen nombre (ADR-029), y
    // depender de la estructura de la tabla lo haría más frágil de lo que hace
    // falta.
    var cuerpo = qs(raiz, '#sgc-anexo1-sco-cuerpo');
    if (cuerpo) {
      // Nodos DOM, nunca innerHTML (ORDEN-RONDA-20 §1.3 / ADR-029). Se vacía
      // siempre, también cuando no hay registro: las filas que quedan son el
      // consolidado de otra SCo y no pueden quedarse en la tabla.
      while (cuerpo.children.length > 0) {
        cuerpo.removeChild(cuerpo.children[0]);
      }
    }
    if (!registro) {
      bloque.hidden = true;
      return;
    }
    bloque.hidden = false;
    if (cuerpo) {
      var renglones = Array.isArray(registro.renglones) ? registro.renglones : [];
      for (var i = 0; i < renglones.length; i++) {
        var r = renglones[i];
        var fila = document.createElement('tr');
        var celdas = [
          String(r.codigo === undefined ? '' : r.codigo),
          String(r.descripcion === undefined ? '' : r.descripcion),
          String(r.cantidad === undefined ? '' : r.cantidad),
          String(r.unidad === undefined ? '' : r.unidad),
          desgloseDe(r)
        ];
        for (var c = 0; c < celdas.length; c++) {
          var td = document.createElement('td');
          td.textContent = celdas[c];
          fila.appendChild(td);
        }
        cuerpo.appendChild(fila);
      }
    }
    var cap = raiz.querySelector('#sgc-anexo1-sco-capitulo');
    if (cap) {
      var miembros = Array.isArray(registro.expedientes) ? registro.expedientes : [];
      cap.textContent = 'SCo ' + (registro.numeroSCo || '') + ' · ' + miembros.length +
        ' expediente(s): ' + miembros.join(', ');
    }
    var nota = raiz.querySelector('#sgc-anexo1-sco-nota');
    if (nota) {
      var propio = estado.expedienteId;
      if (registro.anexo1Origen === 'sco') {
        nota.textContent = 'Este ANEXO I es el de toda la SCo ' + registro.numeroSCo +
          '. Se edita una sola vez y vale para los ' + (registro.expedientes || []).length +
          ' requerimientos, incluido el ' + propio + '.';
      } else if (registro.anexo1Origen === 'migracion') {
        nota.textContent = 'La SCo ' + registro.numeroSCo + ' todavía no tiene ANEXO I propio. ' +
          'Se muestra como punto de partida el del expediente ' +
          (registro.anexo1PuntoDePartida || '') +
          '; al guardar queda en el registro de la SCo y vale para todos.';
      } else {
        nota.textContent = 'Este ANEXO I es el de toda la SCo ' + registro.numeroSCo +
          '. Los renglones de abajo están sumados entre los ' +
          (registro.expedientes || []).length + ' requerimientos de la SCo.';
      }
    }
  }

  // El registro de la SCo se cuelga del `datos` del expediente en pantalla
  // porque `renders/anexo-1.js` recibe el expediente, no la vista. Con `null` se
  // despeja, para que al cambiar de expediente no quede el ANEXO I de la SCo
  // anterior pegado al nuevo.
  //
  // Se despeja SIEMPRE del `expedienteEnPantalla` que haya en este momento, que
  // es el viejo al cambiar de expediente: por eso los llamadores la llaman
  // ANTES de soltar el puntero. Si se invirtiera el orden, `colgar` no tendría
  // contra qué limpiar y el `anexo1Sco` de la SCo anterior sobreviviría al
  // cambio (y hasta aparecería impreso en el expediente viejo).
  function colgarRegistroEnPlantilla(registro) {
    if (estado.expedienteEnPantalla) {
      var datos = datosDe(estado.expedienteEnPantalla);
      if (datos && typeof datos === 'object' && datos.anexo1Sco) {
        delete datos.anexo1Sco;
      }
    }
    if (registro) {
      var datosNuevo = datosDe(estado.expedienteEnPantalla);
      if (datosNuevo && typeof datosNuevo === 'object') {
        datosNuevo.anexo1Sco = {
          numeroSCo: registro.numeroSCo,
          anexo1: registro.anexo1 || null,
          renglones: registro.renglones || []
        };
      }
    }
    recomponerDocumento();
  }

  // El documento del ANEXO I se compone una vez, de forma síncrona, en
  // `views/expediente.js`; para entonces el registro de la SCo puede no haber
  // llegado de la red. Cuando llega, se pide a esa vista —que es la dueña del
  // nodo del documento— que lo vuelva a componer, para que salga el de la SCo y
  // no el del expediente. Se comprueba que siga siendo este el abierto: entre
  // medio el usuario pudo cambiar.
  function recomponerDocumento() {
    var expediente = estado.expedienteEnPantalla;
    if (!expediente) return;
    if (SGC.core.utils.idEstado(expediente) !== ESTADO_OBJETIVO) return;
    if (!SGC.views.expediente ||
        typeof SGC.views.expediente.recomponerDocumento !== 'function') {
      return;
    }
    SGC.views.expediente.recomponerDocumento(expediente);
  }

  function desgloseDe(r) {
    var partes = Array.isArray(r.desglose) ? r.desglose : [];
    var textos = [];
    for (var i = 0; i < partes.length; i++) {
      textos.push(partes[i].expediente + ': ' + partes[i].cantidad);
    }
    return textos.join(' · ');
  }

  // El registro de la SCo del expediente, para leer sus renglones consolidados y
  // saber contra qué versión del registro se guarda. Es una promesa porque la
  // pantalla no puede bloquear: primero se precarga con lo del expediente y, si
  // hay SCo, se completa con lo del registro.
  function cargarRegistroSco(numero, raiz) {
    if (!estado.repo || typeof estado.repo.leerSCo !== 'function') {
      return Promise.resolve(null);
    }
    estado.sco.cargando = true;
    // La promesa queda a la vista: si el operador guarda mientras esto vuela,
    // `guardar` la espera y guarda en cuanto llega, en vez de perder el clic.
    var pendiente = estado.repo.leerSCo(numero).then(function (registro) {
      estado.sco.cargando = false;
      // Si mientras tanto el usuario abrió otro expediente, lo que llegó es
      // de otro y no se pinta: se ignora. Lo mismo si el expediente que está
      // en pantalla ya no está en ANALISIS_SCo: su sección está oculta y así
      // se queda.
      if (!sigueEnPantallaElAnexoDe(numero)) {
        return null;
      }
      estado.sco.numero = numero;
      estado.sco.registro = registro;
      estado.sco.version = registro ? registro.version : null;
      // Pieza 5: se le pasa el registro a la plantilla del documento para que
      // imprima el ANEXO I de la SCo y los renglones consolidados, no los del
      // expediente. Se cuelga del `datos` del expediente, que es lo que recibe
      // `renders/anexo-1.js`, y se va con él.
      colgarRegistroEnPlantilla(registro);
      // El ANEXO I de la SCo manda sobre el del expediente que esté
      // mostrando: son el mismo formulario, pero el dato es de la SCo. Se
      // precargan TODOS los campos, no sólo tres, porque los que no vinieran
      // cargados seguirían mostrando los del expediente que se está viendo.
      // Si la SCo todavía no tiene ANEXO I, se deja lo que `actualizar`
      // precargó del expediente (el punto de partida legacy): vaciarlo sólo
      // perdería trabajo.
      if (registro && registro.anexo1) {
        aplicarCampos(raiz, registro.anexo1);
      }
      // El formulario estuvo oculto mientras llegaba el registro (en `actualizar`
      // no se muestra sin el dato de la SCo): ahora se muestra.
      raiz.hidden = false;
      pintarRenglonesSco(registro);
      return registro;
    }).catch(function () {
      estado.sco.cargando = false;
      // No se pudo leer el registro: el formulario no queda muerto en pantalla.
      // Se muestra con la precarga del expediente y, si se intenta guardar, el
      // guardado dice que no se pudo leer en vez de escribir contra nada.
      if (sigueEnPantallaElAnexoDe(numero)) {
        raiz.hidden = false;
      }
      return null;
    });
    estado.sco.carga = pendiente;
    return pendiente;
  }

  // ¿Este es todavía el ANEXO 1 que se está mostrando? Lo es cuando el
  // expediente en pantalla es el mismo, sigue en ANALISIS_SCo y su número de
  // SCo es el que se pidió.
  function sigueEnPantallaElAnexoDe(numero) {
    var exp = expedienteActual();
    return !!exp && numeroSCoDe(exp) === numero &&
      SGC.core.utils.idEstado(exp) === ESTADO_OBJETIVO && exp.archivado !== true;
  }

  function actualizar(expediente) {
    var visible = !!expediente &&
      SGC.core.utils.idEstado(expediente) === ESTADO_OBJETIVO &&
      expediente.archivado !== true;
    var raiz = estado.dom.raiz;
    if (!raiz) return;

    if (!visible) {
      raiz.hidden = true;
      // Primero se despeja el registro del expediente que estaba en pantalla y
      // después se sueltan los punteros: al revés, no queda contra qué limpiar.
      colgarRegistroEnPlantilla(null);
      pintarRenglonesSco(null);
      estado.expedienteId = null;
      estado.expedienteEnPantalla = null;
      estado.sco.numero = null;
      estado.sco.registro = null;
      estado.sco.version = null;
      estado.sco.cargando = false;
      return;
    }
    raiz.hidden = false;

    var actual = SGC.views.expediente.obtener();
    // Si cambió el expediente en pantalla, el registro de la SCo cacheado es del
    // anterior: se suelta para no pintar ni guardar contra el registro de otra
    // SCo. `colgarRegistroEnPlantilla(null)` despeja el `anexo1Sco` del que sale,
    // y lo hace con `expedienteEnPantalla` todavía apuntando al viejo.
    if (estado.expedienteEnPantalla && estado.expedienteEnPantalla !== expediente) {
      colgarRegistroEnPlantilla(null);
      // Los renglones que se veían eran los sumados de la SCo anterior: si se
      // dejaran, la pantalla mostraría (y se podría imprimir) el consolidado de
      // otra SCo. El bloque se oculta hasta que llegue el registro nuevo.
      pintarRenglonesSco(null);
      estado.sco.numero = null;
      estado.sco.registro = null;
      estado.sco.version = null;
    }
    estado.expedienteId = expediente.expedienteId || expediente.id;
    estado.version = actual.version;
    estado.expedienteEnPantalla = expediente;

    var pre = precarga(expediente);
    var numeroSco = numeroSCoDe(expediente);
    if (!numeroSco) {
      // Sin SCo: el bloque nuevo no se muestra y el ANEXO I es del expediente.
      estado.sco.numero = null;
      estado.sco.registro = null;
      estado.sco.version = null;
      pintarRenglonesSco(null);
      colgarRegistroEnPlantilla(null);
    }
    // ORDEN-RONDA-27 pieza 5: con SCo el ANEXO I que vale es el del REGISTRO.
    // Mientras el registro no llega no se muestra el formulario: mostrarlo con
    // lo del expediente sería mostrar un dato que ya no es el de la SCo (y que se
    // corregiría solo un instante después, debajo de los ojos del operador). Se
    // muestra cuando llega, con lo que trajo el registro.
    var esperandoRegistro = !!numeroSco &&
      (!estado.sco.registro || estado.sco.numero !== numeroSco);
    if (esperandoRegistro) {
      raiz.hidden = true;
    }
    var guard = numeroSco && estado.sco.registro && estado.sco.registro.anexo1
      ? estado.sco.registro.anexo1
      : valoresGuardados(expediente);
    aplicarCampos(raiz, guard, pre);

    // Con SCo, el registro se pide después de precargar: mientras llega se ve
    // lo del expediente, y al llegar se corrige con lo de la SCo.
    if (numeroSco && (!estado.sco.registro || estado.sco.numero !== numeroSco)) {
      cargarRegistroSco(numeroSco, raiz);
    } else if (numeroSco) {
      pintarRenglonesSco(estado.sco.registro);
    }
  }

  // Vuelca un ANEXO I guardado en el formulario. `pre` es la precarga del
  // expediente, de la que se usa lo que el ANEXO I guardado no trae; con `pre`
  // ausente (llegada tardía del registro de la SCo) manda lo guardado y lo que
  // no vine se deja vacío, porque es el dato de la SCo el que manda.
  function aplicarCampos(raiz, guard, pre) {
    guard = guard || {};
    pre = pre || {};
    var resp = pre.responsables || ['', ''];
    fijarValor(raiz, '#sgc-anexo1-objeto', guard.objeto || pre.objeto || '');
    fijarValor(raiz, '#sgc-anexo1-justificacion', guard.justificacion || pre.justificacion || '');
    fijarValor(raiz, '#sgc-anexo1-unidad-resp', guard.unidadResponsable || resp[0] || '');
    fijarValor(raiz, '#sgc-anexo1-usuario-gde', guard.usuarioGde || resp[1] || '');
    fijarValor(raiz, '#sgc-anexo1-unidad-dir', guard.unidadDireccion || pre.direccion || '');
    fijarValor(raiz, '#sgc-anexo1-unidad-tel', guard.unidadTelefono || pre.telefono || '');
    fijarValor(raiz, '#sgc-anexo1-unidad-correo', guard.unidadCorreo || pre.correo || '');
    fijarValor(raiz, '#sgc-anexo1-lugar-entrega', guard.lugarEntrega || pre.entrega || '');
    fijarValor(raiz, '#sgc-anexo1-lugar-fact', guard.lugarFacturacion || pre.facturacion || '');

    // §2.3: empresas y precio derivados de los presupuestos/renglones.
    // Si el guardado tiene valores manuales, se usan esos; si no, los calculados.
    fijarEmpresas(raiz, guard.empresasConsultadas && guard.empresasConsultadas.length > 0
      ? guard.empresasConsultadas : (pre.empresasCalculadas || []));
    fijarValor(raiz, '#sgc-anexo1-precio-ref', guard.precioReferencia || pre.precioReferenciaCalculado || '');
    fijarValor(raiz, '#sgc-anexo1-moneda-ext', guard.monedaExtranjera || '');

    var chkPac = requerir(raiz, '#sgc-anexo1-pac-previsto');
    chkPac.checked = guard.pacPrevisto === true || guard.pacPrevisto === 'Si';
    fijarValor(raiz, '#sgc-anexo1-pac-orden', guard.pacNumeroOrden || '');
    fijarValor(raiz, '#sgc-anexo1-pac-trimestre', guard.pacTrimestre || '');

    fijarValor(raiz, '#sgc-anexo1-comision', guard.comisionRecepcion || '');
    fijarValor(raiz, '#sgc-anexo1-personal', guard.personalTecnico || '');
    fijarValor(raiz, '#sgc-anexo1-visita', guard.visitaMuestra || '');
    fijarValor(raiz, '#sgc-anexo1-interadmin', guard.interadministrativa || '');
    fijarValor(raiz, '#sgc-anexo1-bienes-uso', guard.bienesUso || '');
    fijarValor(raiz, '#sgc-anexo1-hw-sw', guard.hardwareSoftware || '');
    fijarValor(raiz, '#sgc-anexo1-reparaciones', guard.reparacionesInfra || '');
    fijarValor(raiz, '#sgc-anexo1-doc-obligatoria', guard.documentacionObligatoria || '');
    fijarValor(raiz, '#sgc-anexo1-criterio', guard.criterioEvaluacion || '');

    // El requisito mínimo sólo cae al resumen de renglones del expediente si
    // el ANEXO I guardado no trae el suyo.
    fijarValor(raiz, '#sgc-anexo1-requisitos', guard.requisitosMinimos || pre.renglones || '');

    var numOrd = requerir(raiz, '#sgc-anexo1-pac-orden');
    var triSel = requerir(raiz, '#sgc-anexo1-pac-trimestre');
    numOrd.disabled = !chkPac.checked;
    triSel.disabled = !chkPac.checked;
  }

  // ---------------------------------------------------------------------------
  // leer
  // ---------------------------------------------------------------------------
  function leer() {
    var raiz = estado.dom.raiz;
    if (!raiz) return {};
    var chkPac = requerir(raiz, '#sgc-anexo1-pac-previsto');
    return {
      objeto: valorTexto(raiz, '#sgc-anexo1-objeto'),
      justificacion: valorTexto(raiz, '#sgc-anexo1-justificacion'),
      empresasConsultadas: leerEmpresas(raiz),
      precioReferencia: valorTexto(raiz, '#sgc-anexo1-precio-ref'),
      monedaExtranjera: valorTexto(raiz, '#sgc-anexo1-moneda-ext'),
      pacPrevisto: chkPac && chkPac.checked,
      pacNumeroOrden: valorTexto(raiz, '#sgc-anexo1-pac-orden'),
      pacTrimestre: valorTexto(raiz, '#sgc-anexo1-pac-trimestre'),
      unidadResponsable: valorTexto(raiz, '#sgc-anexo1-unidad-resp'),
      usuarioGde: valorTexto(raiz, '#sgc-anexo1-usuario-gde'),
      unidadDireccion: valorTexto(raiz, '#sgc-anexo1-unidad-dir'),
      unidadTelefono: valorTexto(raiz, '#sgc-anexo1-unidad-tel'),
      unidadCorreo: valorTexto(raiz, '#sgc-anexo1-unidad-correo'),
      lugarEntrega: valorTexto(raiz, '#sgc-anexo1-lugar-entrega'),
      lugarFacturacion: valorTexto(raiz, '#sgc-anexo1-lugar-fact'),
      comisionRecepcion: valorTexto(raiz, '#sgc-anexo1-comision'),
      personalTecnico: valorTexto(raiz, '#sgc-anexo1-personal'),
      requisitosMinimos: valorTexto(raiz, '#sgc-anexo1-requisitos'),
      visitaMuestra: valorTexto(raiz, '#sgc-anexo1-visita'),
      interadministrativa: valorTexto(raiz, '#sgc-anexo1-interadmin'),
      bienesUso: valorTexto(raiz, '#sgc-anexo1-bienes-uso'),
      hardwareSoftware: valorTexto(raiz, '#sgc-anexo1-hw-sw'),
      reparacionesInfra: valorTexto(raiz, '#sgc-anexo1-reparaciones'),
      documentacionObligatoria: valorTexto(raiz, '#sgc-anexo1-doc-obligatoria'),
      criterioEvaluacion: valorTexto(raiz, '#sgc-anexo1-criterio')
    };
  }

  // ---------------------------------------------------------------------------
  // guardar
  // ---------------------------------------------------------------------------

  // El guardado contra el REGISTRO de la SCo, con la versión que se leyó de él.
  // Se separa de `guardar` porque, si el registro todavía está llegando, se
  // llama desde `guardarCuandoLlegueElRegistro` y no desde el clic del operador.
  function guardarContraRegistro(campos, numeroSco) {
    if (typeof estado.sco.version !== 'number') {
      avisar('No se pudo leer el registro de la SCo ' + numeroSco +
        '. No se guardó nada: vuelva a abrir el expediente.', true);
      return;
    }
    estado.repo.guardarAnexo1Sco(numeroSco, campos, estado.sco.version, contextoActual())
      .then(function (resp) {
        if (resp.conflicto) {
          var op = estado.operador || {};
          var esOtroOperador = !!resp.ultimoUsuario && resp.ultimoUsuario !== op.email;
          var texto = esOtroOperador
            ? 'El ANEXO I de la SCo ' + numeroSco + ' lo modificó otro operador'
            : 'El registro de la SCo ' + numeroSco + ' cambió después de que usted lo abrió ' +
              '(posiblemente en otra pestaña)';
          avisar(texto + ' (versión ' + resp.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!resp.ok) {
          avisar('No se pudo guardar el ANEXO 1 de la SCo: ' +
            (resp.error || 'error desconocido'), true);
          return;
        }
        estado.sco.version = resp.version;
        // El registro que queda es el que devolvió el servidor: se guarda
        // entero para que un segundo guardado sin recargar no vaya contra el
        // ANEXO I viejo, y para que el documento y las filas se repinten con el
        // dato que acaba de escribir.
        if (resp.registro) {
          estado.sco.registro = resp.registro;
          colgarRegistroEnPlantilla(resp.registro);
          pintarRenglonesSco(resp.registro);
        }
        // El texto arranca con "ANEXO 1 guardado (versión N)": es el mismo
        // que se ve sin SCo, y lo que la recorrida de la ronda 20 espera leer
        // después de guardar. Lo que se agrega es de qué registro es.
        avisar('ANEXO 1 guardado (versión ' + resp.version + ' del registro de la SCo ' +
          numeroSco + '). Vale para los ' +
          (resp.registro && resp.registro.expedientes ? resp.registro.expedientes.length : 0) +
          ' requerimientos.', false);
      })
      .catch(function (err) {
        avisar('No se pudo guardar el ANEXO 1 de la SCo: ' + err.message, true);
      });
  }

  // El clic llegó antes que el registro de la SCo. El clic no se pierde: se
  // espera la lectura que ya está en vuelo y se guarda contra la versión que
  // llegue. Los campos se leyeron AL HACER EL CLIC, así que lo que el operador
  // escribió sobrevive al repintado que hace la llegada.
  function guardarCuandoLlegueElRegistro(campos, numeroSco) {
    avisar('Todavía se está leyendo el registro de la SCo ' + numeroSco +
      '. Se guarda en cuanto llegue.', false);
    estado.sco.carga.then(function () {
      // Si mientras tanto se abrió otro expediente (o se cambió de SCo), lo que
      // llegó no es de esta pantalla y no se guarda nada.
      if (numeroSCoDe(expedienteActual()) !== numeroSco) {
        avisar('Se cambió de expediente antes de que llegara el registro de la SCo ' +
          numeroSco + '. No se guardó nada.', true);
        return;
      }
      guardarContraRegistro(campos, numeroSco);
    });
  }

  function guardar() {
    var expediente = expedienteActual();
    if (!expediente || !estado.repo) {
      avisar('No hay expediente seleccionado o no hay conexión.', true);
      return;
    }
    var campos = leer();
    var numeroSco = numeroSCoDe(expediente);
    // ORDEN-RONDA-27 pieza 5: con SCo, el ANEXO I se guarda en el REGISTRO de la
    // SCo y contra la versión del registro. Se guarda una sola vez y vale para
    // todos los requerimientos, no para el expediente que esté abierto.
    if (numeroSco && typeof estado.repo.guardarAnexo1Sco === 'function') {
      if (typeof estado.sco.version !== 'number' && estado.sco.carga) {
        guardarCuandoLlegueElRegistro(campos, numeroSco);
        return;
      }
guardarContraRegistro(campos, numeroSco);
      return;
    }
    var copia = JSON.parse(JSON.stringify(expediente));
    var datos = datosDe(copia);
    if (typeof datos.anexo1 !== 'object' || datos.anexo1 === null) {
      datos.anexo1 = {};
    }
    for (var k in campos) {
      if (Object.prototype.hasOwnProperty.call(campos, k)) {
        datos.anexo1[k] = campos[k];
      }
    }
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual())
      .then(function (resp) {
        if (resp.conflicto) {
          var op = estado.operador || {};
          var esOtroOperador = !!resp.ultimoUsuario && resp.ultimoUsuario !== op.email;
          var texto = esOtroOperador
            ? 'El expediente fue modificado por otro operador'
            : 'El expediente fue modificado después de que usted lo abrió (posiblemente en otra pestaña)';
          avisar(texto + ' (versión ' +
            resp.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!resp.ok) {
          avisar('No se pudo guardar el ANEXO 1: ' + (resp.error || 'error desconocido'), true);
          return;
        }
        estado.version = resp.version;
        avisar('ANEXO 1 guardado (versión ' + resp.version + ').', false);
        if (SGC.views.expediente && typeof SGC.views.expediente.abrir === 'function') {
          SGC.views.expediente.abrir(estado.expedienteId);
        }
      })
      .catch(function (err) {
        avisar('No se pudo guardar el ANEXO 1: ' + err.message, true);
      });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  SGC.views.anexoUno = {
    montar: montar,
    actualizar: actualizar,
    fijarRepo: function (repo) { estado.repo = repo; },
    seleccionarOperador: function (op) { estado.operador = op; },
    leer: leer,
    // Pieza 5: el registro de la SCo que la vista está usando, o null. Lo
    // consultan las pruebas y quien necesite el dato sin volver a pedirlo.
    registroSco: function () { return estado.sco.registro; },
    // Pieza 5: la versión del REGISTRO que se está usando para guardar, o null
    // si todavía no llegó. La vista de exportación la necesita para guardar el
    // documento del ANEXO I en la misma versión en que se guardaron los datos.
    versionSco: function () {
      return typeof estado.sco.version === 'number' && estado.sco.numero
        ? estado.sco.version
        : null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

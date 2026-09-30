/*
 * expediente.js
 * Vista de expediente (ORDEN-RONDA-06 §3.2, ADR-010, FSD §3).
 *
 * - Muestra los datos, los renglones y la auditoría cronológica (ADR-006).
 * - Avanzar / Devolver por observación: el botón queda habilitado SOLO si el
 *   motor permite la transición para algún rol del operador. Si queda
 *   deshabilitado, se muestra el motivo que da el motor (p. ej. que el rol no
 *   es el ejecutor del estado).
 * - La ejecución de las transiciones vive en expediente-dialogo.js: avance con
 *   destino único directo, devolución con motivo del catálogo cerrado y, si
 *   hay más de un destino, el operador elige.
 * - Concurrencia (§3.3): si el servidor responde conflicto de versión, se
 *   muestra el aviso y se ofrece recargar; nunca se pisa lo ajeno.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('expediente.js requiere que namespaces.js se cargue primero');
  }

  var config = SGC.core.config;
  var estados = SGC.core.estados;
  var dialogo = SGC.views.expedienteDialogo;

  var estado = {
    repo: null,
    operador: null,
    onVolver: null,
    id: null,
    expediente: null,
    version: null,
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function limpiar(nodo) {
    while (nodo.children.length > 0) {
      nodo.removeChild(nodo.children[0]);
    }
  }

  function definirEstado(idEstado) {
    for (var i = 0; i < config.ESTADOS.length; i++) {
      if (config.ESTADOS[i].id === idEstado) {
        return config.ESTADOS[i];
      }
    }
    return null;
  }

  function faseDe(numero) {
    for (var i = 0; i < config.FASES.length; i++) {
      if (config.FASES[i].numero === numero) {
        return config.FASES[i];
      }
    }
    return null;
  }

  function rolDe(idRol) {
    for (var i = 0; i < config.ROLES.length; i++) {
      if (config.ROLES[i].id === idRol) {
        return config.ROLES[i];
      }
    }
    return null;
  }

  function motivoDe(idMotivo) {
    for (var i = 0; i < config.MOTIVOS_DEVOLUCION.length; i++) {
      if (config.MOTIVOS_DEVOLUCION[i].id === idMotivo) {
        return config.MOTIVOS_DEVOLUCION[i];
      }
    }
    return null;
  }

  function formatearFecha(iso) {
    if (typeof iso !== 'string' || iso.length === 0) {
      return '—';
    }
    return iso.replace('T', ' ').replace(/\.\d{3}Z?$/, '');
  }

  function accionLegible(accion) {
    if (accion === 'crearExpediente') {
      return 'Creación';
    }
    if (accion === 'avanzar') {
      return 'Avance';
    }
    if (accion === 'devolver') {
      return 'Devolución por observación';
    }
    if (accion === 'archivar') {
      return 'Archivo en el Histórico';
    }
    return accion;
  }

  function etiquetaCampo(clave) {
    var mapa = {
      numero: 'Número',
      titulo: 'Título',
      anio: 'Año',
      dependenciaSolicitante: 'Dependencia solicitante',
      unidadSolicitante: 'Unidad solicitante',
      finalidad: 'Finalidad',
      lugar: 'Lugar de entrega',
      vigencia: 'Vigencia'
    };
    return mapa[clave] || clave;
  }

  function ultimoOperadorDe(expediente) {
    if (expediente && typeof expediente.ultimoUsuario === 'string') {
      return expediente.ultimoUsuario;
    }
    var lista = Array.isArray(expediente.auditoria) ? expediente.auditoria : [];
    var ultimo = lista.length > 0 ? lista[lista.length - 1] : null;
    return (ultimo && ultimo.email) || '—';
  }

  function rolPara(expediente, accion) {
    var roles = (estado.operador && estado.operador.roles) || [];
    if (roles.length === 0) {
      return { rol: null, permiso: { permitido: false, motivo: 'El operador no tiene rol asignado', destinos: [] } };
    }
    for (var i = 0; i < roles.length; i++) {
      var p = estados[accion](expediente, roles[i]);
      if (p.permitido) {
        return { rol: roles[i], permiso: p };
      }
    }
    var primero = estados[accion](expediente, roles[0]);
    return { rol: roles[0], permiso: primero };
  }

  function agregarCampo(dl, nombre, valor) {
    var dt = document.createElement('dt');
    dt.textContent = nombre;
    var dd = document.createElement('dd');
    dd.textContent = valor === null || valor === undefined ? '—' : String(valor);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function renderDatos(dl, expediente) {
    limpiar(dl);
    var datos = (expediente && expediente.datos) || {};
    var identificacion = datos.identificacion || {};
    // ORDEN-RONDA-26 pieza 1: el expediente guarda `expedienteId` y `numero`
    // (repo.construirExpediente), no `id` ni `identificacion.numero`. Antes el
    // panel "Datos" mostraba "—" en los expedientes reales.
    agregarCampo(dl, 'Expediente', expediente.expedienteId || expediente.id);
    agregarCampo(dl, 'Número', expediente.numero || identificacion.numero || expediente.expedienteId || expediente.id);
    for (var k in identificacion) {
      if (k === 'numero' || k === 'operador') {
        continue;
      }
      agregarCampo(dl, etiquetaCampo(k), identificacion[k]);
    }
    if (datos.fechaCreacion) { agregarCampo(dl, 'Fecha de creación', formatearFecha(datos.fechaCreacion)); }
    if (datos.fechaLimite) { agregarCampo(dl, 'Fecha límite', formatearFecha(datos.fechaLimite)); }
    if (datos.prioridad) { agregarCampo(dl, 'Prioridad', datos.prioridad); }
    if (datos.rubro) { agregarCampo(dl, 'Rubro', datos.rubro); }
    if (datos.tipo) { agregarCampo(dl, 'Tipo', datos.tipo); }
    if (expediente.basadoEn) { agregarCampo(dl, 'Basado en el expediente', expediente.basadoEn); }
  }

  function renderRenglones(ul, expediente) {
    limpiar(ul);
    var renglones = Array.isArray(expediente.renglones) ? expediente.renglones : [];
    if (renglones.length === 0) {
      var vacio = document.createElement('li');
      vacio.textContent = 'Sin renglones cargados.';
      ul.appendChild(vacio);
      return;
    }
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      var li = document.createElement('li');
      var texto = r.codigo + ' · ' + r.cantidad + ' ' + (r.unidad || '');
      if (r.rubro) {
        texto += ' (' + r.rubro + ')';
      }
      li.textContent = texto;
      ul.appendChild(li);
    }
  }

  function renderAuditoria(ol, expediente) {
    limpiar(ol);
    var lista = Array.isArray(expediente.auditoria) ? expediente.auditoria : [];
    for (var i = 0; i < lista.length; i++) {
      var entrada = lista[i];
      var li = document.createElement('li');
      var defDe = definirEstado(entrada.de);
      var defA = definirEstado(entrada.a);
      var cabecera = document.createElement('span');
      cabecera.className = 'exp-aud-cabecera';
      cabecera.textContent = '[' + formatearFecha(entrada.timestamp) + '] ' +
        accionLegible(entrada.accion) + ': ' +
        (defDe ? defDe.titulo : (entrada.de || '—')) + ' → ' +
        (defA ? defA.titulo : (entrada.a || '—'));
      li.appendChild(cabecera);
      var autor = document.createElement('span');
      autor.className = 'exp-aud-autor';
      autor.textContent = 'por ' + (entrada.email || '—') +
        ' (' + (entrada.rol || '—') + ') desde ' + (entrada.equipo || '—');
      li.appendChild(autor);
      var motivo = motivoDe(entrada.motivo);
      if (motivo || entrada.observacion) {
        var detalle = document.createElement('span');
        detalle.className = 'exp-aud-detalle';
        detalle.textContent = (motivo ? 'Motivo: ' + motivo.texto : '') +
          (entrada.observacion ? (motivo ? '. ' : '') + 'Observación: ' + entrada.observacion : '');
        li.appendChild(detalle);
      }
      ol.appendChild(li);
    }
  }

  // ORDEN-RONDA-26 pieza 2: a partir de la MISMA validación que usa el
  // servidor (validarParaAvanzar), dice qué falta y cómo resolverlo, con el
  // título del entregable o del campo, nunca el id técnico. Frases ejemplo:
  // "Falta: guardar el ANEXO 1 (botón 'Guardar documento generado', más abajo)".
  function textoRequisitosFaltantes(revision) {
    var items = SGC.core.validacion.itemsFaltantes(revision);
    var partes = [];
    for (var i = 0; i < items.length; i++) {
      var texto = items[i];
      if (texto.indexOf('guardar ') === 0) {
        texto += " (botón 'Guardar documento generado', más abajo)";
      }
      partes.push('Falta: ' + texto);
    }
    return partes.join(' ');
  }

  // Composición del documento del estado (ORDEN-RONDA-08 §2.1). Vive suelta
  // porque ORDEN-RONDA-27 pieza 5 la necesita volver a correr: el ANEXO I se
  // arma con el registro de la SCo, que llega de la red después de este render.
  // El nodo del documento es de ESTA vista, así que quien lo pide es esta vista
  // y no la del ANEXO I (que no lo tiene en su raíz).
  function componerDocumento(expediente, idEstado) {
    var plantilla = SGC.renders.documento.paraEstado(idEstado);
    if (estado.dom.documentoSeccion) {
      estado.dom.documentoSeccion.hidden = !plantilla;
    }
    if (plantilla) {
      if (estado.dom.documentoTitulo) {
        estado.dom.documentoTitulo.textContent = plantilla.titulo;
      }
      if (estado.dom.documento) {
        limpiar(estado.dom.documento);
        plantilla.montar(estado.dom.documento, expediente);
      }
    }
  }

  // ORDEN-RONDA-27 pieza 6: arriba del expediente dice de qué SCo parte y con
  // qué requerimientos va: la frase exacta es "Parte de la SCo 123/2026, con
  // 2026-003 y 2026-007", o sea TODOS los que van en la SCo, incluido el que se
  // está mirando. El número de SCo ya está en el expediente (`campos.numeroSCo`,
  // ORDEN-RONDA-26 pieza 4) y la lista sale del REGISTRO de la SCo. Si todavía no
  // hay registro (los requerimientos todavía no salieron de
  // SOLICITUD_CONTRATACION), se avisa que comparte número y nada más: no se
  // inventa la lista.
  function renderSco(expediente) {
    var linea = estado.dom.sco;
    if (!linea) {
      return;
    }
    var numero = (typeof expediente.campos === 'object' && expediente.campos !== null &&
      typeof expediente.campos.numeroSCo === 'string' && expediente.campos.numeroSCo.trim() !== '')
      ? expediente.campos.numeroSCo.trim() : null;
    if (numero === null) {
      linea.hidden = true;
      linea.textContent = '';
      return;
    }
    // Primero lo que se sabe seguro, y de paso se borra lo de otro expediente:
    // hasta que llegue el REGISTRO, la línea no puede quedar mostrando la SCo
    // anterior.
    linea.hidden = false;
    linea.textContent = 'Parte de la SCo ' + numero;
    if (!estado.repo || typeof estado.repo.leerSCo !== 'function') {
      return;
    }
    estado.repo.leerSCo(numero).then(function (registro) {
      // Si se abrió otro expediente mientras llegaba, la respuesta vieja no se pinta:
      // sólo vale si sigue siendo el expediente en pantalla.
      if (estado.expediente !== expediente) {
        return;
      }
      if (!registro || !Array.isArray(registro.expedientes) || registro.expedientes.length === 0) {
        return;
      }
      linea.textContent = 'Parte de la SCo ' + numero + ', con ' + registro.expedientes.join(' y ');
    }).catch(function () {
      // La línea de la SCo es una comodidad: si el REGISTRO no se puede leer,
      // queda lo que se sabe seguro, que ya está puesto.
    });
  }

  function render() {
    var expediente = estado.expediente;
    if (!expediente) {
      return;
    }
    var idEstado = SGC.core.utils.idEstado(expediente);
    var def = definirEstado(idEstado);
    var fase = faseDe(def ? def.fase : null);
    var rolEj = rolDe(def ? def.rolEjecutor : null);

    estado.dom.titulo.textContent = (expediente.titulo) || 'Expediente ' + (expediente.expedienteId || expediente.id);
    var resumen = 'Estado: ' + (def ? def.titulo : idEstado) +
      ' · Fase: ' + (fase ? fase.titulo : '—') +
      ' · Ejecutor del estado: ' + (rolEj ? rolEj.nombre : '—');
    if (expediente.fechaLimite) {
      resumen += ' · Vence: ' + formatearFecha(expediente.fechaLimite);
    }
    resumen += ' · Último operador: ' + ultimoOperadorDe(expediente);
    estado.dom.resumen.textContent = resumen;
    renderSco(expediente);

    renderDatos(estado.dom.datos, expediente);
    renderRenglones(estado.dom.renglones, expediente);
    renderAuditoria(estado.dom.auditoria, expediente);

    // Editor de renglones (ORDEN-RONDA-25 §6): la vista del estado actual.
    // Se monta con su propia sección; guardado por PUT con versionEsperada.
    if (SGC.views.renglonesEditor && typeof SGC.views.renglonesEditor.actualizar === 'function') {
      SGC.views.renglonesEditor.actualizar();
    }

    // Documento del estado (ORDEN-RONDA-08 §2.1): se compone con la plantilla
    // que produce el estado actual (nodos DOM, nunca innerHTML). Si el estado
    // no produce documento, la sección se oculta.
    componerDocumento(expediente, idEstado);

    // ORDEN-RONDA-08 §2.2: un expediente archivado es sólo lectura.
    var archivado = expediente.archivado === true;
    if (estado.dom.archivado) {
      estado.dom.archivado.hidden = !archivado;
    }

    var avance = rolPara(expediente, 'puedeAvanzar');
    var devolucion = rolPara(expediente, 'puedeDevolver');
    // ORDEN-RONDA-26 pieza 2: si el rol habilita avanzar, la vista llama a la
    // misma validación que usa el servidor y lo dice ANTES de apretar. Si falta
    // algo, el botón se deshabilita y el texto explica qué falta: el título del
    // entregable o del campo, nunca el id.
    var faltaRequisito = false;
    if (avance.permiso.permitido && !archivado) {
      var revision = SGC.core.validacion.validarParaAvanzar(expediente);
      faltaRequisito = !revision.valido;
      estado.dom.avanzarPorque.textContent = faltaRequisito ? textoRequisitosFaltantes(revision) : '';
    } else {
      estado.dom.avanzarPorque.textContent = archivado ? 'El expediente está archivado.' : (avance.permiso.permitido ? '' : avance.permiso.motivo);
    }
    estado.dom.avanzar.disabled = archivado || !avance.permiso.permitido || faltaRequisito;
    estado.dom.devolver.disabled = archivado || !devolucion.permiso.permitido;
    estado.dom.devolverPorque.textContent = archivado ? 'El expediente está archivado.' : (devolucion.permiso.permitido ? '' : devolucion.permiso.motivo);

    // Las acciones de exportación (exportar.js) adaptan documento, nombre e id
    // al estado actual. En las monturas de test puede no estar montado.
    if (SGC.views.exportar && typeof SGC.views.exportar.actualizar === 'function') {
      SGC.views.exportar.actualizar();
    }
    if (SGC.views.requerimientoFormulario && typeof SGC.views.requerimientoFormulario.actualizar === 'function') {
      SGC.views.requerimientoFormulario.actualizar();
    }
    if (SGC.views.anexoUno && typeof SGC.views.anexoUno.actualizar === 'function') { SGC.views.anexoUno.actualizar(expediente); }
    if (SGC.views.scoNumero && typeof SGC.views.scoNumero.actualizar === 'function') { SGC.views.scoNumero.actualizar(expediente); }
  }

  function avisar(mensaje, esError) {
    estado.dom.mensaje.textContent = mensaje;
    estado.dom.mensaje.className = esError ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.mensaje.hidden = false;
  }

  function mostrarConflicto(respuesta) {
    var quien = respuesta && respuesta.ultimoUsuario ? respuesta.ultimoUsuario : null;
    var esOtroOperador = !!quien && (!estado.operador || quien !== estado.operador.email);
    var mensaje = esOtroOperador
      ? 'El expediente fue modificado por otro operador'
      : 'El expediente fue modificado después de que usted lo abrió (posiblemente en otra pestaña)';
    if (respuesta && respuesta.versionRemota !== undefined) {
      mensaje += ' (versión actual en el servidor: ' + respuesta.versionRemota + ')';
    }
    mensaje += '. No se guardó el cambio.';
    estado.dom.conflictoTexto.textContent = mensaje;
    estado.dom.conflicto.hidden = false;
  }

  function manejarResultado(respuesta) {
    if (!respuesta) { return; }
    if (respuesta.conflicto) { mostrarConflicto(respuesta); return; }
    if (respuesta.ok) {
      avisar('Cambio guardado (versión ' + respuesta.version + ').', false);
      abrir(estado.id);
      return;
    }
    avisar('No se pudo completar la operación: ' + respuesta.error, true);
  }

  function pedirAvanzar() {
    var avance = rolPara(estado.expediente, 'puedeAvanzar');
    if (!avance.permiso.permitido) {
      return;
    }
    dialogo.avanzar(estado.expediente, estado.version, avance.rol,
      avance.permiso.destinos, estado.operador, manejarResultado);
  }

  function pedirDevolver() {
    var devolucion = rolPara(estado.expediente, 'puedeDevolver');
    if (!devolucion.permiso.permitido) {
      return;
    }
    dialogo.devolver(estado.expediente, estado.version, devolucion.rol,
      devolucion.permiso.destinos, estado.operador, manejarResultado);
  }

  function abrir(id) {
    estado.id = id;
    estado.dom.mensaje.hidden = true;
    estado.dom.conflicto.hidden = true;
    if (!estado.repo) {
      return;
    }
    estado.repo.leerExpediente(id).then(function (respuesta) {
      estado.expediente = respuesta.expediente;
      estado.version = respuesta.version;
      render();
    }).catch(function (err) {
      avisar('No se pudo leer el expediente: ' + err.message, true);
    });
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    dialogo.montar(raiz);
    estado.dom.titulo = qs(raiz, '#sgc-expediente-titulo');
    estado.dom.sco = qs(raiz, '#sgc-expediente-sco');
    estado.dom.resumen = qs(raiz, '#sgc-expediente-resumen');
    estado.dom.datos = qs(raiz, '#sgc-expediente-datos');
    estado.dom.renglones = qs(raiz, '#sgc-expediente-renglones');
    estado.dom.auditoria = qs(raiz, '#sgc-expediente-auditoria');
    estado.dom.avanzar = qs(raiz, '#sgc-expediente-avanzar');
    estado.dom.devolver = qs(raiz, '#sgc-expediente-devolver');
    estado.dom.avanzarPorque = qs(raiz, '#sgc-expediente-avanzar-porque');
    estado.dom.devolverPorque = qs(raiz, '#sgc-expediente-devolver-porque');
    estado.dom.mensaje = qs(raiz, '#sgc-expediente-mensaje');
    estado.dom.conflicto = qs(raiz, '#sgc-expediente-conflicto');
    estado.dom.conflictoTexto = qs(raiz, '#sgc-expediente-conflicto-texto');
    estado.dom.documento = qs(raiz, '#sgc-expediente-documento');
    estado.dom.documentoTitulo = qs(raiz, '#sgc-expediente-documento-titulo');
    estado.dom.documentoSeccion = qs(raiz, '#sgc-expediente-documento-seccion');
    estado.dom.archivado = qs(raiz, '#sgc-expediente-archivado');

    qs(raiz, '#sgc-expediente-volver').addEventListener('click', function () {
      if (typeof estado.onVolver === 'function') {
        estado.onVolver();
      }
    });
    estado.dom.avanzar.addEventListener('click', pedirAvanzar);
    estado.dom.devolver.addEventListener('click', pedirDevolver);
    qs(raiz, '#sgc-expediente-recargar').addEventListener('click', function () {
      estado.dom.conflicto.hidden = true;
      abrir(estado.id);
    });
  }

  SGC.views.expediente = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
      dialogo.fijarRepo(repo);
    },
    seleccionarOperador: function (operador) {
      estado.operador = operador;
    },
    onVolver: function (fn) {
      estado.onVolver = fn;
    },
    obtener: function () {
      return { expediente: estado.expediente, version: estado.version };
    },
    // Pieza 5: la vista del ANEXO I avisa que el registro de la SCo llegó y el
    // documento se vuelve a componer con él.
    recomponerDocumento: function (expediente) {
      var exp = expediente || estado.expediente;
      if (!exp) return;
      componerDocumento(exp, SGC.core.utils.idEstado(exp));
    },
    abrir: abrir
  };
})(typeof window !== 'undefined' ? window : globalThis);
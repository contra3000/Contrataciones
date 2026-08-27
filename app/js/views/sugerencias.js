/*
 * sugerencias.js
 * ORDEN-RONDA-13 §6 (H19). Diálogo de sugerencias del piloto.
 *
 * Solo existe en modo piloto (`config/aplicacion.json` => `modoPiloto: true`):
 * con modo piloto apagado la vista no crea ni el botón ni el panel, así que no
 * hay nada en el DOM (y por lo tanto nada visible) para el operador común.
 *
 * La sugerencia es un reporte del operador para el Jefe de Contrataciones.
 * El contexto viaja automáticamente: pantalla visible, expediente/versión
 * abierto, paso del asistente, versión de la app y del catálogo y el
 * navegador. Todo se arma con createElement y textContent: cero innerHTML
 * (ADR-011, el dom de pruebas cuenta asignaciones y exige que sean 0).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('sugerencias.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    operador: null,
    config: null,
    fab: null,
    dom: {}
  };

  function visible(id) {
    var nodo = document.getElementById(id);
    return !!nodo && !nodo.hidden;
  }

  // Pantalla actual a partir de las secciones visibles: es la fuente de verdad
  // de la navegación (los alternadores de app.js esconden y muestran secciones).
  function pantallaActual() {
    if (visible('sgc-sugerencias-jefe')) {
      return 'sugerencias-jefe';
    }
    if (visible('sgc-base-revision')) {
      return 'base-revision';
    }
    if (visible('sgc-expediente')) {
      return 'expediente';
    }
    if (visible('sgc-kanban')) {
      return 'tablero';
    }
    if (visible('sgc-archivo')) {
      return 'archivo';
    }
    return 'alta';
  }

  // Contexto de una sugerencia: solo los campos declarados y el contenido
  // crudo del operador. Lo que el navegador mande de más lo ignora el
  // servidor; acá se recogen las fuentes automáticas en su forma final.
  function recogerContexto(opciones) {
    var o = opciones || {};
    var datos = {
      contenido: typeof o.contenido === 'string' ? o.contenido : ''
    };
    var campos = ['pantalla', 'expediente', 'paso', 'appVersion', 'catalogoVersion', 'navegador'];
    for (var i = 0; i < campos.length; i++) {
      var valor = o[campos[i]];
      if (valor !== undefined && valor !== null && valor !== '') {
        datos[campos[i]] = String(valor);
      }
    }
    return {
      datos: datos,
      contexto: {
        email: o.email || null,
        rol: o.rol || null,
        equipo: o.equipo || null
      }
    };
  }

  function expedienteAbierto() {
    var actual = SGC.views.expediente.obtener();
    return actual && actual.expediente ? actual.expediente.id : '';
  }

  function catalogoVersion() {
    var carga = SGC.catalogo && SGC.catalogo.carga;
    if (!carga || !carga.obtenerEstado) {
      return '';
    }
    var manifiesto = carga.obtenerEstado().manifiesto;
    return manifiesto && manifiesto.catalogoVersion ? manifiesto.catalogoVersion : '';
  }

  function construirPanel(raiz) {
    var panel = document.createElement('div');
    panel.id = 'sgc-panel-sugerencia';
    panel.className = 'sugerencia-overlay';
    panel.hidden = true;
    var caja = document.createElement('div');
    caja.className = 'sugerencia-caja';
    var titulo = document.createElement('h2');
    titulo.textContent = 'Sugerencia para el Jefe de Contrataciones';
    var subtitulo = document.createElement('p');
    subtitulo.className = 'sugerencia-contexto';
    var area = document.createElement('textarea');
    area.rows = 6;
    area.maxLength = 4000;
    area.placeholder = 'Describa lo que pasó o lo que le faltó. El contexto de pantalla y expediente se adjunta solo.';
    var feedback = document.createElement('p');
    feedback.className = 'sugerencia-feedback';
    feedback.hidden = true;
    var error = document.createElement('p');
    error.className = 'error-global';
    error.hidden = true;
    var fila = document.createElement('div');
    fila.className = 'sugerencia-botones';
    var enviar = document.createElement('button');
    enviar.type = 'button';
    enviar.textContent = 'Enviar';
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.textContent = 'Cerrar';
    fila.appendChild(enviar);
    fila.appendChild(cerrar);
    caja.appendChild(titulo);
    caja.appendChild(subtitulo);
    caja.appendChild(area);
    caja.appendChild(feedback);
    caja.appendChild(error);
    caja.appendChild(fila);
    panel.appendChild(caja);
    raiz.appendChild(panel);
    estado.dom.panel = panel;
    estado.dom.subtitulo = subtitulo;
    estado.dom.area = area;
    estado.dom.feedback = feedback;
    estado.dom.error = error;
    cerrar.addEventListener('click', cerrarPanel);
    enviar.addEventListener('click', enviarSugerencia);
  }

  function abrirPanel() {
    var operador = estado.operador || {};
    var textos = [];
    textos.push('Pantalla: ' + pantallaActual());
    var exp = expedienteAbierto();
    if (exp) {
      textos.push('Expediente: ' + exp);
      var paso = SGC.views.wizard.pasoActual();
      if (paso !== undefined && paso !== null) {
        textos.push('Paso del asistente: ' + paso);
      }
    }
    var versionCatalogo = catalogoVersion();
    if (versionCatalogo) {
      textos.push('Catálogo: ' + versionCatalogo);
    }
    textos.push('Operador: ' + (operador.email || '—'));
    estado.dom.subtitulo.textContent = textos.join(' · ');
    estado.dom.area.value = '';
    estado.dom.feedback.hidden = true;
    estado.dom.error.hidden = true;
    estado.dom.panel.hidden = false;
    estado.dom.area.focus();
  }

  function cerrarPanel() {
    estado.dom.panel.hidden = true;
  }

  function enviarSugerencia() {
    estado.dom.feedback.hidden = true;
    estado.dom.error.hidden = true;
    var operador = estado.operador || {};
    var contexto = recogerContexto({
      contenido: estado.dom.area.value,
      pantalla: pantallaActual(),
      expediente: expedienteAbierto(),
      paso: SGC.views.wizard.pasoActual(),
      appVersion: estado.config ? estado.config.version : '',
      catalogoVersion: catalogoVersion(),
      navegador: typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '',
      email: operador.email,
      rol: Array.isArray(operador.roles) ? operador.roles[0] : undefined,
      equipo: operador.equipo
    });
    estado.repo.enviarSugerencia(contexto.datos, contexto.contexto).then(function () {
      estado.dom.area.value = '';
      estado.dom.feedback.textContent = 'Sugerencia enviada. Gracias.';
      estado.dom.feedback.hidden = false;
    }).catch(function (err) {
      estado.dom.error.textContent = 'No se pudo enviar: ' + err.message;
      estado.dom.error.hidden = false;
    });
  }

  function montar(raiz) {
    if (!estado.config || estado.config.modoPiloto !== true) {
      return;
    }
    if (estado.fab) {
      return;
    }
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'sgc-fab-sugerencia';
    fab.className = 'fab-sugerencia';
    fab.textContent = '?';
    fab.setAttribute('aria-label', 'Enviar una sugerencia al Jefe de Contrataciones');
    fab.addEventListener('click', abrirPanel);
    raiz.appendChild(fab);
    estado.fab = fab;
    construirPanel(raiz);
  }

  SGC.views.sugerencias = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    fijarOperador: function (operador) {
      estado.operador = operador;
    },
    fijarConfig: function (config) {
      estado.config = config || null;
    },
    paneles: function () {
      return estado.fab ? 1 : 0;
    },
    recogerContexto: recogerContexto,
    pantallaActual: pantallaActual
  };
})(typeof window !== 'undefined' ? window : globalThis);
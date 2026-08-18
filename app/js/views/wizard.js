/*
 * wizard.js
 * Wizard de la Especificación Técnica (ORDEN-RONDA-05 §3.1). Orquesta los
 * cuatro pasos definidos en pasos.js, embebe el buscador del ciclo 4 en el
 * paso 2, administra el borrador local (§3.2) y la persistencia real (§3.3).
 *
 * No contiene reglas de validación: consulta SGC.views.pasos, que a su vez
 * usa SGC.core.validacion. La vista sólo muestra errores junto al campo y en
 * un resumen con aria-live.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('wizard.js requiere que namespaces.js se cargue primero');
  }

  var pasos = SGC.views.pasos;
  var borrador = SGC.views.borrador;
  var fasttrack = SGC.views.fasttrack;

  var estado = {
    operador: null,
    repo: null,
    datos: { identificacion: {}, renglones: [], fundamentacion: {} },
    paso: 0,
    persistido: false,
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function campoInput(idCampo) {
    return estado.dom.campos[idCampo];
  }

  function leerCampo(idCampo) {
    var nodo = campoInput(idCampo);
    return nodo ? nodo.value : '';
  }

  function sincronizarDesdeFormulario() {
    estado.datos.identificacion.titulo = leerCampo('titulo');
    estado.datos.identificacion.anio = leerCampo('anio');
    estado.datos.identificacion.dependenciaSolicitante = leerCampo('dependenciaSolicitante');
    estado.datos.fundamentacion.justificacion = leerCampo('justificacion');
    estado.datos.fundamentacion.objetivo = leerCampo('objetivo');
    estado.datos.renglones = SGC.catalogo.renglones.obtener();
  }

  function guardarBorrador() {
    if (!estado.operador) {
      return;
    }
    sincronizarDesdeFormulario();
    try {
      borrador.guardar(storage(), estado.datos, estado.operador.email);
    } catch (e) {
      // sessionStorage puede estar bloqueado; el borrador es mejor esfuerzo
    }
  }

  function storage() {
    return root.sessionStorage;
  }

  function mostrarErrores(errores) {
    for (var clave in estado.dom.errores) {
      if (Object.prototype.hasOwnProperty.call(estado.dom.errores, clave)) {
        estado.dom.errores[clave].textContent = '';
        estado.dom.errores[clave].hidden = true;
      }
    }
    var lista = [];
    for (var i = 0; i < errores.length; i++) {
      var e = errores[i];
      var nodo = estado.dom.errores[e.campo];
      if (nodo) {
        nodo.textContent = e.mensaje;
        nodo.hidden = false;
      } else {
        lista.push(e.mensaje);
      }
    }
    estado.dom.pasoMsj.textContent = lista.join(' · ');
    estado.dom.pasoMsj.hidden = lista.length === 0;
  }

  function irAPaso(n, validarSalida) {
    if (n === estado.paso) {
      return;
    }
    if (validarSalida && n > estado.paso) {
      var revision = pasos.validarPaso(pasos.PASOS[estado.paso].id, estado.datos);
      if (!revision.valido) {
        mostrarErrores(revision.errores);
        return;
      }
    }
    guardarBorrador();
    estado.paso = n;
    renderPaso();
  }

  function renderPaso() {
    var i;
    for (i = 0; i < pasos.PASOS.length; i++) {
      var seccion = estado.dom.secciones[i];
      seccion.hidden = i !== estado.paso;
      var enlace = estado.dom.enlacesPasos[i];
      if (enlace) {
        enlace.setAttribute('aria-current', i === estado.paso ? 'step' : 'false');
      }
    }
    estado.dom.anterior.hidden = estado.paso === 0;
    estado.dom.siguiente.hidden = estado.paso === pasos.PASOS.length - 1;
    estado.dom.persistir.hidden = estado.paso !== pasos.PASOS.length - 1;
    mostrarErrores([]);
    if (estado.paso === pasos.PASOS.length - 1) {
      renderRevision();
    }
    enfocarPrimerCampo();
  }

  function enfocarPrimerCampo() {
    var seccion = estado.dom.secciones[estado.paso];
    var focales = seccion.querySelectorAll('input:not([type=hidden]), select, textarea, button, [tabindex="0"]');
    if (focales.length > 0) {
      focales[0].focus();
    }
  }

  function renderRevision() {
    sincronizarDesdeFormulario();
    var filas = pasos.resumen(estado.datos, estado.operador);
    var lista = estado.dom.revisionFilas;
    lista.textContent = '';
    for (var i = 0; i < filas.length; i++) {
      var fila = filas[i];
      var dt = document.createElement('dt');
      dt.textContent = fila.etiqueta;
      var dd = document.createElement('dd');
      if (fila.clave === 'renglones' && Array.isArray(fila.valor)) {
        var ul = document.createElement('ul');
        for (var j = 0; j < fila.valor.length; j++) {
          var li = document.createElement('li');
          li.textContent = fila.valor[j];
          ul.appendChild(li);
        }
        dd.appendChild(ul);
      } else {
        dd.textContent = fila.valor;
      }
      lista.appendChild(dt);
      lista.appendChild(dd);
    }
  }

  function persistir() {
    if (!estado.repo || estado.persistido) {
      return;
    }
    estado.dom.persistir.disabled = true;
    estado.dom.persistirMsj.hidden = true;
    estado.dom.exito.hidden = true;
    var catalogoVersion = null;
    var estCarga = SGC.catalogo.carga.obtenerEstado();
    if (estCarga.manifiesto) {
      catalogoVersion = estCarga.manifiesto.catalogoVersion;
    }
    pasos.persistir(estado.repo, estado.datos, estado.operador, catalogoVersion, storage())
      .then(function (resultado) {
        if (resultado.ok) {
          estado.persistido = true;
          estado.dom.exito.hidden = false;
          estado.dom.exitoId.textContent = 'Expediente ' + resultado.id;
          estado.dom.persistir.hidden = true;
          estado.dom.persistirMsj.hidden = true;
        } else {
          estado.dom.persistir.disabled = false;
          estado.dom.persistirMsj.textContent =
            'No se pudo crear el expediente. El borrador se conservó. ' + resultado.error;
          estado.dom.persistirMsj.hidden = false;
        }
      });
  }

  function ofrecerBorrador(registro) {
    estado.dom.borradorAviso.hidden = false;
    estado.dom.borradorInfo.textContent =
      'Hay un borrador de ' + registro.operador + ' guardado el ' + registro.guardado + '.';
  }

  function retomarBorrador(registro) {
    var chequeo = borrador.validarForma(registro.datos);
    if (!chequeo.valido) {
      estado.dom.borradorInfo.textContent =
        'El borrador guardado no se puede aplicar: ' + chequeo.motivo +
        '. Puede descartarlo y empezar de nuevo.';
      estado.dom.borradorAviso.hidden = false;
      return;
    }
    estado.datos = JSON.parse(JSON.stringify(registro.datos));
    if (estado.datos.identificacion && estado.datos.identificacion.operador) {
      estado.datos.identificacion.operador = estado.operador.email;
    }
    estado.dom.borradorAviso.hidden = true;
    aplicarDatosAlFormulario();
    SGC.catalogo.renglones.cargar(estado.datos.renglones);
    irAPaso(0, false);
  }

  function descartarBorrador() {
    try {
      borrador.limpiar(storage());
    } catch (e) {
      // ignorar
    }
    estado.dom.borradorAviso.hidden = true;
  }

  function aplicarDatosAlFormulario() {
    var id = estado.datos.identificacion || {};
    var fund = estado.datos.fundamentacion || {};
    campoInput('titulo').value = id.titulo || '';
    campoInput('anio').value = id.anio || '';
    campoInput('dependenciaSolicitante').value = id.dependenciaSolicitante || '';
    campoInput('justificacion').value = fund.justificacion || '';
    campoInput('objetivo').value = fund.objetivo || '';
  }

  function seleccionarOperador(operador, repo) {
    estado.operador = operador;
    estado.repo = repo;
    estado.paso = 0;
    estado.persistido = false;
    estado.datos = {
      identificacion: { operador: operador.email },
      renglones: [],
      fundamentacion: {}
    };
    estado.dom.borradorAviso.hidden = true;
    estado.dom.seleccionOperador.hidden = true;
    estado.dom.app.hidden = false;
    estado.dom.operadorActual.textContent =
      operador.nombre + ' ' + operador.apellido + ' (' + operador.roles.join(', ') + ') — ' + operador.email;
    renderPaso();
    var registro = borrador.leer(storage());
    if (registro && registro.operador === operador.email) {
      ofrecerBorrador(registro);
    }
  }

  function importarModelo() {
    var archivo = estado.dom.archivoModelo.files && estado.dom.archivoModelo.files[0];
    if (!archivo) {
      return;
    }
    estado.dom.fasttrackMsj.hidden = true;
    var lector = new FileReader();
    lector.onload = function () {
      // Estructura y tipos primero, con verificación de códigos en blanco:
      // un archivo mal formado se rechaza sin tocar la red. La existencia de
      // los códigos la valida el servidor (ORDEN-RONDA-06 §2.2): el cliente
      // ya no baja el universo de códigos.
      var estructural = fasttrack.importar(String(lector.result), function () {
        return true;
      });
      if (!estructural.ok) {
        estado.dom.fasttrackMsj.textContent = 'No se pudo importar el archivo:\n' + estructural.errores.join('\n');
        estado.dom.fasttrackMsj.hidden = false;
        return;
      }
      var codigos = estructural.datos.renglones.map(function (r) {
        return r.codigo;
      });
      if (typeof estado.repo.validarCodigos !== 'function') {
        estado.dom.fasttrackMsj.textContent =
          'No se pudo validar el archivo: el servidor de catálogo no está disponible. El archivo no se importa.';
        estado.dom.fasttrackMsj.hidden = false;
        return;
      }
      estado.repo.validarCodigos(codigos).then(function (respuesta) {
        var verificar = function (codigo) {
          return respuesta.invalidos.indexOf(codigo) === -1;
        };
        var resultado = fasttrack.importar(String(lector.result), verificar);
        if (!resultado.ok) {
          estado.dom.fasttrackMsj.textContent = 'No se pudo importar el archivo:\n' + resultado.errores.join('\n');
          estado.dom.fasttrackMsj.hidden = false;
          return;
        }
        estado.datos = resultado.datos;
        estado.datos.identificacion.operador = estado.operador.email;
        aplicarDatosAlFormulario();
        SGC.catalogo.indice.registrarCodigos(estado.datos.renglones);
        SGC.catalogo.renglones.cargar(estado.datos.renglones);
        guardarBorrador();
        estado.dom.fasttrackMsj.textContent = 'Modelo importado correctamente. Revisá los pasos y seguí.';
        estado.dom.fasttrackMsj.hidden = false;
        estado.dom.archivoModelo.value = '';
        irAPaso(1, false);
      }).catch(function (err) {
        estado.dom.fasttrackMsj.textContent =
          'No se pudo validar el archivo contra el servidor: ' +
          (err && err.message ? err.message : 'error de red') +
          '. El archivo no se importa.';
        estado.dom.fasttrackMsj.hidden = false;
      });
    };
    lector.readAsText(archivo);
  }

  function descargarModelo() {
    var contenido = JSON.stringify(fasttrack.modelo(), null, 2);
    var blob = new Blob([contenido], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'modelo-especificacion.json';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.seleccionOperador = qs(raiz, '#sgc-seleccion-operador');
    estado.dom.listaOperadores = qs(raiz, '#sgc-lista-operadores');
    estado.dom.app = qs(raiz, '#sgc-app');
    estado.dom.operadorActual = qs(raiz, '#sgc-operador-actual');
    estado.dom.enlacesPasos = [];
    var pasosNav = qs(raiz, '#sgc-pasos');
    for (var i = 0; i < pasos.PASOS.length; i++) {
      estado.dom.enlacesPasos.push(qs(pasosNav, '[data-paso="' + pasos.PASOS[i].id + '"]'));
    }
    estado.dom.secciones = [];
    for (var j = 0; j < pasos.PASOS.length; j++) {
      estado.dom.secciones.push(qs(raiz, '#sgc-paso-' + pasos.PASOS[j].id));
    }
    estado.dom.anterior = qs(raiz, '#sgc-anterior');
    estado.dom.siguiente = qs(raiz, '#sgc-siguiente');
    estado.dom.persistir = qs(raiz, '#sgc-persistir');
    estado.dom.persistirMsj = qs(raiz, '#sgc-persistir-msj');
    estado.dom.exito = qs(raiz, '#sgc-exito');
    estado.dom.exitoId = qs(raiz, '#sgc-exito-id');
    estado.dom.pasoMsj = qs(raiz, '#sgc-paso-msj');
    estado.dom.revisionFilas = qs(raiz, '#sgc-revision-filas');
    estado.dom.campos = {
      titulo: qs(raiz, '#sgc-titulo'),
      anio: qs(raiz, '#sgc-anio'),
      dependenciaSolicitante: qs(raiz, '#sgc-dependencia'),
      justificacion: qs(raiz, '#sgc-justificacion'),
      objetivo: qs(raiz, '#sgc-objetivo')
    };
    estado.dom.errores = {
      titulo: qs(raiz, '#sgc-error-titulo'),
      anio: qs(raiz, '#sgc-error-anio'),
      dependenciaSolicitante: qs(raiz, '#sgc-error-dependencia'),
      justificacion: qs(raiz, '#sgc-error-justificacion')
    };
    estado.dom.borradorAviso = qs(raiz, '#sgc-borrador-aviso');
    estado.dom.borradorInfo = qs(raiz, '#sgc-borrador-info');
    estado.dom.archivoModelo = qs(raiz, '#sgc-archivo-modelo');
    estado.dom.fasttrackMsj = qs(raiz, '#sgc-fasttrack-msj');
    estado.dom.archivoModelo.addEventListener('change', importarModelo);
    qs(raiz, '#sgc-btn-modelo').addEventListener('click', descargarModelo);
    qs(raiz, '#sgc-btn-retomar').addEventListener('click', function () {
      var registro = borrador.leer(storage());
      if (registro) {
        retomarBorrador(registro);
      }
    });
    qs(raiz, '#sgc-btn-descartar').addEventListener('click', descartarBorrador);
    estado.dom.anterior.addEventListener('click', function () {
      irAPaso(estado.paso - 1, false);
    });
    estado.dom.siguiente.addEventListener('click', function () {
      sincronizarDesdeFormulario();
      irAPaso(estado.paso + 1, true);
    });
    estado.dom.persistir.addEventListener('click', persistir);
    for (var campo in estado.dom.campos) {
      if (Object.prototype.hasOwnProperty.call(estado.dom.campos, campo)) {
        estado.dom.campos[campo].addEventListener('input', guardarBorrador);
      }
    }
  }

  SGC.views.wizard = {
    montar: montar,
    seleccionarOperador: seleccionarOperador,
    renderOperadores: function (padron) {
      var lista = estado.dom.listaOperadores;
      lista.textContent = '';
      var usuarios = padron.usuarios || [];
      for (var i = 0; i < usuarios.length; i++) {
        if (!usuarios[i].activo) {
          continue;
        }
        (function (operador) {
          var li = document.createElement('li');
          var boton = document.createElement('button');
          boton.type = 'button';
          boton.className = 'operador';
          var linea = document.createElement('span');
          linea.className = 'operador-nombre';
          linea.textContent = operador.nombre + ' ' + operador.apellido;
          var detalle = document.createElement('span');
          detalle.className = 'operador-detalle';
          detalle.textContent = operador.roles.join(', ') + ' · ' + operador.email;
          boton.appendChild(linea);
          boton.appendChild(detalle);
          boton.addEventListener('click', function () {
            seleccionarOperador(operador, estado.repo);
          });
          li.appendChild(boton);
          lista.appendChild(li);
        })(usuarios[i]);
      }
    },
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    vincularRenglones: function () {
      SGC.catalogo.renglones.montar({
        listaRenglones: qs(estado.dom.raiz, '#sgc-lista-renglones'),
        resumen: qs(estado.dom.raiz, '#sgc-resumen'),
        onCambio: guardarBorrador
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
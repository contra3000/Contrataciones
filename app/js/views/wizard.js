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
  var formulario = SGC.views.wizardFormulario;

  var estado = {
    operador: null,
    repo: null,
    datos: { identificacion: {}, renglones: [], fundamentacion: {} },
    paso: 0,
    persistido: false,
    alRender: null,
    importador: null,
    alImportar: null,
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function sincronizarDesdeFormulario() {
    formulario.sincronizar(estado);
  }

  function guardarBorrador() {
    formulario.guardarBorrador(estado, storage());
  }

  function storage() {
    return root.sessionStorage;
  }

  function mostrarErrores(errores) {
    formulario.mostrarErrores(estado, errores);
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
    // La última pantalla cambia cuando cambia el paso (ORDEN-RONDA-28 §3): quien
    //	use el asistente para calcular algo sobre los mismos datos —el generador
    // con sus documentos— se entera acá sin tener que adivinar cuándo se
    //  actualizaron.
    if (typeof estado.alRender === 'function') {
      estado.alRender(estado.paso);
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
    formulario.ofrecer(estado, registro);
  }

  function retomarBorrador(registro) {
    formulario.retomar(estado, registro, irAPaso);
  }

  function descartarBorrador() {
    formulario.descartar(estado, storage());
  }

  function aplicarDatosAlFormulario() {
    formulario.aplicar(estado);
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
    estado.dom.operadorActual.textContent = descripcionOperador(operador);
    renderPaso();
    var registro = borrador.leer(storage());
    if (registro && registro.operador === operador.email) {
      ofrecerBorrador(registro);
    }
  }

  /*
 * Cómo se ve el operador, arriba de todo (ORDEN-RONDA-29 pieza 2).
 *
 * El generador declara cuatro datos: grado, nombre, apellido y número de
 * control. Los del padrón no tienen grado ni número de control, así que se
 * suman sólo si están: la línea es la misma para las dos aplicaciones, y en
 * el generador el correo interno no se muestra porque ya están los cuatro
 * datos y el número de control es lo que identifica a la persona.
 */
function descripcionOperador(operador) {
    var quien = [operador.grado, operador.nombre, operador.apellido]
      .filter(function (parte) { return Boolean(parte); })
      .join(' ');
    var linea = quien + ' (' + operador.roles.join(', ') + ')';
    if (typeof operador.numeroControl === 'number') {
      return linea + ' · ' + SGC.core.utils.numeroConPuntos(operador.numeroControl);
    }
    return linea + ' — ' + operador.email;
  }

  /*
   * ORDEN-RONDA-28 §4: el importador es intercambiable.
   *
   * Por defecto es el Fast-Track de siempre, con la existencia de los códigos
   * validada por el servidor (repo.validarCodigos, ORDEN-RONDA-06 §2.2). El
   * generador pasa el suyo, que además acepta un requerimiento exportado antes y
   * resuelve los códigos contra el catálogo local: sin servidor no hay a quién
   * preguntarle (ADR-044).
   *
   * Lo que NO cambia con el importador es el resto: leer el archivo, aplicar los
   * datos al formulario, registrar los códigos, cargar los renglones, avisar y
   * abrir el paso 2. Eso vive acá una sola vez para las dos aplicaciones.
   */
  function leerArchivo(texto) {
    if (typeof estado.importador === 'function') {
      return Promise.resolve(estado.importador(texto));
    }
    return importarFasttrack(texto);
  }

  // El camino del servidor: estructura y tipos primero con verificación de
  // códigos en blanco (un archivo mal formado se rechaza sin tocar la red), y
  // después la existencia de los códigos contra el catálogo del servidor.
  function importarFasttrack(texto) {
    var estructural = fasttrack.importar(texto, function () {
      return true;
    });
    if (!estructural.ok) {
      return Promise.resolve({ ok: false, errores: estructural.errores });
    }
    var codigos = estructural.datos.renglones.map(function (r) {
      return r.codigo;
    });
    if (!estado.repo || typeof estado.repo.validarCodigos !== 'function') {
      return Promise.resolve({
        ok: false,
        errores: ['No se pudo validar el archivo: el servidor de catálogo no está disponible. ' +
          'El archivo no se importa.']
      });
    }
    return estado.repo.validarCodigos(codigos).then(function (respuesta) {
      var verificar = function (codigo) {
        return respuesta.invalidos.indexOf(codigo) === -1;
      };
      var resultado = fasttrack.importar(texto, verificar);
      if (!resultado.ok) {
        return { ok: false, errores: resultado.errores };
      }
      return {
        ok: true,
        datos: resultado.datos,
        mensaje: 'Modelo importado correctamente. Revisá los pasos y seguí.'
      };
    });
  }

  function avisarFasttrack(texto) {
    estado.dom.fasttrackMsj.textContent = texto;
    estado.dom.fasttrackMsj.hidden = false;
  }

  /*
   * Aplicar una importación que ya pasó las reglas y llega como
   * {datos, mensaje, avisos}. Es lo que usan el Fast-Track del servidor y el
   * importador del generador: una sola implementación, para que importar en una
   * aplicación y en la otra termine en el mismo estado del formulario.
   */
  function aplicarImportacion(resultado) {
    estado.datos = resultado.datos;
    estado.datos.identificacion.operador = estado.operador.email;
    aplicarDatosAlFormulario();
    SGC.catalogo.indice.registrarCodigos(estado.datos.renglones);
    SGC.catalogo.renglones.cargar(estado.datos.renglones);
    // Lo que el archivo trae y el formulario no tiene (presupuestos de
    // referencia y valores, en el generador). Se avisa después de cargar los
    // renglones y antes de avisar, para que la pantalla muestre el resultado
    // final.
    if (typeof estado.alImportar === 'function') {
      estado.alImportar(resultado);
    }
    guardarBorrador();
    var texto = resultado.mensaje || 'Archivo importado. Revisá los pasos y seguí.';
    if (Array.isArray(resultado.avisos) && resultado.avisos.length > 0) {
      texto = texto + ' ' + resultado.avisos.join(' ');
    }
    avisarFasttrack(texto);
    estado.dom.archivoModelo.value = '';
    /*
     * ORDEN-RONDA-30 §2: un avance se abre donde quedó, no en el paso 2 como
     * los demás archivos. Es lo que trae `paso` en su sello, y es lo único que
     * distingue la importación de un avance de la de una plantilla o de un
     * requerimiento exportado: los datos entran por el mismo lado.
     */
    var paso = typeof resultado.paso === 'number' ? resultado.paso : 1;
    irAPaso(paso, false);
  }

  /*
   * ORDEN-RONDA-33 pieza 1: el texto pegado de un asistente suele venir
   * envuelto en un bloque ```json ... ``` o con una frase antes o después. Se
   * recorta a lo que hay entre la primera llave y la última para que ese caso no
   * falle, sin inventar nada: si no hay llaves, se intenta tal cual.
   */
  function textoEntreLlaves(texto) {
    var inicio = texto.indexOf('{');
    var fin = texto.lastIndexOf('}');
    if (inicio === -1 || fin === -1 || fin < inicio) {
      return texto;
    }
    return texto.slice(inicio, fin + 1);
  }

  function procesarTexto(texto) {
    estado.dom.fasttrackMsj.hidden = true;
    leerArchivo(textoEntreLlaves(String(texto))).then(function (resultado) {
      if (!resultado || !resultado.ok) {
        avisarFasttrack('No se pudo importar el archivo:\n' +
          ((resultado && resultado.errores) || ['el archivo no se pudo leer']).join('\n'));
        return;
      }
      aplicarImportacion(resultado);
    }).catch(function (err) {
      avisarFasttrack('No se pudo validar el archivo: ' +
        (err && err.message ? err.message : 'error de red') +
        '. El archivo no se importa.');
    });
  }

  function importarModelo() {
    var archivo = estado.dom.archivoModelo.files && estado.dom.archivoModelo.files[0];
    if (!archivo) {
      return;
    }
    var lector = new FileReader();
    lector.onload = function () {
      procesarTexto(lector.result);
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

  function montar(raiz, opciones) {
    estado.dom.raiz = raiz;
    // ORDEN-RONDA-28 §4: quien lo monta puede cambiar sólo la lectura del
    // archivo (opciones.importador) y enterarse de que terminó (opciones.alImportar).
    // Sin opciones, el comportamiento es el de siempre.
    var opcionesMontaje = opciones || {};
    estado.importador = typeof opcionesMontaje.importador === 'function'
      ? opcionesMontaje.importador : null;
    estado.alImportar = typeof opcionesMontaje.alImportar === 'function'
      ? opcionesMontaje.alImportar : null;
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
    // ORDEN-RONDA-31 pieza 2d: la lista de renglones, para que al fallar la
    // validación el foco pueda ir al campo concreto del renglón con error.
    estado.dom.listaRenglones = qs(raiz, '#sgc-lista-renglones');
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
    // ORDEN-RONDA-33 pieza 1: pegar el texto del asistente sin pasar por un
    // archivo. Vive sólo en la pantalla del generador; en la aplicación con
    // servidor estos elementos no existen y no se engancha nada.
    var botonPegar = qs(raiz, '#sgc-btn-pegar');
    var panelPegar = qs(raiz, '#sgc-pegar-panel');
    if (botonPegar && panelPegar) {
      botonPegar.addEventListener('click', function () {
        panelPegar.hidden = !panelPegar.hidden;
      });
    }
    var campoPegar = qs(raiz, '#sgc-pegar-json');
    var botonCargarPegado = qs(raiz, '#sgc-btn-cargar-pegado');
    if (campoPegar && botonCargarPegado) {
      botonCargarPegado.addEventListener('click', function () {
        procesarTexto(campoPegar.value);
      });
    }
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
    /*
     * ORDEN-RONDA-31 pieza 2c: "Año" acepta letras.
     *
     * El campo es de texto (la validación de validacion.js sigue pidiendo los
     * cuatro dígitos y no cambia), pero lo que no sea dígito se descarta
     * mientras se escribe, como en un campo numérico. El listener va ANTES del
     * del borrador para que el borrador guarde el valor ya limpio.
     */
    if (estado.dom.campos.anio) {
      estado.dom.campos.anio.addEventListener('input', function () {
        var campo = estado.dom.campos.anio;
        var bruto = campo.value === undefined || campo.value === null ? '' : String(campo.value);
        var limpio = bruto.replace(/\D/g, '');
        if (bruto !== limpio) {
          campo.value = limpio;
        }
      });
    }
    for (var campo in estado.dom.campos) {
      if (Object.prototype.hasOwnProperty.call(estado.dom.campos, campo)) {
        estado.dom.campos[campo].addEventListener('input', guardarBorrador);
      }
    }
  }

  SGC.views.wizard = {
    montar: montar,
    seleccionarOperador: seleccionarOperador,
    alImportar: function (fn) {
      estado.alImportar = fn;
    },
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
    // ORDEN-RONDA-20 §1.4 (H4): al salir la sesión no queda operador vivo en
    // la vista; el próximo ingreso parte de un estado limpio.
    limpiarOperador: function () {
      estado.operador = null;
      estado.datos = { identificacion: {}, renglones: [], fundamentacion: {} };
      estado.paso = 0;
      estado.persistido = false;
      if (estado.dom.borradorAviso) {
        estado.dom.borradorAviso.hidden = true;
      }
    },
    vincularRenglones: function () {
      SGC.catalogo.renglones.montar({
        listaRenglones: qs(estado.dom.raiz, '#sgc-lista-renglones'),
        resumen: qs(estado.dom.raiz, '#sgc-resumen'),
        onCambio: guardarBorrador
      });
    },
    pasoActual: function () {
      return estado.paso;
    },
    // ORDEN-RONDA-28 §3: el generador calcula sus documentos sobre los mismos
    // datos del asistente, sin copiarlos ni mantenerlos aparte. Estos tres
    // accesores son toda la superficie que necesita: leer, sincronizar y
    // avisarse de un cambio de paso. La aplicación con servidor no los usa.
    alRender: function (fn) {
      estado.alRender = fn;
    },
    datos: function () {
      return estado.datos;
    },
    sincronizar: function () {
      sincronizarDesdeFormulario();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
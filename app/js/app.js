/*
 * app.js
 * Arranque de la aplicación (ORDEN-RONDA-05 §3.5 y ORDEN-RONDA-06 §3):
 * padrón de operadores, asistente de la Especificación Técnica con el
 * buscador embebido, tablero Kanban (una columna por fase) y vista de
 * expediente con Avanzar / Devolver, contra server/servidor.js.
 *
 * ORDEN-RONDA-13: cablea el reuso de base (ADR-025) y el diálogo de
 * sugerencias del piloto (H19), que solo existe en modo piloto.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;

  var estadoConfig = null;
  var operadorActual = null;

  function mostrarError(texto) {
    var nodo = document.getElementById('sgc-app-error');
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
  }

  function esconderTodas() {
    document.getElementById('sgc-app').hidden = true;
    document.getElementById('sgc-kanban').hidden = true;
    document.getElementById('sgc-expediente').hidden = true;
    document.getElementById('sgc-archivo').hidden = true;
    document.getElementById('sgc-base-revision').hidden = true;
    document.getElementById('sgc-sugerencias-jefe').hidden = true;
  }

  function alternarAlta() {
    esconderTodas();
    document.getElementById('sgc-app').hidden = false;
  }

  function alternarTablero() {
    esconderTodas();
    document.getElementById('sgc-kanban').hidden = false;
    SGC.views.kanban.refrescar();
  }

  function alternarArchivo() {
    esconderTodas();
    document.getElementById('sgc-archivo').hidden = false;
    SGC.views.archivo.refrescar();
  }

  function alternarSugerencias() {
    esconderTodas();
    document.getElementById('sgc-sugerencias-jefe').hidden = false;
    SGC.views.sugerenciasJefe.refrescar();
  }

  // El enlace del Jefe solo vale en modo piloto y con el rol adecuado: el
  // Jefe de Contrataciones es el responsable del diálogo (H19).
  function actualizarNavJefe(operador) {
    var nav = document.getElementById('sgc-nav-sugerencias');
    if (!nav) {
      return;
    }
    var esJefe = operador && Array.isArray(operador.roles) &&
      operador.roles.indexOf('contrataciones_supervisor') !== -1;
    nav.hidden = !(estadoConfig && estadoConfig.modoPiloto === true && esJefe);
  }

  function descargadorGenerico(nombre, contenido) {
    var blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  function operadorSeleccionado(operador) {
    operadorActual = operador;
    // La vista de expediente necesita los roles del operador para habilitar o
    // no los botones. El tablero es de visibilidad global (ADR-010).
    SGC.views.expediente.seleccionarOperador(operador);
    SGC.views.exportar.seleccionarOperador(operador);
    SGC.views.requerimientoFormulario.seleccionarOperador(operador);
    if (SGC.views.anexoUno) { SGC.views.anexoUno.seleccionarOperador(operador); }
    SGC.views.usarBase.fijarOperador(operador);
    SGC.views.sugerencias.fijarOperador(operador);
    SGC.views.sugerenciasJefe.fijarOperador(operador);
    actualizarNavJefe(operador);
    document.getElementById('sgc-tablero-nav').hidden = false;
  }

  // ORDEN-RONDA-14 §3.1/§3.5 (ADR-033): el padrón declara UN rol; las vistas
  // viejas consumen `roles`. Con el conjunto efectivo, un supervisor ve los
  // pasos de su supervisado como hoy (matriz de la batería).
  function rolesDe(rol) {
    return SGC.core.config.rolesEfectivos(rol);
  }

  // Operador derivado de una sesión autenticada del servidor.
  function operadorDeSesion(sesion) {
    var partes = (sesion.nombre || '').split(' ');
    return {
      email: sesion.email,
      rol: sesion.rol,
      sector: sesion.equipo || null,
      nombre: partes[0] || sesion.email,
      apellido: partes.slice(1).join(' '),
      roles: rolesDe(sesion.rol)
    };
  }

  // Entrar (modo autenticado): oculta la pantalla de ingreso/cambio de clave,
  // activa las vistas y muestra la barra de sesión con el operador a la vista.
  function entrar(operador) {
    var seleccion = document.getElementById('sgc-seleccion-operador');
    if (seleccion) {
      seleccion.hidden = true;
    }
    var cambio = document.getElementById('sgc-cambio-clave-forma');
    if (cambio) {
      cambio.hidden = true;
    }
    var barra = document.getElementById('sgc-sesion-barra');
    if (barra) {
      barra.hidden = false;
      var quien = document.getElementById('sgc-sesion-quien');
      quien.textContent = operador.nombre + ' ' + operador.apellido +
        ' — ' + rolesDe(operador.rol).join(', ') + ' — ' + operador.email;
    }
    operadorSeleccionado(operador);
  }

  function iniciar() {
    var contenedor = document.getElementById('app');
    if (!contenedor) {
      throw new Error('No se encontró el contenedor #app');
    }

    var repo = SGC.adapters.repoHttp.crear(root.location.origin);
    SGC.adapters.repo.usar(repo);

    SGC.views.wizard.montar(contenedor);
    SGC.views.wizard.fijarRepo(repo);
    SGC.views.kanban.montar(contenedor);
    SGC.views.kanban.fijarRepo(repo);
    SGC.views.kanban.onAbrir(function (id) {
      esconderTodas();
      document.getElementById('sgc-expediente').hidden = false;
      SGC.views.expediente.abrir(id);
    });
    SGC.views.expediente.montar(contenedor);
    SGC.views.expediente.fijarRepo(repo);
    SGC.views.expediente.onVolver(alternarTablero);

    // Archivo Histórico (ORDEN-RONDA-08 §2.2): vista de sólo lectura que abre
    // el expediente archivado en la vista de expediente (que deshabilita las
    // operaciones cuando `archivado`).
    SGC.views.archivo.montar(contenedor);
    SGC.views.archivo.fijarRepo(repo);
    SGC.views.archivo.onAbrir(function (id) {
      esconderTodas();
      document.getElementById('sgc-expediente').hidden = false;
      SGC.views.expediente.abrir(id);
    });
    // Reuso de base (ADR-025, ORDEN-RONDA-13 §4): desde una entrada del
    // archivo se revisa la lista blanca y se crea el expediente nuevo.
    SGC.views.usarBase.montar(contenedor);
    SGC.views.usarBase.fijarRepo(repo);
    SGC.views.usarBase.onVolver(alternarArchivo);
    SGC.views.usarBase.onCreado(function (id) {
      esconderTodas();
      document.getElementById('sgc-expediente').hidden = false;
      SGC.views.expediente.abrir(id);
    });
    SGC.views.archivo.onUsarBase(function (id) {
      esconderTodas();
      document.getElementById('sgc-base-revision').hidden = false;
      SGC.views.usarBase.abrir(id);
    });

    // Documento y exportación (ORDEN-RONDA-07 §3.2-§3.4): imprime, guarda el
    // documento generado en la carpeta del expediente y exporta JSON o
    // resumen.md. Las descargas pasan por el modal de advertencia (FSD §6).
    SGC.views.exportar.montar(contenedor);
    SGC.views.exportar.fijarRepo(repo);
    SGC.views.exportar.fijarProveedor(function () {
      return SGC.views.expediente.obtener();
    });
    SGC.views.exportar.fijarDescargador(descargadorGenerico);
    SGC.views.exportar.fijarNavegador(function (url) {
      window.open(url, '_blank');
    });

    // Carga del requerimiento (ORDEN-RONDA-10 §3.1): formulario, valores y
    // presupuestos dentro de la vista de expediente. La vista de expediente
    // le avisa en cada render (requerimientoFormulario.actualizar()).
    SGC.views.requerimientoFormulario.montar(contenedor);
    SGC.views.requerimientoFormulario.fijarRepo(repo);

    // ANEXO 1 (ORDEN-RONDA-11 §3.1): formulario para abastecimiento en ANALISIS_SCo.
    SGC.views.anexoUno.montar(contenedor);
    SGC.views.anexoUno.fijarRepo(repo);

    // Sugerencias del piloto (H19, ORDEN-RONDA-13 §6): el FAB solo se crea
    // cuando config/aplicacion.json llega con modoPiloto true; la vista del
    // Jefe se cablea siempre (las secciones controlan su visibilidad).
    SGC.views.sugerencias.fijarRepo(repo);
    SGC.views.sugerenciasJefe.montar(contenedor);
    SGC.views.sugerenciasJefe.fijarRepo(repo);
    SGC.views.sugerenciasJefe.fijarDescargador(descargadorGenerico);
    SGC.views.sugerenciasJefe.onVolver(alternarTablero);

    // El buscador del paso 2 inicia la carga del catálogo y actualiza su
    // propio estado. Después se le avisa al asistente para guardar borradores
    // cuando cambie un renglón.
    var panelRenglones = document.getElementById('sgc-paso-renglones');
    SGC.catalogo.buscador.montar(panelRenglones);
    SGC.views.wizard.vincularRenglones();

    document.getElementById('sgc-nav-alta').addEventListener('click', alternarAlta);
    document.getElementById('sgc-nav-tablero').addEventListener('click', alternarTablero);
    document.getElementById('sgc-nav-archivo').addEventListener('click', alternarArchivo);
    document.getElementById('sgc-nav-sugerencias').addEventListener('click', alternarSugerencias);

    // Configuración de la aplicación: el modo piloto es la fuente de verdad
    // de que el diálogo de sugerencias exista en el DOM.
    fetch('config/aplicacion.json').then(function (res) {
      if (!res.ok) {
        throw new Error('el servidor respondió estado ' + res.status);
      }
      return res.json();
    }).then(function (config) {
      estadoConfig = config;
      SGC.views.sugerencias.fijarConfig(config);
      SGC.views.sugerencias.montar(contenedor);
      actualizarNavJefe(operadorActual);
    }).catch(function (err) {
      mostrarError('No se pudo cargar la configuración: ' + err.message);
    });

    // Padrón de operadores (ADR-017): se sirve desde config/. En modo
    // declarado (sin padrón con credenciales) se arma la lista de botones.
    // ORDEN-RONDA-14 §3.1: el padrón declara un solo rol; las vistas viejas
    // consumen `roles`, así que se normaliza con el conjunto efectivo.
    function cargarPadronDeclarado() {
      fetch('config/usuarios.ejemplo.json').then(function (res) {
        if (!res.ok) {
          throw new Error('el servidor respondió estado ' + res.status);
        }
        return res.json();
      }).then(function (padron) {
        var usuarios = (padron.usuarios || []).filter(function (u) {
          return u.activo;
        });
        for (var i = 0; i < usuarios.length; i++) {
          usuarios[i].roles = rolesDe(usuarios[i].rol);
          usuarios[i].sector = usuarios[i].sector || null;
        }
        SGC.views.wizard.renderOperadores({ usuarios: usuarios });
        var lista = document.getElementById('sgc-lista-operadores');
        for (var j = 0; j < usuarios.length; j++) {
          (function (operador, indice) {
            var boton = lista.children[indice].querySelector('button');
            boton.addEventListener('click', function () {
              operadorSeleccionado(operador);
            });
          })(usuarios[j], j);
        }
      }).catch(function (err) {
        mostrarError('No se pudo cargar el padrón de operadores: ' + err.message);
      });
    }

    // -----------------------------------------------------------------------
    // Sesión del operador (ORDEN-RONDA-14 §3.4-§3.6, ADR-033)
    // -----------------------------------------------------------------------
    SGC.views.ingreso.montar(contenedor);
    SGC.views.cambioClave.montar(contenedor);

    document.getElementById('sgc-ingreso').addEventListener('submit', function (ev) {
      ev.preventDefault();
      SGC.views.ingreso.enviar().then(function (resultado) {
        if (resultado.estado !== 200) {
          SGC.views.ingreso.mostrarError(resultado.datos && resultado.datos.error);
          return;
        }
        if (resultado.datos.provisoria) {
          // La clave provisoria no opera: sólo cambiar la clave, salir y ver.
          SGC.views.ingreso.mostrar(false);
          SGC.views.cambioClave.mostrar(true);
          return;
        }
        entrar(operadorDeSesion(resultado.datos));
      }).catch(function () {
        // mostrarError ya avisó al operador
      });
    });

    document.getElementById('sgc-cambio-clave-forma').addEventListener('submit', function (ev) {
      ev.preventDefault();
      SGC.views.cambioClave.enviar().then(function (resultado) {
        if (resultado.estado !== 200) {
          SGC.views.cambioClave.mostrarError(resultado.datos && resultado.datos.error);
          return;
        }
        SGC.adapters.sesion.actualDeSesion().then(function (r) {
          if (r.estado === 200 && r.datos && r.datos.autenticado) {
            entrar(operadorDeSesion(r.datos));
          } else {
            SGC.views.cambioClave.mostrarError('la sesión no quedó activa; vuelva a ingresar');
          }
        }).catch(function () {
          SGC.views.cambioClave.mostrarError('no se pudo confirmar la sesión');
        });
      }).catch(function () {
        // mostrarError ya avisó al operador
      });
    });

    document.getElementById('sgc-sesion-salir').addEventListener('click', function () {
      SGC.adapters.sesion.salir().then(function () {
        location.reload();
      }).catch(function () {
        location.reload();
      });
    });

    // El servidor decide si hay padrón con credenciales (/api/salud). Con él,
    // la pantalla de ingreso reemplaza la lista y la cookie reanuda sesión.
    SGC.adapters.sesion.detectarModo().then(function (autenticado) {
      if (!autenticado) {
        cargarPadronDeclarado();
        return;
      }
      SGC.views.ingreso.mostrar(true);
      SGC.adapters.sesion.actualDeSesion().then(function (r) {
        if (r.estado === 200 && r.datos && r.datos.autenticado) {
          entrar(operadorDeSesion(r.datos));
        }
      }).catch(function () {
        // sin sesión: la pantalla de ingreso queda esperando
      });
    }).catch(function (err) {
      mostrarError('No se pudo consultar el estado del servidor: ' + err.message);
      cargarPadronDeclarado();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
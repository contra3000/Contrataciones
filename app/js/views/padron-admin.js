/*
 * padron-admin.js
 * ORDEN-RONDA-18-BIS. Vista del Administrador del sistema sobre el padrón.
 *
 * Lista operadores, da de alta con formulario inline y muestra la clave
 * generada, cambia rol, repone clave (mostrando la repuesta), desbloquea,
 * da de baja/reactiva y marca administradores, y exporta/importa el padrón
 * como CSV con selector de archivo y visualización de claves creadas.
 *
 * El contexto sale de la sesión del lado del servidor: la vista se apaga
 * sola si el adaptador activo no expone `padronAdmin` o faltan los elementos
 * del DOM (así nunca rompe a los operadores no admin).
 *
 * Sin innerHTML: filas, avisos y formularios se arman con createElement y
 * textContent.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('padron-admin.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    descargar: null,
    onVolver: null,
    usuarios: [],
    roles: [],
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

  function informar(mensaje) {
    estado.dom.error.textContent = mensaje;
    estado.dom.error.hidden = false;
  }

  function contexto() {
    return null;
  }

  function rolRoot() {
    return 'contrataciones_supervisor';
  }

  // --- Copiar al portapapeles ---
  function copiarAlPortapapeles(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  // --- Bloque de clave (§1.1, §1.2, §1.3) ---
  // Registros: [{ email, clave }, ...]. Queda en pantalla hasta que la persona
  // lo cierre; se puede seleccionar con el mouse; dice que es la única vez;
  // tiene botón Copiar.
  function mostrarClave(registros) {
    var bloque = estado.dom.clave;
    limpiar(bloque);
    var aviso = document.createElement('p');
    aviso.textContent = 'Atención: esta clave se muestra una sola vez. Si no la anotó, genere una nueva con "Reponer clave".';
    bloque.appendChild(aviso);
    for (var i = 0; i < registros.length; i++) {
      var linea = document.createElement('p');
      linea.textContent = registros[i].email + ' — ' + registros[i].clave;
      linea.style.userSelect = 'all';
      bloque.appendChild(linea);
    }
    var btnCopiar = document.createElement('button');
    btnCopiar.type = 'button';
    btnCopiar.textContent = registros.length > 1 ? 'Copiar todo' : 'Copiar';
    btnCopiar.addEventListener('click', function () {
      var texto = registros.map(function (r) { return r.email + '\t' + r.clave; }).join('\n');
      copiarAlPortapapeles(texto).then(function () {
        btnCopiar.textContent = 'Copiado';
        setTimeout(function () {
          btnCopiar.textContent = registros.length > 1 ? 'Copiar todo' : 'Copiar';
        }, 2000);
      });
    });
    bloque.appendChild(btnCopiar);
    var btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.textContent = 'Cerrar';
    btnCerrar.addEventListener('click', function () {
      bloque.hidden = true;
    });
    bloque.appendChild(btnCerrar);
    bloque.hidden = false;
  }

  // --- Helper: grupo de campo de formulario ---
  function campoGrupo(formulario, id, label, tipo, obligatorio) {
    var grupo = document.createElement('div');
    grupo.className = 'campo-formulario';
    var lbl = document.createElement('label');
    lbl.setAttribute('for', 'sgc-alta-' + id);
    lbl.textContent = label + (obligatorio ? ' *' : '');
    grupo.appendChild(lbl);
    var input = document.createElement('input');
    input.type = tipo;
    input.id = 'sgc-alta-' + id;
    input.name = id;
    if (obligatorio) input.required = true;
    grupo.appendChild(input);
    var err = document.createElement('span');
    err.className = 'campo-error';
    err.id = 'sgc-alta-' + id + '-error';
    grupo.appendChild(err);
    formulario.appendChild(grupo);
    return input;
  }

  // --- Formulario inline de alta (§2.1) ---
  function mostrarFormularioAlta() {
    var formulario = estado.dom.formulario;
    limpiar(formulario);
    campoGrupo(formulario, 'nombre', 'Nombre', 'text', true);
    campoGrupo(formulario, 'apellido', 'Apellido', 'text', true);
    campoGrupo(formulario, 'email', 'Correo', 'email', true);
    campoGrupo(formulario, 'sector', 'Sector', 'text', false);
    // Rol como desplegable
    var grupoRol = document.createElement('div');
    grupoRol.className = 'campo-formulario';
    var lblRol = document.createElement('label');
    lblRol.setAttribute('for', 'sgc-alta-rol');
    lblRol.textContent = 'Rol *';
    grupoRol.appendChild(lblRol);
    var sel = document.createElement('select');
    sel.id = 'sgc-alta-rol';
    sel.name = 'rol';
    sel.required = true;
    var roles = SGC.core.config.ROLES;
    for (var r = 0; r < roles.length; r++) {
      var opt = document.createElement('option');
      opt.value = roles[r].id;
      opt.textContent = roles[r].nombre;
      if (roles[r].id === rolRoot()) opt.selected = true;
      sel.appendChild(opt);
    }
    grupoRol.appendChild(sel);
    var errRol = document.createElement('span');
    errRol.className = 'campo-error';
    errRol.id = 'sgc-alta-rol-error';
    grupoRol.appendChild(errRol);
    formulario.appendChild(grupoRol);
    // Error general
    var errGen = document.createElement('p');
    errGen.className = 'campo-error';
    errGen.id = 'sgc-alta-error-general';
    formulario.appendChild(errGen);
    // Botones
    var botones = document.createElement('div');
    botones.className = 'campo-formulario';
    var btnGuardar = document.createElement('button');
    btnGuardar.type = 'button';
    btnGuardar.className = 'primario';
    btnGuardar.textContent = 'Guardar';
    btnGuardar.addEventListener('click', function () {
      var ids = ['nombre', 'apellido', 'email', 'sector', 'rol'];
      var errores = 0;
      for (var i = 0; i < ids.length; i++) {
        document.getElementById('sgc-alta-' + ids[i] + '-error').textContent = '';
      }
      errGen.textContent = '';
      var nombre = document.getElementById('sgc-alta-nombre').value.trim();
      var apellido = document.getElementById('sgc-alta-apellido').value.trim();
      var email = document.getElementById('sgc-alta-email').value.trim();
      var sector = document.getElementById('sgc-alta-sector').value.trim();
      var rol = document.getElementById('sgc-alta-rol').value;
      if (!nombre) { document.getElementById('sgc-alta-nombre-error').textContent = 'Requerido'; errores++; }
      if (!apellido) { document.getElementById('sgc-alta-apellido-error').textContent = 'Requerido'; errores++; }
      if (!email) { document.getElementById('sgc-alta-email-error').textContent = 'Requerido'; errores++; }
      if (!rol) { document.getElementById('sgc-alta-rol-error').textContent = 'Requerido'; errores++; }
      if (errores > 0) return;
      btnGuardar.disabled = true;
      estado.repo.padronAdmin.alta({
        nombre: nombre, apellido: apellido, email: email,
        sector: sector || undefined, rol: rol
      }).then(function (respuesta) {
        btnGuardar.disabled = false;
        formulario.hidden = true;
        var ya = respuesta && respuesta.yaExistentes && respuesta.yaExistentes.length > 0;
        informar(ya
          ? 'Ya estaban en el padrón: ' + respuesta.yaExistentes.join(', ') + '.'
          : 'Se dio de alta a ' + email + '.');
        if (respuesta && respuesta.clave) {
          mostrarClave([{ email: email, clave: respuesta.clave }]);
        }
        return refrescar();
      }).catch(function (err) {
        btnGuardar.disabled = false;
        errGen.textContent = 'No se pudo dar de alta: ' + err.message;
      });
    });
    botones.appendChild(btnGuardar);
    var btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', function () {
      formulario.hidden = true;
    });
    botones.appendChild(btnCancelar);
    formulario.appendChild(botones);
    formulario.hidden = false;
  }

  function refrescar() {
    if (!estado.repo || !estado.repo.padronAdmin || !estado.dom.lista) {
      return;
    }
    estado.dom.error.hidden = true;
    estado.dom.conteo.textContent = 'Cargando…';
    estado.repo.padronAdmin.listar().then(function (usuarios) {
      estado.usuarios = usuarios || [];
      var activos = 0;
      for (var i = 0; i < estado.usuarios.length; i++) {
        if (estado.usuarios[i].activo !== false) {
          activos++;
        }
      }
      estado.dom.conteo.textContent = estado.usuarios.length + ' operadores · ' + activos + ' activos';
      limpiar(estado.dom.lista);
      if (estado.usuarios.length === 0) {
        var vacio = document.createElement('tr');
        var vacioCelda = document.createElement('td');
        vacioCelda.colSpan = 5;
        vacioCelda.textContent = 'El padrón está vacío.';
        vacio.appendChild(vacioCelda);
        estado.dom.lista.appendChild(vacio);
        return;
      }
      for (var j = 0; j < estado.usuarios.length; j++) {
        (function (u) {
          var fila = document.createElement('tr');
          fila.className = 'padron-item' + (u.activo === false ? ' inactivo' : '');

          function celda(texto, clase) {
            var td = document.createElement('td');
            if (clase) td.className = clase;
            td.textContent = texto;
            fila.appendChild(td);
            return td;
          }

          celda(u.nombre + ' ' + (u.apellido || ''), 'padron-celda-operador');
          celda(u.email, 'padron-celda-correo');
          celda(u.rol + (u.administrador ? ' · administrador' : ''), 'padron-celda-rol');
          var estadoTexto = [];
          if (u.activo === false) estadoTexto.push('dado de baja');
          if (u.bloqueado) estadoTexto.push('bloqueado');
          if (u.provisoria) estadoTexto.push('clave provisoria');
          if (u.sector) estadoTexto.push(u.sector);
          celda(estadoTexto.join(' · ') || 'activo', 'padron-celda-estado');
          var celdasAcciones = document.createElement('td');
          celdasAcciones.className = 'padron-acciones';
          var acciones = document.createElement('div');
          acciones.className = 'padron-acciones-grupo';
          celdasAcciones.appendChild(acciones);
          fila.appendChild(celdasAcciones);

          function boton(texto, fn) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = texto;
            b.addEventListener('click', fn);
            acciones.appendChild(b);
          }

          boton('Reponer clave', function () {
            reponerClave(u.email);
          });
          if (u.bloqueado) {
            boton('Desbloquear', function () {
              accion(u.email, 'desbloquear', {}, 'Se desbloqueó a ' + u.email + '.');
            });
          }
          boton(u.rol === rolRoot() ? 'Cambiar rol' : 'Cambiar rol', function () {
            var nuevo = prompt('Nuevo rol de ' + u.email + ':', u.rol);
            if (nuevo && nuevo !== u.rol) {
              accion(u.email, 'rol', { rol: nuevo.trim() }, 'Rol de ' + u.email + ' cambiado a ' + nuevo.trim() + '.');
            }
          });
          boton(u.administrador ? 'Quitar administrador' : 'Marcar administrador', function () {
            accion(u.email, 'administrador', { administrador: !u.administrador }, 'Se actualizó la marca de administrador de ' + u.email + '.');
          });
          if (u.activo === false) {
            boton('Reactivar', function () {
              accion(u.email, 'reactivar', {}, 'Se reactivó a ' + u.email + '.');
            });
          } else {
            boton('Dar de baja', function () {
              accion(u.email, 'baja', {}, 'Se dio de baja a ' + u.email + '.');
            });
          }
          estado.dom.lista.appendChild(fila);
        })(estado.usuarios[j]);
      }
    }).catch(function (err) {
      informar('No se pudo leer el padrón: ' + err.message);
    });
  }

  function accion(email, nombreAccion, cuerpo, mensaje) {
    estado.dom.error.hidden = true;
    estado.repo.padronAdmin.accion(email, nombreAccion, cuerpo).then(function () {
      return refrescar();
    }).catch(function (err) {
      informar(mensaje + ' Error: ' + err.message);
    });
  }

  // §1.3: reposición de clave con visualización (no pasa por accion())
  function reponerClave(email) {
    estado.dom.error.hidden = true;
    estado.repo.padronAdmin.accion(email, 'clave', {}).then(function (respuesta) {
      mostrarClave([{ email: email, clave: respuesta.clave }]);
      return refrescar();
    }).catch(function (err) {
      informar('No se pudo reponer la clave de ' + email + '. Error: ' + err.message);
    });
  }

  function darAlta() {
    mostrarFormularioAlta();
  }

  function exportar() {
    estado.dom.error.hidden = true;
    estado.repo.padronAdmin.exportar().then(function (csv) {
      if (typeof estado.descargar === 'function') {
        estado.descargar('padron-operadores.csv', csv);
      }
    }).catch(function (err) {
      informar('No se pudo exportar el padrón: ' + err.message);
    });
  }

  // §1.2, §2.2: importación con selector de archivo y visualización de claves
  function importar() {
    var area = estado.dom.importar;
    limpiar(area);
    var instruccion = document.createElement('p');
    instruccion.textContent = 'Seleccione un archivo CSV o pegue el contenido del padrón (con encabezados; un operador por línea):';
    area.appendChild(instruccion);
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,text/csv';
    fileInput.id = 'sgc-padron-importar-archivo';
    area.appendChild(fileInput);
    var separador = document.createElement('p');
    separador.textContent = '— o pegue el texto —';
    area.appendChild(separador);
    var textarea = document.createElement('textarea');
    textarea.rows = 8;
    textarea.id = 'sgc-padron-importar-texto';
    textarea.placeholder = 'nombre;apellido;email;rol;sector;activo';
    area.appendChild(textarea);
    var botones = document.createElement('div');
    botones.className = 'campo-formulario';
    var btnProcesar = document.createElement('button');
    btnProcesar.type = 'button';
    btnProcesar.className = 'primario';
    btnProcesar.textContent = 'Procesar';
    btnProcesar.addEventListener('click', function () {
      var texto = textarea.value;
      if (!texto && fileInput.files && fileInput.files[0]) {
        var lector = new FileReader();
        lector.onload = function (evt) {
          textarea.value = evt.target.result;
          procesarImportacion(evt.target.result, area);
        };
        lector.readAsText(fileInput.files[0]);
        return;
      }
      if (!texto) {
        informar('Seleccione un archivo o pegue el contenido del CSV.');
        return;
      }
      procesarImportacion(texto, area);
    });
    botones.appendChild(btnProcesar);
    var btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', function () {
      area.hidden = true;
    });
    botones.appendChild(btnCancelar);
    area.appendChild(botones);
    area.hidden = false;
  }

  function procesarImportacion(csv, area) {
    estado.dom.error.hidden = true;
    // RONDA-18 §3.4: primero se prevee a quiénes desactivaría la importación.
    estado.repo.padronAdmin.importar(csv, false, true).then(function (prever) {
      var ausentes = Array.isArray(prever.ausentes) ? prever.ausentes : [];
      var desactivar = false;
      if (ausentes.length > 0) {
        var primerasDiez = ausentes.slice(0, 10).map(function (a) {
          return '  · ' + a.nombre + ' ' + a.apellido + ' <' + a.email + '>';
        }).join('\n');
        var resto = ausentes.length > 10
          ? '\n  … y ' + (ausentes.length - 10) + ' persona(s) más'
          : '';
        desactivar = confirm(
          'La importación desactivaría a ' + ausentes.length + ' operador(es) ' +
          'que no vienen en el CSV:\n' + primerasDiez + resto +
          '\n\n¿Los desactiva? (si dice que no, quedan como están)');
      }
      estado.repo.padronAdmin.importar(csv, desactivar).then(function (respuesta) {
        area.hidden = true;
        var resumen = [
          'Altas: ' + ((respuesta.creados && respuesta.creados.length) || 0),
          'Cambios: ' + ((respuesta.cambios && respuesta.cambios.length) || 0),
          'Ya existentes: ' + ((respuesta.yaExistentes && respuesta.yaExistentes.length) || 0),
          'Desactivados: ' + ((respuesta.desactivados && respuesta.desactivados.length) || 0)
        ].join(' · ');
        informar('Importación correcta. ' + resumen + '.');
        if (respuesta.creados && respuesta.creados.length > 0) {
          mostrarClave(respuesta.creados);
        }
        return refrescar();
      }).catch(function (err) {
        informar('No se pudo importar el padrón: ' + err.message);
      });
    }).catch(function (err) {
      informar('No se pudo importar el padrón: ' + err.message);
    });
  }

  function montar(raiz) {
    estado.dom.lista = qs(raiz, '#sgc-padron-lista');
    estado.dom.conteo = qs(raiz, '#sgc-padron-conteo');
    estado.dom.error = qs(raiz, '#sgc-padron-error');
    estado.dom.clave = qs(raiz, '#sgc-padron-clave');
    estado.dom.formulario = qs(raiz, '#sgc-padron-formulario');
    estado.dom.importar = qs(raiz, '#sgc-padron-importar-area');
    if (!estado.dom.lista || !estado.dom.conteo) {
      return;
    }
    qs(raiz, '#sgc-padron-refrescar').addEventListener('click', refrescar);
    qs(raiz, '#sgc-padron-alta').addEventListener('click', darAlta);
    qs(raiz, '#sgc-padron-exportar').addEventListener('click', exportar);
    qs(raiz, '#sgc-padron-importar').addEventListener('click', importar);
    qs(raiz, '#sgc-padron-volver').addEventListener('click', function () {
      if (typeof estado.onVolver === 'function') {
        estado.onVolver();
      }
    });
  }

  function fijarRoles(roles) {
    estado.roles = Array.isArray(roles) ? roles : [];
  }

  SGC.views.padronAdmin = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    fijarOperador: function (operador) {
      estado.operador = operador;
    },
    fijarRoles: fijarRoles,
    fijarDescargador: function (fn) {
      estado.descargar = fn;
    },
    onVolver: function (fn) {
      estado.onVolver = fn;
    },
    refrescar: refrescar
  };
})(typeof window !== 'undefined' ? window : globalThis);

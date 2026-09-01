/*
 * padron-admin.js
 * ORDEN-RONDA-17 §1.3 (H21). Vista del Administrador del sistema sobre el
 * padrón de operadores.
 *
 * Lista los operadores, da de alta, cambia rol, repone clave, desbloquea, da
 * de baja/reactiva y marca administradores, y exporta/importa el padrón como
 * CSV. El contexto sale de la sesión del lado del servidor: la vista se apaga
 * sola si el adaptador activo no expone `padronAdmin` o faltan los elementos
 * del DOM (así nunca rompe a los operadores no admin).
 *
 * Sin innerHTML: filas y avisos se arman con createElement y textContent.
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

  function camposDeNuevo() {
    var nombre = prompt('Nombre del operador:');
    if (!nombre) {
      return null;
    }
    var apellido = prompt('Apellido del operador:') || '';
    var email = prompt('Correo del operador:');
    if (!email) {
      return null;
    }
    var eleccion = estado.roles.length > 0;
    var rol = null;
    if (eleccion) {
      var entradas = estado.roles.map(function (r) {
        return r + ' (' + abreviaturaRol(r) + ')';
      }).join(', ');
      rol = prompt('Rol del operador. Disponibles: ' + entradas, rolRoot());
    } else {
      rol = prompt('Rol del operador:', rolRoot());
    }
    if (!rol) {
      return null;
    }
    return {
      nombre: nombre,
      apellido: apellido,
      email: email,
      rol: rol
    };
  }

  function abreviaturaRol(rol) {
    return rol.replace('_supervisor', ' (jefe)');
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
        var vacio = document.createElement('li');
        vacio.textContent = 'El padrón está vacío.';
        estado.dom.lista.appendChild(vacio);
        return;
      }
      for (var j = 0; j < estado.usuarios.length; j++) {
        (function (u) {
          var li = document.createElement('li');
          li.className = 'padron-item' + (u.activo === false ? ' inactivo' : '');
          var cabecera = document.createElement('p');
          cabecera.className = 'padron-cabecera';
          cabecera.textContent = u.nombre + ' ' + (u.apellido || '') +
            ' · ' + u.email + ' · ' + u.rol +
            (u.administrador ? ' · administrador' : '') +
            (u.activo === false ? ' · dado de baja' : '') +
            (u.bloqueado ? ' · bloqueado' : '') +
            (u.provisoria ? ' · clave provisoria' : '');
          li.appendChild(cabecera);
          if (u.sector) {
            var detalle = document.createElement('p');
            detalle.className = 'padron-detalle';
            detalle.textContent = 'Sector: ' + u.sector;
            li.appendChild(detalle);
          }
          var acciones = document.createElement('p');
          acciones.className = 'padron-acciones';
          li.appendChild(acciones);

          function boton(texto, fn) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = texto;
            b.addEventListener('click', fn);
            acciones.appendChild(b);
          }

          boton('Reponer clave', function () {
            accion(u.email, 'clave', {}, 'Se repuso la clave de ' + u.email + '.');
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
          estado.dom.lista.appendChild(li);
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

  function darAlta() {
    var datos = camposDeNuevo();
    if (!datos) {
      return;
    }
    estado.dom.error.hidden = true;
    estado.repo.padronAdmin.alta(datos).then(function (respuesta) {
      var ya = respuesta && respuesta.yaExistentes && respuesta.yaExistentes.length > 0;
      informar(ya
        ? 'Ya estaban en el padrón: ' + respuesta.yaExistentes.join(', ') + '. ' +
          (respuesta.altas && respuesta.altas.length > 0 ? 'Altas nuevas: ' + respuesta.altas.join(', ') : '')
        : 'Se dio de alta a ' + datos.email + '.');
      return refrescar();
    }).catch(function (err) {
      informar('No se pudo dar de alta: ' + err.message);
    });
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

  function importar() {
    var csv = prompt('Pegue el CSV del padrón (con encabezados; un operador por línea):');
    if (!csv) {
      return;
    }
    var desactivar = confirm('¿Desactivar los operadores del padrón que no aparecen en el CSV?');
    estado.dom.error.hidden = true;
    estado.repo.padronAdmin.importar(csv, desactivar).then(function (respuesta) {
      var resumen = [
        'Altas: ' + (respuesta.altas && respuesta.altas.length || 0),
        'Cambios: ' + (respuesta.cambios && respuesta.cambios.length || 0),
        'Ya existentes: ' + (respuesta.yaExistentes && respuesta.yaExistentes.length || 0),
        'Desactivados: ' + (respuesta.desactivados && respuesta.desactivados.length || 0)
      ].join(' · ');
      informar('Importación correcta. ' + resumen + '.');
      if (respuesta.errores && respuesta.errores.length > 0) {
        informar('Importación correcta con correcciones. ' + resumen +
          ' · Líneas corregidas: ' + respuesta.errores.join(', ') + '.');
      }
      return refrescar();
    }).catch(function (err) {
      informar('No se pudo importar el padrón: ' + err.message);
    });
  }

  function montar(raiz) {
    estado.dom.lista = qs(raiz, '#sgc-padron-lista');
    estado.dom.conteo = qs(raiz, '#sgc-padron-conteo');
    estado.dom.error = qs(raiz, '#sgc-padron-error');
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
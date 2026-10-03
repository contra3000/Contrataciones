/*
 * presupuestos.js
 * ORDEN-RONDA-28 §3 (ADR-044). Presupuestos del generador: NO se suben.
 *
 * En la aplicación con servidor, un presupuesto es un archivo que el operador
 * sube y que queda en la carpeta del expediente (views/requerimiento-presupuestos.js
 * llama a repo.subirPresupuesto). El generador no tiene servidor ni carpeta: no
 * hay dónde dejar el archivo, y fingir que sí lo hay sería una mentira que
 * aparece después, cuando alguien busca el PDF y no está.
 *
 * Lo que sí hay es la REFERENCIA: cómo se llamaba el archivo, de qué proveedor
 * era y de qué fecha. Con eso el valor de referencia se cita igual que en la
 * aplicación con servidor —el renglón guarda `presupuestoId`, y ese id es el de
 * esta lista (ADR-022)— y el PDF original sigue en la máquina de quien lo tuvo.
 *
 * Es una vista adaptada, no la del servidor: el contrato de los renglones es el
 * mismo, la carga del archivo no existe.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC) {
    throw new Error('generador/presupuestos.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    lista: [],
    siguiente: 1,
    dom: {},
    alCambio: null
  };

  function textoDe(p) {
    var partes = [p.nombreOriginal];
    if (p.proveedor) {
      partes.push(p.proveedor);
    }
    if (p.fecha) {
      partes.push(p.fecha);
    }
    return partes.join(' · ');
  }

  function avisar(mensaje) {
    if (estado.dom.msj) {
      estado.dom.msj.textContent = mensaje;
      estado.dom.msj.hidden = mensaje === '';
    }
  }

  function render() {
    var lista = estado.dom.lista;
    if (!lista) {
      return;
    }
    while (lista.children.length > 0) {
      lista.removeChild(lista.children[0]);
    }
    for (var i = 0; i < estado.lista.length; i++) {
      (function (p) {
        var li = document.createElement('li');
        li.className = 'req-presupuesto';
        li.setAttribute('data-presupuesto', p.id);
        var texto = document.createElement('span');
        texto.textContent = textoDe(p);
        li.appendChild(texto);
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'req-quitar-valor';
        quitar.setAttribute('data-quitar', p.id);
        quitar.setAttribute('aria-label', 'Quitar el presupuesto de referencia ' + p.nombreOriginal);
        quitar.textContent = 'Quitar';
        li.appendChild(quitar);
        lista.appendChild(li);
      })(estado.lista[i]);
    }
    if (typeof estado.alCambio === 'function') {
      estado.alCambio();
    }
  }

  // Agregar: el nombre del archivo es lo único obligatorio. Sin nombre no hay
  // qué citar, y una referencia sin nombre no sirve de referencia.
  function agregar() {
    var nombre = String(estado.dom.archivo.value || '').trim();
    if (nombre === '') {
      avisar('Escribí el nombre del archivo del presupuesto.');
      return;
    }
    estado.lista.push({
      id: idSiguiente(idsEnUso()),
      nombreOriginal: nombre,
      proveedor: String(estado.dom.proveedor.value || '').trim(),
      fecha: String(estado.dom.fecha.value || '').trim(),
      referencia: true
    });
    estado.dom.archivo.value = '';
    estado.dom.proveedor.value = '';
    estado.dom.fecha.value = '';
    avisar('');
    render();
  }

  function quitar(id) {
    for (var i = 0; i < estado.lista.length; i++) {
      if (estado.lista[i].id === id) {
        estado.lista.splice(i, 1);
        render();
        return;
      }
    }
  }

  /*
   * Cargar una lista venida de un archivo (ORDEN-RONDA-28 §4, pieza 4).
   *
   * Los ids se respetan: son la referencia que citan los valores de cada
   * renglón (presupuestoId, ADR-022), así que cambiarles el id al importar
   * dejaría citing un presupuesto que no está. Sólo se renumeran los que
   * vengan vacíos o repetidos, que es lo único que no se podría citar.
   */
  function cargar(lista) {
    estado.lista = [];
    estado.siguiente = 1;
    var vistos = {};
    var entrantes = Array.isArray(lista) ? lista : [];
    for (var i = 0; i < entrantes.length; i++) {
      var p = entrantes[i];
      if (!p || typeof p !== 'object') {
        continue;
      }
      var nombre = typeof p.nombreOriginal === 'string' ? p.nombreOriginal.trim() : '';
      if (nombre === '') {
        continue;
      }
      var id = typeof p.id === 'string' ? p.id.trim() : '';
      if (id === '' || Object.prototype.hasOwnProperty.call(vistos, id)) {
        id = idSiguiente(vistos);
      }
      vistos[id] = true;
      estado.lista.push({
        id: id,
        nombreOriginal: nombre,
        proveedor: typeof p.proveedor === 'string' ? p.proveedor : '',
        fecha: typeof p.fecha === 'string' ? p.fecha : '',
        referencia: true
      });
    }
    render();
    return estado.lista.length;
  }

  /*
   * El próximo id libre con el formato de esta vista (ref-1, ref-2, ...). El
   * contador arranca en 1 después de cargar: un archivo puede traer ids que no
   * son de esta forma, y el contador tiene que seguir después del último usado
   * para no repetir uno.
   */
  function idSiguiente(vistos) {
    var id = 'ref-' + estado.siguiente++;
    while (Object.prototype.hasOwnProperty.call(vistos, id)) {
      id = 'ref-' + estado.siguiente++;
    }
    return id;
  }

  function idsEnUso() {
    var mapa = {};
    for (var i = 0; i < estado.lista.length; i++) {
      mapa[estado.lista[i].id] = true;
    }
    return mapa;
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.archivo = raiz.querySelector('#sgc-presup-archivo');
    estado.dom.proveedor = raiz.querySelector('#sgc-presup-proveedor');
    estado.dom.fecha = raiz.querySelector('#sgc-presup-fecha');
    estado.dom.lista = raiz.querySelector('#sgc-presup-lista');
    estado.dom.msj = raiz.querySelector('#sgc-presup-msj');
    if (!estado.dom.archivo || !estado.dom.lista) {
      throw new Error('generador/presupuestos.js requiere #sgc-presup-archivo y #sgc-presup-lista');
    }
    raiz.querySelector('#sgc-presup-agregar').addEventListener('click', agregar);
    raiz.addEventListener('click', function (evento) {
      var objetivo = evento && evento.target;
      if (objetivo && objetivo.classList &&
          objetivo.classList.contains('req-quitar-valor') &&
          objetivo.getAttribute('data-quitar')) {
        quitar(objetivo.getAttribute('data-quitar'));
      }
    });
  }

  SGC.generadorPresupuestos = {
    montar: montar,
    cargar: cargar,
    listar: function () {
      return estado.lista.map(function (p) {
        return {
          id: p.id,
          nombreOriginal: p.nombreOriginal,
          proveedor: p.proveedor,
          fecha: p.fecha,
          referencia: true
        };
      });
    },
    // Los valores ya escritos apuntan a un presupuesto que se quitó: se limpian
    // para que el cálculo no insinúe una cita que ya no existe.
    alQuitar: function (id) {
      return estado.lista.every(function (p) {
        return p.id !== id;
      });
    },
    alCambio: function (fn) {
      estado.alCambio = fn;
    },
    limpiar: function () {
      estado.lista = [];
      estado.siguiente = 1;
      if (estado.dom.archivo) {
        estado.dom.archivo.value = '';
        estado.dom.proveedor.value = '';
        estado.dom.fecha.value = '';
        avisar('');
      }
      render();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
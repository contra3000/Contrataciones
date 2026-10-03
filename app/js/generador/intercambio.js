/*
 * intercambio.js
 * ORDEN-RONDA-28 §4 (ADR-044). La otra puerta del rol Usuario: bajar la
 * plantilla vacía, subir un JSON para seguir trabajando y exportar lo hecho.
 *
 * El generador no tiene servidor, así que el archivo ES el transporte (la
 * franja del encabezado lo dice). Eso obliga a que el archivo hable por sí
 * solo, y son tres cosas las que lo hacen:
 *
 *  1. Un FORMATO, para que un archivo de otra versión se diga que no es de acá
 *     en vez de fallar más abajo con un error de forma.
 *  2. Un SELLO con quién y con qué versión del sistema y del catálogo se generó,
 *     qué número de versión del requerimiento es, y una HUELLA SHA-256 del
 *     contenido. La huella se calcula sobre una forma canónica del JSON (claves
 *     ordenadas, sin la propia huella) para que no dependa de cómo lo guardó
 *     quien lo editó: si alguien cambió un número a mano, la huella no calza y
 *     el archivo se rechaza diciendo exactamente eso.
 *  3. Contenido suficiente para seguir trabajando: identificación,
 *     fundamentación, renglones con su `item` y sus valores de referencia, y los
 *     presupuestos de referencia. Lo que no viaja es la identidad del
 *     expediente local (número, entregables, fecha de creación): eso se
 *     recalcula acá, y en el sello está de quién es el trabajo.
 *
 * Importar valida con las MISMAS reglas del núcleo (SGC.views.pasos sobre
 * SGC.core.validacion, y la de los dos valores por renglón de la ronda 26), no
 * con reglas propias. Y no carga nada a medias: primero se resuelve y se
 * valida todo, y sólo después se toca el formulario. Los códigos se validan
 * contra el catálogo local con el índice código -> clase (carga.js
 * resolverCodigo), que es lo único que se puede hacer sin servidor.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views || !SGC.views.fasttrack || !SGC.views.pasos) {
    throw new Error('generador/intercambio.js requiere que namespaces.js y ' +
      'views/fasttrack.js, views/pasos.js se carguen primero');
  }

  var FORMATO = SGC.views.fasttrack.FORMATO;

  var estado = {
    // Cuántas exportaciones hizo esta sesión y cuál fue la versión más nueva
    // importada. La sesión es la página abierta: recargar es empezar de cero, y
    // es lo que dice la franja del encabezado.
    versionExportada: 0,
    versionImportada: 0
  };

  function esObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  function esEnteroPositivo(valor) {
    return typeof valor === 'number' && isFinite(valor) && Math.floor(valor) === valor && valor > 0;
  }

  // ------------------------------------------------------------------ canónico

  /*
   * El mismo contenido tiene que dar la misma huella en cualquier navegador y en
   * Node, así que la forma en que se calcula no puede depender de cómo el
   * stringify del motor ordena las claves ni de los espacios: se arma a mano con
   * las claves ordenadas. Object.keys().sort() ordena por unidad de código, que
   * es lo mismo en todas partes.
   */
  function canonico(valor) {
    if (Array.isArray(valor)) {
      var elementos = [];
      for (var i = 0; i < valor.length; i++) {
        elementos.push(canonico(valor[i]));
      }
      return '[' + elementos.join(',') + ']';
    }
    if (esObjeto(valor)) {
      var claves = Object.keys(valor).sort();
      var partes = [];
      for (var j = 0; j < claves.length; j++) {
        partes.push(JSON.stringify(claves[j]) + ':' + canonico(valor[claves[j]]));
      }
      return '{' + partes.join(',') + '}';
    }
    return JSON.stringify(valor === undefined ? null : valor);
  }

  // La huella es del CONTENIDO, no de sí misma: se saca del archivo entero con
  // el campo de la huella ausente.
  function sinHuella(objeto) {
    var copia = JSON.parse(JSON.stringify(objeto));
    if (esObjeto(copia.sello)) {
      delete copia.sello.huella;
    }
    return copia;
  }

  function sinWebCrypto() {
    if (!root.crypto || !root.crypto.subtle || typeof root.crypto.subtle.digest !== 'function') {
      return 'este navegador no tiene WebCrypto, así que no se puede calcular ni verificar la huella';
    }
    if (typeof root.TextEncoder !== 'function') {
      return 'este navegador no tiene TextEncoder, así que no se puede calcular la huella';
    }
    return null;
  }

  function huellaDe(objeto) {
    var falta = sinWebCrypto();
    if (falta) {
      return Promise.reject(new Error(falta));
    }
    var bytes = new root.TextEncoder().encode(canonico(sinHuella(objeto)));
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      var octetos = new Uint8Array(buffer);
      var hex = '';
      for (var i = 0; i < octetos.length; i++) {
        hex += (octetos[i] < 16 ? '0' : '') + octetos[i].toString(16);
      }
      return hex;
    });
  }

  // -------------------------------------------------------------------- nombres

  /*
   * El nombre del archivo: requerimiento-<año>-<título corto>-v<N>.json. El
   * título va "corto" y sin tildes ni signos, porque el nombre lo van a tener
   * que escribir y mandar por correo personas, no máquinas. Sólo se admiten
   * letras y números, así que no puede colarse una barra ni un dos puntos.
   */
  function tituloCorto(titulo) {
    var base = String(titulo === undefined || titulo === null ? '' : titulo).toLowerCase();
    if (typeof base.normalize === 'function') {
      base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (base.length > 40) {
      base = base.slice(0, 40).replace(/-+$/, '');
    }
    return base === '' ? 'requerimiento' : base;
  }

  function nombreArchivo(anio, titulo, version) {
    var y = String(anio === undefined || anio === null ? '' : anio).trim();
    return 'requerimiento-' + (/^\d{4}$/.test(y) ? y : 'sin-anio') + '-' +
      tituloCorto(titulo) + '-v' + version + '.json';
  }

  // ------------------------------------------------------------------- exportar

  function versionCatalogo() {
    var est = SGC.catalogo.carga.obtenerEstado();
    return est && est.manifiesto ? est.manifiesto.catalogoVersion : null;
  }

  function versionGenerador() {
    if (SGC.cargaConfig) {
      var config = SGC.cargaConfig.obtener('config/aplicacion.json');
      if (config && config.version) {
        return config.version;
      }
    }
    return null;
  }

  /*
   * El próximo número de versión. Si se importó un archivo v7 y después se
   * exporta, sale v8 y no v1: reutilizar un número que ya circuló haría
   * imposible saber cuál de los dos archivos es el nuevo.
   */
  function versionSiguiente() {
    return Math.max(estado.versionExportada, estado.versionImportada) + 1;
  }

  function valoresDeRenglon(r) {
    var lista = Array.isArray(r.valoresReferencia) ? r.valoresReferencia : [];
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      var v = lista[i] || {};
      salida.push({
        presupuestoId: typeof v.presupuestoId === 'string' ? v.presupuestoId : '',
        base: typeof v.base === 'string' ? v.base : '',
        valor: typeof v.valor === 'number' ? v.valor : Number(v.valor)
      });
    }
    return salida;
  }

  /*
   * El contenido del archivo. Sale del expediente local que ya compone
   * documentos.js, que es lo mismo que se imprime: si el papel y el JSON
   * pueden decir cosas distintas, el papel no sirve para nada.
   */
  function contenido() {
    var expediente = SGC.generadorDocumentos.expedienteLocal();
    var datos = expediente.datos || {};
    var campos = expediente.campos || {};
    var renglones = [];
    var lista = Array.isArray(expediente.renglones) ? expediente.renglones : [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      renglones.push({
        codigo: r.codigo,
        item: typeof r.item === 'string' ? r.item : '',
        cantidad: r.cantidad,
        unidad: r.unidad,
        aclaracion: typeof r.aclaracion === 'string' ? r.aclaracion : '',
        valoresReferencia: valoresDeRenglon(r)
      });
    }
    var presupuestos = [];
    var listaP = Array.isArray(expediente.presupuestos) ? expediente.presupuestos : [];
    for (var j = 0; j < listaP.length; j++) {
      presupuestos.push({
        id: listaP[j].id,
        nombreOriginal: listaP[j].nombreOriginal,
        proveedor: listaP[j].proveedor || '',
        fecha: listaP[j].fecha || '',
        referencia: true
      });
    }
    return {
      titulo: String(expediente.titulo || ''),
      anio: String(datos.anio || ''),
      campos: {
        operador: campos.operador || '',
        dependenciaSolicitante: campos.dependenciaSolicitante || '',
        justificacion: campos.justificacion || '',
        objetivo: campos.objetivo || ''
      },
      renglones: renglones,
      presupuestos: presupuestos
    };
  }

  function armarArchivo() {
    var version = versionSiguiente();
    var cuerpo = contenido();
    var operador = SGC.generador && SGC.generador.operadorActual
      ? SGC.generador.operadorActual() : null;
    return {
      nombre: nombreArchivo(cuerpo.anio, cuerpo.titulo, version),
      version: version,
      archivo: {
        sello: {
          formato: FORMATO,
          versionGenerador: versionGenerador(),
          versionCatalogo: versionCatalogo(),
          rol: operador ? operador.rol : null,
          nombre: operador ? operador.nombre : '',
          fecha: new Date().toISOString(),
          version: version
        },
        expediente: cuerpo
      }
    };
  }

  // La descarga es la misma de siempre: un <a> con download y un Blob, como
  // hace wizard.descargarModelo. En un generador sin servidor no hay adónde
  // "subir" el archivo: se descarga y se manda por donde corresponda.
  function descargar(nombre, contenidoTexto) {
    var blob = new Blob([contenidoTexto], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  /*
   * Exportar. Vuelve con {ok:true, nombre, version} o {ok:false, errores}. No
   * tira excepciones ni deja un archivo a medias: o sale el archivo con su
   * huella, o se dice por qué no salió.
   */
  function exportar() {
    if (!SGC.generadorDocumentos || typeof SGC.generadorDocumentos.revision !== 'function') {
      return Promise.resolve({
        ok: false,
        errores: ['No se puede exportar: los documentos del generador no están montados.']
      });
    }
    var info = SGC.generadorDocumentos.revision();
    if (!info.revision.valido) {
      return Promise.resolve({
        ok: false,
        errores: ['Todavía no se puede exportar. Falta: ' + info.items.join(' · ')]
      });
    }
    var armado = armarArchivo();
    return huellaDe(armado.archivo).then(function (huella) {
      armado.archivo.sello.huella = huella;
      descargar(armado.nombre, JSON.stringify(armado.archivo, null, 2));
      estado.versionExportada = armado.version;
      return { ok: true, nombre: armado.nombre, version: armado.version, huella: huella };
    }).catch(function (err) {
      return {
        ok: false,
        errores: ['No se pudo exportar: ' + (err && err.message ? err.message : 'error desconocido') + '.']
      };
    });
  }

  // ------------------------------------------------------------------- importar

  function formaDeArchivo(crudo) {
    if (esObjeto(crudo.expediente)) {
      return 'exportado';
    }
    if (esObjeto(crudo.renglones) === false && Array.isArray(crudo.renglones)) {
      return 'plantilla';
    }
    return 'desconocida';
  }

  // Del archivo exportado al mismo cuerpo que arma exportar(), para que la
  // comparación entre lo que entró y lo que sale sea directa.
  function cuerpoDeExportado(crudo) {
    var e = crudo.expediente;
    var campos = esObjeto(e.campos) ? e.campos : {};
    var renglones = [];
    var lista = Array.isArray(e.renglones) ? e.renglones : [];
    for (var i = 0; i < lista.length; i++) {
      var r = esObjeto(lista[i]) ? lista[i] : {};
      renglones.push({
        codigo: typeof r.codigo === 'string' ? r.codigo.trim() : '',
        item: typeof r.item === 'string' ? r.item : '',
        cantidad: r.cantidad,
        unidad: typeof r.unidad === 'string' ? r.unidad : '',
        aclaracion: typeof r.aclaracion === 'string' ? r.aclaracion : '',
        valoresReferencia: Array.isArray(r.valoresReferencia) ? r.valoresReferencia : []
      });
    }
    var presupuestos = [];
    var listaP = Array.isArray(e.presupuestos) ? e.presupuestos : [];
    for (var j = 0; j < listaP.length; j++) {
      if (esObjeto(listaP[j])) {
        presupuestos.push(listaP[j]);
      }
    }
    return {
      cuerpo: {
        titulo: typeof e.titulo === 'string' ? e.titulo : '',
        anio: e.anio === undefined || e.anio === null ? '' : String(e.anio),
        campos: {
          operador: typeof campos.operador === 'string' ? campos.operador : '',
          dependenciaSolicitante: typeof campos.dependenciaSolicitante === 'string'
            ? campos.dependenciaSolicitante : '',
          justificacion: typeof campos.justificacion === 'string' ? campos.justificacion : '',
          objetivo: typeof campos.objetivo === 'string' ? campos.objetivo : ''
        },
        renglones: renglones,
        presupuestos: presupuestos
      }
    };
  }

  /*
   * La plantilla (Fast-Track) la lee el módulo que la arma
   * (SGC.views.fasttrack), que ya valida estructura y tipos campo por campo y
   * habla de renglones en castellano. La verificación de los códigos se hace
   * acá, contra el catálogo local.
   */
  function cuerpoDePlantilla(crudo) {
    var estructural = SGC.views.fasttrack.importar(JSON.stringify(crudo), function () {
      return true;
    });
    if (!estructural.ok) {
      return { errores: estructural.errores };
    }
    var d = estructural.datos;
    return {
      cuerpo: {
        titulo: d.identificacion.titulo,
        anio: d.identificacion.anio,
        campos: {
          operador: d.identificacion.operador || '',
          dependenciaSolicitante: d.identificacion.dependenciaSolicitante,
          justificacion: d.fundamentacion.justificacion,
          objetivo: d.fundamentacion.objetivo || ''
        },
        renglones: d.renglones.map(function (r) {
          return {
            codigo: r.codigo,
            item: r.item,
            cantidad: r.cantidad,
            unidad: r.unidad,
            aclaracion: r.aclaracion || '',
            valoresReferencia: []
          };
        }),
        presupuestos: []
      }
    };
  }

  /*
   * Los valores de referencia: la regla de la ronda 26 (dos por renglón) se
   * pide al núcleo con las MISMAS funciones que usa el botón de exportar
   * (validarParaAvanzar + itemsFaltantes), sobre un expediente mínimo en
   * ESPECIFICACIONES_TECNICAS. Así el motivo sale con las palabras de la ronda 26
   * ("2 valores de referencia en Renglón 2") y no con una cuenta propia que
   * podría quedar vieja.
   *
   * Se mira sólo lo que devuelve de renglones: los campos y los entregables que
   * también complain son del formulario que se va a llenar después, no del
   * archivo.
   *
   * Y se avisa de los renglones con menos de dos valores sólo si el archivo trae
   * ALGUNO: una plantilla no los trae (se llenan en pantalla, y para eso está el
   * bloque de valores), pero un requerimiento que vuelve con las filas de
   * valores a medio llenar sí es un archivo a medio llenar, y el caso de la
   * orden es exactamente ese.
   */
  function revisarValores(cuerpo) {
    var tieneAlguno = cuerpo.renglones.some(function (r) {
      return Array.isArray(r.valoresReferencia) && r.valoresReferencia.length > 0;
    });
    if (!tieneAlguno) {
      return [];
    }
    var expedienteFalso = {
      estado: { id: 'ESPECIFICACIONES_TECNICAS' },
      campos: cuerpo.campos,
      entregables: [],
      datos: { renglones: cuerpo.renglones }
    };
    var revision = SGC.core.validacion.validarParaAvanzar(expedienteFalso);
    var deficientes = revision.faltantes.renglones || [];
    var errores = [];
    for (var i = 0; i < deficientes.length; i++) {
      errores.push('el archivo no se importa: hace falta ' +
        SGC.core.validacion.itemsFaltantes({ faltantes: { renglones: [deficientes[i]] } })[0] +
        ' para poder promediar.');
    }
    return errores;
  }

  function revisarConElNucleo(cuerpo) {
    // El índice de "códigos vistos" se alimenta antes de validar: la existencia
    // real ya se comprobó contra el catálogo (resolverCodigo) y esta función
    // sólo necesita que el código no le parezca desconocido.
    SGC.catalogo.indice.registrarCodigos(cuerpo.renglones);
    var datos = {
      identificacion: {
        titulo: cuerpo.titulo,
        anio: cuerpo.anio,
        dependenciaSolicitante: cuerpo.campos.dependenciaSolicitante,
        operador: cuerpo.campos.operador || 'importado'
      },
      renglones: cuerpo.renglones,
      fundamentacion: {
        justificacion: cuerpo.campos.justificacion,
        objetivo: cuerpo.campos.objetivo
      }
    };
    var revision = SGC.views.pasos.validarPaso('revision', datos);
    var errores = [];
    for (var i = 0; i < revision.errores.length; i++) {
      var e = revision.errores[i];
      errores.push(e.campo ? e.campo + ': ' + e.mensaje : e.mensaje);
    }
    return { errores: errores, datos: datos };
  }

  /*
   * Importar. Devuelve la promesa con {ok:true, datos, presupuestos,
   * valoresPorRenglon, version, avisos} o {ok:false, errores}. No toca nada de la
   * pantalla: eso lo hace el asistente cuando recibe esto (su alImportar), y
   * recién cuando todo está bien.
   */
  function importar(texto) {
    var crudo = null;
    try {
      crudo = JSON.parse(texto);
    } catch (e) {
      return Promise.resolve({
        ok: false,
        errores: ['El archivo no es JSON válido: ' + (e && e.message ? e.message : 'no se pudo leer')]
      });
    }
    if (!esObjeto(crudo)) {
      return Promise.resolve({
        ok: false,
        errores: ['El archivo debe ser un objeto JSON, no un arreglo ni un valor suelto']
      });
    }

    var forma = formaDeArchivo(crudo);
    if (forma === 'desconocida') {
      return Promise.resolve({
        ok: false,
        errores: ['El archivo no es ni la plantilla del requerimiento ni un requerimiento exportado: ' +
          'no tiene los datos del expediente.']
      });
    }

    var declarado = forma === 'exportado'
      ? (esObjeto(crudo.sello) ? crudo.sello.formato : null)
      : crudo.formato;
    if (declarado !== undefined && declarado !== null && declarado !== '' && declarado !== FORMATO) {
      return Promise.resolve({
        ok: false,
        errores: ['El archivo es del formato "' + declarado + '" y este generador usa "' +
          FORMATO + '". Actualizá el generador o exportá de nuevo.']
      });
    }

    var armado = forma === 'exportado' ? cuerpoDeExportado(crudo) : cuerpoDePlantilla(crudo);
    if (!armado.cuerpo) {
      return Promise.resolve({ ok: false, errores: armado.errores });
    }
    var cuerpo = armado.cuerpo;
    var sello = forma === 'exportado' && esObjeto(crudo.sello) ? crudo.sello : null;

    var avisos = [];
    var version = null;
    if (sello) {
      if (esEnteroPositivo(sello.version)) {
        version = sello.version;
        if (version < estado.versionImportada) {
          avisos.push('Este archivo es la versión ' + version + ' y en esta sesión ya se había ' +
            'importado una versión ' + estado.versionImportada + ': se cargó igual, pero si tenés ' +
            'la más nueva, usá esa.');
        }
      } else {
        avisos.push('El archivo no dice en qué versión del requerimiento se exportó.');
      }
    }

    /*
     * El contenido se mira antes que la huella, al revés de lo que se supone.
     *
     * Un requerimiento exportado por el generador siempre cumple las reglas, así
     * que si a un archivo le sacan un valor de referencia la huella va a estar
     * desclavada: si la huella se comprobara primero, el único motivo que se
     * daría sería "lo modificaste", que no sirve. Con el contenido primero,
     * quien editó el archivo se entera de qué le falta; y si el contenido está
     * bien, entonces sí lo que se está detectando es una modificación, que es
     * lo único que la huella puede probar.
     *
     * Nada de esto toca la pantalla: el asistente carga el formulario recién
     * cuando vuelve ok, así que un archivo con problemas no deja nada a medias.
     */
    return resolverItems(cuerpo).then(function (resolucion) {
      if (!resolucion.ok) {
        return resolucion;
      }
      var conNucleo = revisarConElNucleo(cuerpo);
      var errores = resolucion.errores.concat(conNucleo.errores).concat(revisarValores(cuerpo));
      if (errores.length > 0) {
        return { ok: false, errores: errores };
      }
      return verificarHuella(crudo, sello).then(function (verificacion) {
        if (!verificacion.ok) {
          return { ok: false, errores: verificacion.errores };
        }
        avisos = avisos.concat(verificacion.avisos);
        if (version !== null) {
          // La versión se recuerda sólo si el archivo entró: un archivo rechazado
          // no corrió el contador.
          estado.versionImportada = Math.max(estado.versionImportada, version);
        }
        var valoresPorRenglon = cuerpo.renglones.map(function (r) {
          return Array.isArray(r.valoresReferencia) ? r.valoresReferencia : [];
        });
        return {
          ok: true,
          datos: conNucleo.datos,
          presupuestos: cuerpo.presupuestos,
          valoresPorRenglon: valoresPorRenglon,
          version: version,
          avisos: avisos,
          mensaje: forma === 'exportado'
            ? 'Requerimiento importado. Revisá los pasos y seguí.'
            : 'Plantilla importada. Revisá los pasos y seguí.'
        };
      });
    }).catch(function (err) {
      return {
        ok: false,
        errores: ['No se pudo leer el archivo: ' + (err && err.message ? err.message : 'error') + '.']
      };
    });
  }

  /*
   * La huella. Se verifica sólo si el archivo trae sello, que es lo que
   * distingue a un requerimiento exportado de una plantilla.
   *
   * Si el sello está pero la huella no, se avisa: es un archivo al que le
   * sacaron la huella a mano, y se carga sin comprobación pero diciendo que no
   * se pudo comprobar. Si la huella está, tiene que calzar: si alguien editó
   * un número a mano, el requerimiento que se firmaría después no es el que se
   * revisó, y eso hay que decirlo en vez de importarlo.
   */
  function verificarHuella(crudo, sello) {
    if (!sello) {
      // Plantilla: no hay nada contra qué compararla.
      return Promise.resolve({ ok: true, avisos: [] });
    }
    if (typeof sello.huella !== 'string' || sello.huella.trim() === '') {
      return Promise.resolve({
        ok: true,
        avisos: ['El archivo no trae huella: se cargó sin poder comprobar si fue modificado.']
      });
    }
    var falta = sinWebCrypto();
    if (falta) {
      return Promise.resolve({
        ok: false,
        errores: ['No se puede verificar la huella del archivo porque ' + falta + '. ' +
          'El archivo no se importa.']
      });
    }
    return huellaDe(crudo).then(function (calculada) {
      if (calculada === sello.huella.trim().toLowerCase()) {
        return { ok: true, avisos: [] };
      }
      return {
        ok: false,
        errores: ['La huella del archivo no coincide con su contenido: el archivo fue modificado ' +
          'fuera del generador. No se importa.']
      };
    });
  }

  /*
   * Los ítems del catálogo. Un código que no existe se dice con su renglón, y
   * si existe se toma la descripción del catálogo y no la del archivo: la del
   * catálogo es la vigente, que es la que después se imprime y se cotiza. Los
   * fragmentos traen {codigo, item}, donde `item` es el texto de la descripción.
   */
  function textoDeItem(item) {
    if (typeof item.item === 'string' && item.item.trim() !== '') {
      return item.item;
    }
    return typeof item.descripcion === 'string' && item.descripcion.trim() !== ''
      ? item.descripcion : '';
  }

  function resolverItems(cuerpo) {
    var errores = [];
    var pendientes = [];
    for (var i = 0; i < cuerpo.renglones.length; i++) {
      (function (indice, renglon) {
        if (typeof renglon.codigo !== 'string' || renglon.codigo.trim() === '') {
          errores.push('Renglón ' + (indice + 1) + ': falta el código del catálogo.');
          return;
        }
        pendientes.push(SGC.catalogo.carga.resolverCodigo(renglon.codigo).then(function (item) {
          if (!item) {
            errores.push('Renglón ' + (indice + 1) + ': el código ' + renglon.codigo +
              ' no existe en el catálogo.');
            return;
          }
          var texto = textoDeItem(item);
          if (texto !== '') {
            renglon.item = texto;
          }
        }));
      })(i, cuerpo.renglones[i]);
    }
    return Promise.all(pendientes).then(function () {
      return errores.length > 0
        ? { ok: false, errores: errores }
        : { ok: true, errores: [] };
    });
  }

  SGC.generadorIntercambio = {
    FORMATO: FORMATO,
    canonico: canonico,
    huellaDe: huellaDe,
    tituloCorto: tituloCorto,
    nombreArchivo: nombreArchivo,
    exportar: exportar,
    importar: importar,
    // La página abierta es la sesión: al arrancar de cero se olvida qué se
    // exportó y qué se importó antes.
    reiniciar: function () {
      estado.versionExportada = 0;
      estado.versionImportada = 0;
    },
    versiones: function () {
      return {
        exportada: estado.versionExportada,
        importada: estado.versionImportada
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
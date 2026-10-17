/*
 * validacion.js
 * Validación del dominio (ORDEN-RONDA-02 §3.2).
 *
 *  - `validarParaAvanzar` deriva las exigencias de `camposRequeridos` y
 *    `entregablesObligatorios` del estado actual. Trabaja con arreglos vacíos
 *    (todo es válido) y con arreglos poblados; no los puebla por su cuenta.
 *  - `validarRenglon` aplica la enmienda de ADR-014: `codigo` obligatorio,
 *    `cantidad` numérica positiva, `unidad` presente y `aclaracion` opcional
 *    de máximo MAX_ACLARACION_TOTAL caracteres (config.js, hoy 2000). Sólo
 *    valida forma: la existencia del código en el catálogo real se valida en
 *    otra capa, fuera de esta ronda.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('validacion.js requiere que namespaces.js se cargue primero');
  }

  // La definición única del límite vive en config.js (ORDEN-RONDA-10 §2.1).
  // Se lee perezosamente dentro de cada función para no depender del orden de
  // carga entre módulos.
  function maxAclaracionTotal() {
    return SGC.core.config.MAX_ACLARACION_TOTAL;
  }

  // ORDEN-RONDA-34 pieza 2: el PAC 2026, del que sale la lista de procesos del
  // desplegable de Identificación. La configuración llega como .js hermano
  // (config/pac.js, escrito por tools/build-config.js) y sólo existe en el
  // generador: con servidor, SGC.cargaConfig no está y todo esto queda vacío
  // (ADR-044: la aplicación con servidor no conoce #sgc-pac).
  function pacConfig() {
    if (SGC.cargaConfig && typeof SGC.cargaConfig.obtener === 'function') {
      var config = SGC.cargaConfig.obtener('config/pac.json');
      if (config && Array.isArray(config.procesos)) {
        return config;
      }
    }
    return null;
  }

  function procesosDelPac() {
    var config = pacConfig();
    return config ? config.procesos : [];
  }

  function procesoDelPac(numero) {
    if (numero === undefined || numero === null || numero === '') {
      return null;
    }
    var n = Number(numero);
    if (!isFinite(n)) {
      return null;
    }
    var procesos = procesosDelPac();
    for (var i = 0; i < procesos.length; i++) {
      if (procesos[i].numero === n) {
        return procesos[i];
      }
    }
    return null;
  }

  // ORDEN-RONDA-35 pieza 2a: la moneda del proceso elegido. USD sólo si el
  // proceso del PAC es en dólares; cualquier otro caso —incluido "No autorizado
  // en el PAC" y la ausencia de proceso— es ARS. La moneda no es un campo: se
  // deriva del proceso, para que el documento y el JSON no puedan contradecir
  // al PAC.
  function monedaDelProceso(numero) {
    var proceso = procesoDelPac(numero);
    return proceso && proceso.moneda === 'USD' ? 'USD' : 'ARS';
  }

  // ORDEN-RONDA-36 pieza 1: el monto del PAC con su moneda, con el mismo texto
  // que el requerimiento impreso y el desplegable ('USD ' o '$ '). Es una copia
  // mínima de renders/documento.js montoAr para no depender de la capa de
  // renders desde el núcleo.
  function montoDelPac(n, moneda) {
    var texto;
    if (typeof n === 'number' && isFinite(n)) {
      var partes = n.toFixed(2).split('.');
      texto = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
    } else {
      texto = '—';
    }
    return (moneda === 'USD' ? 'USD ' : '$ ') + texto;
  }

  // ORDEN-RONDA-37 pieza 2: dos causas son las mismas cuando traen las mismas
  // claves, sin importar el orden en que se enumeren. Sin claves guardadas no
  // hay con qué comparar, así que nunca son iguales.
  function mismasClaves(guardadas, actuales) {
    if (!Array.isArray(guardadas)) {
      return false;
    }
    if (guardadas.length !== actuales.length) {
      return false;
    }
    var a = guardadas.slice().map(String).sort();
    var b = actuales.slice().map(String).sort();
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  // ORDEN-RONDA-38 pieza 1: además de las causas, el proceso justificado tiene
  // que seguir siendo el de ahora. `pac.procesoJustificado` se guarda al escribir
  // o confirmar la justificación (views/wizard.js), con el número del proceso de
  // entonces (o `no-autorizado`). Si el proceso de ahora es otro, se pide
  // revisar igual que cuando cambian las causas. Un archivo de la 37 con
  // `pac.causas` y sin `pac.procesoJustificado` no pide revisar por eso: nadie
  // guardó contra qué proceso se escribió, así que toma el de ahora.
  function procesoJustificadoCambio(pac, numero) {
    if (typeof pac.procesoJustificado !== 'string' || pac.procesoJustificado === '') {
      return false;
    }
    return pac.procesoJustificado !== numero;
  }

  // ORDEN-RONDA-37 pieza 2: la cuenta de las causas cumplidas se cierra con la
  // pregunta de si hay que volver a mirar la justificación. Sólo importa
  // cuando hay una causa Y hay justificación escrita: sin causa no hay nada que
  // revisar, y sin justificación lo que falta es escribirla (items lo dice).
  // ORDEN-RONDA-38 pieza 1: también pide revisar si cambió el proceso del PAC.
  function cerrarCausas(causas, justificacion, pac) {
    var numero = pac.numero === undefined || pac.numero === null ? '' : String(pac.numero);
    causas.revisar = causas.requerida && justificacion !== '' &&
      (!mismasClaves(pac.causas, causas.claves) || procesoJustificadoCambio(pac, numero));
    return causas;
  }

  /*
   * ORDEN-RONDA-36 pieza 1 (ORDEN-RONDA-37 pieza 2): las causas por las que hay
   * que justificar el PAC.
   *
   * `identificacion` es {anio, trimestre, pac} (el pac, a su vez, {numero,
   * justificacion, causas}). `renglones` son los renglones del requerimiento,
   * con sus valores, para el preventivo.
   *
   * Devuelve {requerida, motivos, items, claves, revisar}:
   *  - requerida: hay al menos una causa, así que el campo va a la vista y es
   *    obligatorio en Fundamentación;
   *  - motivos: una frase por causa cumplida, para mostrar arriba del campo;
   *  - items: los motivos que faltan (sólo cuando la justificación está vacía),
   *    con las palabras que usa la exportación;
   *  - claves: la clave de cada causa cumplida, en el orden en que se enumeran
   *    ('fuera-del-pac', 'anio', 'trimestre', 'monto'), que es lo que guarda la
   *    justificación en pac.causas;
   *  - revisar: la causa cambió desde que se guardó la justificación
   *    (ORDEN-RONDA-37 pieza 2), o el proceso de ahora no es el que se guardó en
   *    `pac.procesoJustificado` (ORDEN-RONDA-38 pieza 1). Una justificación
   *    escrita sin claves guardadas también cuenta: nadie las guardó, no se puede
   *    saber qué causas cubrió.
   *
   * Las causas son: el pedido no está autorizado en el PAC; el año del
   * requerimiento no es el del PAC; el trimestre elegido no es el del proceso;
   * y el preventivo supera el monto del proceso (en pesos o en dólares). La
   * justificación escrita no cambia las causas: sólo hace que items quede vacío.
   *
   * ADR-044: con servidor, pacConfig() es null y no hay proceso, así que esta
   * cuenta no produce nada y todo queda como hoy.
   */
  function causasDelPac(identificacion, renglones) {
    var vacio = { requerida: false, motivos: [], items: [], claves: [], revisar: false };
    var id = identificacion && typeof identificacion === 'object' ? identificacion : {};
    var pac = id.pac && typeof id.pac === 'object' ? id.pac : null;
    if (!pac) {
      return vacio;
    }
    var numero = pac.numero === undefined || pac.numero === null ? '' : String(pac.numero);
    if (numero === '') {
      return vacio;
    }
    var justificacion = typeof pac.justificacion === 'string' ? pac.justificacion.trim() : '';
    // Fuera del PAC: como hoy, sin proceso con el que comparar. Es la única causa
    // que se decide sin el PAC (no hay año ni trimestre contra los que medir).
    if (numero === 'no-autorizado') {
      return cerrarCausas({
        requerida: true,
        motivos: ['El pedido no está autorizado en el PAC.'],
        items: justificacion === '' ? ['justificar el pedido no autorizado en el PAC'] : [],
        claves: ['fuera-del-pac']
      }, justificacion, pac);
    }
    var proceso = procesoDelPac(numero);
    if (!proceso) {
      return vacio;
    }
    var motivos = [];
    var items = [];
    var claves = [];
    var config = pacConfig();
    var anioPac = config && config.anio !== undefined && config.anio !== null
      ? String(config.anio) : '';
    var anio = id.anio === undefined || id.anio === null ? '' : String(id.anio);
    if (anioPac !== '' && anio !== '' && anio !== anioPac) {
      motivos.push('El requerimiento es del año ' + anio + ' y el PAC es de ' + anioPac + '.');
      claves.push('anio');
      if (justificacion === '') {
        items.push('justificar por qué se pide para el año ' + anio +
          ' si el PAC es de ' + anioPac);
      }
    }
    var trimestre = id.trimestre === undefined || id.trimestre === null
      ? '' : String(id.trimestre);
    if (trimestre !== '' && String(proceso.trimestre) !== trimestre) {
      motivos.push('Se pide para el ' + trimestre + '° trimestre y el PAC prevé el proceso ' +
        proceso.numero + ' para el ' + proceso.trimestre + '°.');
      claves.push('trimestre');
      if (justificacion === '') {
        items.push('justificar por qué se pide para el ' + trimestre +
          '° trimestre y el proceso ' + proceso.numero + ' del PAC prevé el ' +
          proceso.trimestre + '°');
      }
    }
    // El preventivo supera el monto del proceso. Sólo cuenta si hay un
    // preventivo válido (todos los renglones con valores); si no, no se puede
    // comparar y no es una causa.
    var total = SGC.core.requerimiento.preventivoContratacion(renglones || []);
    if (total.valido && total.total > proceso.monto) {
      motivos.push('El preventivo (' + montoDelPac(total.total, proceso.moneda) +
        ') supera el monto del proceso ' + proceso.numero + ' del PAC (' +
        montoDelPac(proceso.monto, proceso.moneda) + ').');
      claves.push('monto');
      if (justificacion === '') {
        items.push('justificar el preventivo que supera el monto del proceso ' +
          proceso.numero + ' del PAC');
      }
    }
    return cerrarCausas({
      requerida: motivos.length > 0, motivos: motivos, items: items, claves: claves
    }, justificacion, pac);
  }

  /*
   * ORDEN-RONDA-35 pieza 1: la marca del generador.
   *
   * El trimestre, el proceso del PAC y el lugar de entrega son obligatorios en
   * el generador, y su ausencia no se puede detectar "porque el campo existe":
   * un requerimiento exportado antes de la ronda 34 entra sin ellos y hay que
   * pedirlos igual. Sin la marca —la aplicación con servidor nunca la pone—
   * todo sigue como hoy: cada campo se exige sólo si está presente, y la
   * importación de un archivo viejo lo saltea de forma explícita
   * (opciones.exigirCompleto === false).
   */
  var identificacionCompleta = false;

  function exigirIdentificacionCompleta(valor) {
    if (valor !== undefined) {
      identificacionCompleta = valor === true;
    }
    return identificacionCompleta;
  }

  // ORDEN-RONDA-38 pieza 2: la modalidad de compra es común u orden de compra
  // abierta (OCA). Vive en identificacion.modalidad y sólo existe en el
  // generador: con servidor no está, así que siempre es falsa y nada cambia
  // (ADR-044). Es el único lugar donde se decide "con OCA".
  function modalidadOca(datos) {
    var identificacion = datos && typeof datos.identificacion === 'object'
      ? datos.identificacion : {};
    return identificacion.modalidad === 'oca';
  }

  function obtenerEstado(expediente) {
    var id = SGC.core.utils.idEstado(expediente);
    if (id === null) {
      return null;
    }
    var estados = SGC.core.config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === id) {
        return estados[i];
      }
    }
    return null;
  }

  function campoPresente(expediente, nombre) {
    if (!expediente.campos || typeof expediente.campos !== 'object') {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(expediente.campos, nombre)) {
      return false;
    }
    var valor = expediente.campos[nombre];
    return valor !== undefined && valor !== null && valor !== '';
  }

  // Un entregable puede registrarse como cadena (id directo, como en los
  // tests de configuración) o como objeto {id, nombre, ruta, ...} (como lo
  // guarda el servidor desde la ronda 8). Ambas formas cierran la exigencia.
  function entregablePresente(expediente, idEntregable) {
    var lista = Array.isArray(expediente.entregables) ? expediente.entregables : [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (typeof e === 'string' && e === idEntregable) {
        return true;
      }
      if (e && typeof e === 'object' && e.id === idEntregable) {
        return true;
      }
    }
    return false;
  }

  // ORDEN-RONDA-31 pieza 1: un renglón está completo con dos valores que salen
  // de fuentes distintas (presupuesto o precio de plaza), o con UN valor y una
  // fila de justificación. La cuenta y el criterio viven en
  // core/requerimiento.js (fuentesDeRenglon), que es el mismo que mira la
  // pantalla: acá sólo se traduce a "Renglón N" para la lista de faltantes.
  //
  // La clave `renglones` sólo aparece si algún renglón es deficiente, como en
  // la ronda 26 (así los tests que no esperan la clave siguen con la forma
  // exacta).
  function renglonesSinValores(expediente) {
    if (!SGC.core.requerimiento) {
      throw new Error('validacion.js (renglonesSinValores) requiere que core/requerimiento.js se cargue primero');
    }
    var info = SGC.core.requerimiento.requerimientoDe(expediente);
    var deficientes = [];
    for (var i = 0; i < info.renglones.length; i++) {
      var fuentes = SGC.core.requerimiento.fuentesDeRenglon(info.renglones[i]);
      if (!fuentes.completo) {
        deficientes.push('Renglón ' + (i + 1));
      }
    }
    return deficientes;
  }

  function validarParaAvanzar(expediente) {
    var faltantes = { campos: [], entregables: [] };
    var estado = obtenerEstado(expediente);
    if (estado === null) {
      return { valido: false, faltantes: faltantes };
    }
    var requeridos = estado.camposRequeridos || [];
    var obligatorios = estado.entregablesObligatorios || [];
    for (var i = 0; i < requeridos.length; i++) {
      if (!campoPresente(expediente, requeridos[i])) {
        faltantes.campos.push(requeridos[i]);
      }
    }
    for (var j = 0; j < obligatorios.length; j++) {
      if (!entregablePresente(expediente, obligatorios[j])) {
        faltantes.entregables.push(obligatorios[j]);
      }
    }
    // ORDEN-RONDA-11 §2.2: anexo EETT obligatorio cuando hay referencias
    // pendientes (ADR-029: exigir, no saltear).
    if (!SGC.core.anexoEett) {
      throw new Error('validacion.js (validarParaAvanzar) requiere que core/anexo-eett.js se cargue primero');
    }
    if (SGC.core.anexoEett.tieneContenido(expediente) &&
        !entregablePresente(expediente, 'anexo-eett')) {
      faltantes.entregables.push('anexo-eett');
    }
    // ORDEN-RONDA-26 pieza 5: dos valores de referencia por renglón en
    // ESPECIFICACIONES_TECNICAS (mismo código en cliente y servidor). Sólo se
    // crea la clave `renglones` si hay deficiencias, para no inventar una
    // forma que los otros estados no tienen.
    if (estado.id === 'ESPECIFICACIONES_TECNICAS') {
      var renglonesDeficientes = renglonesSinValores(expediente);
      if (renglonesDeficientes.length > 0) {
        faltantes.renglones = renglonesDeficientes;
      }
    }
    return {
      valido: faltantes.campos.length === 0 && faltantes.entregables.length === 0 &&
        (faltantes.renglones === undefined || faltantes.renglones.length === 0),
      faltantes: faltantes
    };
  }

  // ORDEN-RONDA-26 pieza 2: los requisitos que faltan, en palabras, con el
  // TÍTULO del entregable (ENTREGABLES[].titulo) o del campo (TITULOS_CAMPOS),
  // nunca el id técnico. Es el mismo texto que usa la vista (para deshabilitar
  // "Avanzar" y decir qué falta) y el servidor (mensaje de la transición).
  function tituloCampo(nombre) {
    var mapa = SGC.core.config.TITULOS_CAMPOS || {};
    return mapa[nombre] || nombre;
  }

  function tituloEntregable(id) {
    var lista = SGC.core.config.ENTREGABLES || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) {
        return lista[i].titulo;
      }
    }
    return id;
  }

  // Arreglo de frases (una por falto), sin el prefijo "Falta: " (lo pone cada
  // superficie). Para entregables: "guardar <título>". Para renglones (pieza
  // 5 de la 26, con la regla de la 29 y la ampliación de la 31): "2 valores de
  // referencia de fuentes distintas, o 1 valor y una justificación, en
  // <renglón>".
  function itemsFaltantes(revision) {
    var items = [];
    if (!revision || !revision.faltantes) {
      return items;
    }
    var campos = revision.faltantes.campos || [];
    var entregables = revision.faltantes.entregables || [];
    var renglones = revision.faltantes.renglones || [];
    for (var i = 0; i < campos.length; i++) {
      items.push(tituloCampo(campos[i]));
    }
    for (var j = 0; j < entregables.length; j++) {
      items.push('guardar ' + tituloEntregable(entregables[j]));
    }
    for (var k = 0; k < renglones.length; k++) {
      items.push('2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en ' +
        String(renglones[k]));
    }
    return items;
  }

  function validarRenglon(renglon) {
    var errores = [];
    if (!renglon || typeof renglon !== 'object') {
      return { valido: false, errores: ['El renglón no es válido'] };
    }
    if (typeof renglon.codigo !== 'string' || renglon.codigo.trim() === '') {
      errores.push('El código es obligatorio');
    }
    if (typeof renglon.cantidad !== 'number' || !(renglon.cantidad > 0)) {
      errores.push('La cantidad debe ser un número positivo');
    }
    if (typeof renglon.unidad !== 'string' || renglon.unidad.trim() === '') {
      errores.push('La unidad de medida es obligatoria');
    }
    // ORDEN-RONDA-10 §2.1: el tope duro de entrada es MAX_ACLARACION_TOTAL
    // (config.js). Superar los 256 no es error acá: ese texto desborda al
    // anexo de EETT (core/anexo-eett.js) y se acepta hasta el tope. El conteo
    // es el mismo criterio de todo el sistema: puntos de código
    // (utils.contarCaracteres, ORDEN-RONDA-10-CIERRE §2).
    if (renglon.aclaracion !== undefined && renglon.aclaracion !== null &&
        typeof renglon.aclaracion === 'string' &&
        SGC.core.utils.contarCaracteres(renglon.aclaracion) > maxAclaracionTotal()) {
      errores.push('La aclaración no puede superar los ' + maxAclaracionTotal() + ' caracteres');
    }
    // ORDEN-RONDA-09 §3.3/§3.4 (ADR-022): valores de referencia y cantidades
    // máximas/mínimas. Requerimiento.js es el dueño de esas reglas.
    // ADR-029: exigir, no saltear.
    if (!SGC.core.requerimiento) {
      throw new Error('validacion.js (validarRenglon) requiere que core/requerimiento.js se cargue primero');
    }
    errores = errores.concat(SGC.core.requerimiento.validarValoresReferencia(renglon));
    errores = errores.concat(SGC.core.requerimiento.validarCantidades(renglon));
    return { valido: errores.length === 0, errores: errores };
  }

  // Validación agregada del requerimiento (ORDEN-RONDA-09 §3.6): valores de
  // referencia de todos los renglones y cantidades máximas/mínimas. Sin
  // estado: valida el expediente completo, no una transición.
  // ADR-029: exigir, no saltear.
  function validarRequerimiento(expediente) {
    if (!SGC.core.requerimiento) {
      throw new Error('validacion.js (validarRequerimiento) requiere que core/requerimiento.js se cargue primero');
    }
    return SGC.core.requerimiento.validarRequerimiento(expediente);
  }

  // Validación del paso Identificación del wizard (ORDEN-RONDA-05 §3.1): el
  // operador viene del padrón y se guarda como correo; el año debe tener
  // cuatro dígitos.
  function validarIdentificacion(campos, opciones) {
    var errores = [];
    if (!campos || typeof campos !== 'object') {
      return { valido: false, errores: ['Faltan los campos de identificación'] };
    }
    // ORDEN-RONDA-35 pieza 1: con la marca del generador, el trimestre, el PAC
    // y el lugar de entrega se exigen siempre, traiga o no el campo el archivo.
    // `opciones.exigirCompleto === false` es la excepción de la importación: un
    // archivo viejo entra y los campos quedan para completar en pantalla.
    var marcar = opciones && opciones.exigirCompleto === false
      ? false : identificacionCompleta;
    if (typeof campos.titulo !== 'string' || campos.titulo.trim() === '') {
      errores.push('El título del requerimiento es obligatorio');
    }
    if (typeof campos.anio !== 'string' || !/^\d{4}$/.test(campos.anio)) {
      errores.push('El año debe tener cuatro dígitos');
    }
    if (typeof campos.dependenciaSolicitante !== 'string' || campos.dependenciaSolicitante.trim() === '') {
      errores.push('La dependencia solicitante es obligatoria');
    }
    if (typeof campos.operador !== 'string' || campos.operador.trim() === '') {
      errores.push('El operador es obligatorio');
    }
    // ORDEN-RONDA-34 pieza 1: el trimestre es obligatorio cuando el campo existe
    // (el generador lo escribe en cada sincronización). ORDEN-RONDA-35: con la
    // marca del generador se exige aunque el archivo no lo traiga.
    if ((marcar || campos.trimestre !== undefined) &&
        (typeof campos.trimestre !== 'string' || !/^[1-4]$/.test(campos.trimestre))) {
      errores.push('Elegí el trimestre para el que se pide');
    }
    // ORDEN-RONDA-34 pieza 2: el proceso del PAC es obligatorio con el mismo
    // trato que el trimestre. Vale un proceso del PAC o "no-autorizado"; vacío
    // o desconocido, no. ORDEN-RONDA-35: la marca lo exige aunque falte.
    if (marcar || (campos.pac !== undefined && campos.pac !== null)) {
      var numeroPac = campos.pac && typeof campos.pac.numero === 'string' ? campos.pac.numero : '';
      if (numeroPac === '') {
        errores.push('Elegí el proceso del PAC 2026');
      } else if (numeroPac !== 'no-autorizado' && procesoDelPac(numeroPac) === null) {
        errores.push('Elegí el proceso del PAC 2026');
      }
    }
    // ORDEN-RONDA-35 pieza 1: el lugar de entrega de la EETT lo escribe la
    // persona. Es obligatorio en el generador (marca) y, sin ella, sólo si el
    // campo existe, como los otros.
    if ((marcar || campos.lugarEntrega !== undefined) &&
        (typeof campos.lugarEntrega !== 'string' || campos.lugarEntrega.trim() === '')) {
      errores.push('Escribí el lugar de entrega');
    }
    // ORDEN-RONDA-38 pieza 2a: la modalidad (común u OCA) es obligatoria con la
    // marca del generador, y sin ella sólo si el campo existe, como los otros.
    // El mensaje lleva la palabra "modalidad" para que la vista le ponga el foco
    // al campo.
    if ((marcar || campos.modalidad !== undefined) &&
        campos.modalidad !== 'comun' && campos.modalidad !== 'oca') {
      errores.push('Elegí la modalidad de compra');
    }
    return { valido: errores.length === 0, errores: errores };
  }

  // Validación del paso Fundamentación del wizard (ORDEN-RONDA-05 §3.1).
  function validarFundamentacion(campos) {
    var errores = [];
    if (!campos || typeof campos !== 'object') {
      return { valido: false, errores: ['Faltan los campos de fundamentación'] };
    }
    if (typeof campos.justificacion !== 'string' || campos.justificacion.trim() === '') {
      errores.push('La justificación del requerimiento es obligatoria');
    } else if (campos.justificacion.length > SGC.core.config.MAX_JUSTIFICACION) {
      // ORDEN-RONDA-10-CIERRE §1.3: mismo criterio que valida el servidor
      // (validarJustificaciones); la constante vive en config.js.
      errores.push('La justificación no puede superar los ' +
        SGC.core.config.MAX_JUSTIFICACION + ' caracteres');
    }
    return { valido: errores.length === 0, errores: errores };
  }

  // Tope duro de los textos de justificación (ORDEN-RONDA-10-CIERRE §1.3,
  // auditoría §2.4): el servidor lo aplica por su cuenta al crear (POST) y al
  // guardar (PUT), sin ayuda de la pantalla. Cubre los dos lugares donde vive
  // una justificación: la fundamentación del wizard y el campo del encabezado
  // del requerimiento que se prellena desde ella.
  function validarJustificaciones(expediente) {
    var errores = [];
    if (!expediente || typeof expediente !== 'object') {
      return errores;
    }
    var limite = SGC.core.config.MAX_JUSTIFICACION;
    var candidatos = [];
    var fund = expediente.fundamentacion;
    if (fund && typeof fund.justificacion === 'string') {
      candidatos.push({ nombre: 'la justificación de la necesidad', texto: fund.justificacion });
    }
    var rq = expediente.requerimiento;
    if (rq && typeof rq.justificacionNecesidad === 'string') {
      candidatos.push({
        nombre: '"Justificación de la necesidad" del requerimiento',
        texto: rq.justificacionNecesidad
      });
    }
    for (var i = 0; i < candidatos.length; i++) {
      if (candidatos[i].texto.length > limite) {
        errores.push(candidatos[i].nombre + ' no puede superar los ' + limite + ' caracteres');
      }
    }
    return errores;
  }

  // ---------------------------------------------------------------------------
  // Validación del encabezado del requerimiento (ORDEN-RONDA-11 §2.3):
  // cada campo requerido debe estar presente y no vacío; los textuales deben
  // respetar la cota de longitud definida en CAMPOS_ENCABEZADO_COTAS (config.js
  // + cotas-encabezado.js). Se ejecuta en el servidor (PUT) y antes de avanzar.
  // ---------------------------------------------------------------------------
  function validarEncabezado(expediente) {
    var errores = [];
    var cfg = SGC.core.config;
    var cotas = cfg && cfg.CAMPOS_ENCABEZADO_COTAS;
    var encabezado = (expediente.requerimiento || {}).encabezado;
    if (!cotas || !encabezado || typeof encabezado !== 'object' ||
        Object.keys(encabezado).length === 0) {
      return errores;
    }
    var keys = Object.keys(cotas);
    for (var i = 0; i < keys.length; i++) {
      var campo = keys[i];
      var valor = encabezado[campo];
      if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
        errores.push('El campo del encabezado ' + campo + ' es obligatorio');
        continue;
      }
      if (cotas[campo] !== Infinity && typeof valor === 'string' && valor.length > cotas[campo]) {
        errores.push(campo + ' no puede superar los ' + cotas[campo] + ' caracteres');
      }
    }
    return errores;
  }

  SGC.core.validacion = {
    validarParaAvanzar: validarParaAvanzar,
    itemsFaltantes: itemsFaltantes,
    validarRenglon: validarRenglon,
    validarIdentificacion: validarIdentificacion,
    validarFundamentacion: validarFundamentacion,
    validarJustificaciones: validarJustificaciones,
    validarRequerimiento: validarRequerimiento,
    validarEncabezado: validarEncabezado,
    procesosDelPac: procesosDelPac,
    procesoDelPac: procesoDelPac,
    monedaDelProceso: monedaDelProceso,
    causasDelPac: causasDelPac,
    exigirIdentificacionCompleta: exigirIdentificacionCompleta,
    modalidadOca: modalidadOca
  };
})(typeof window !== 'undefined' ? window : globalThis);

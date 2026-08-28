/*
 * indicadores.js
 * ORDEN-RONDA-12 §3.2-3.3 (ADR-024). Catálogo de fichas de indicador y
 * motor de cálculo. Los indicadores NO se persisten calculados: se derivan
 * del registro de eventos al mostrarlos.
 *
 * Agregar una ficha nueva no requiere tocar la vista — sólo agregar una
 * entrada al catálogo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('indicadores.js requiere que namespaces.js se cargue primero');
  }

  // Catálogo de fichas declarativas. Cada ficha define:
  //   id:             identificador único
  //   nombre:         nombre legible
  //   evento:         tipo de evento que alimenta (o 'todos')
  //   agregacion:     'conteo' | 'suma' | 'promedio' | 'duracion' | 'tasa' | 'agrupar'
  //   campo:          campo del evento para la agregación
  //   corte:          campo para agrupar (opcional)
  //   formato:        'numero' | 'duracion' | 'porcentaje' | 'texto'
  var FICHAS = [
    {
      id: 'tiempo_por_fase',
      nombre: 'Tiempo por fase',
      evento: 'permanencia',
      agregacion: 'duracion',
      campo: 'milisegundos',
      corte: 'paso',
      formato: 'duracion'
    },
    {
      id: 'tiempo_total',
      nombre: 'Tiempo total del expediente',
      evento: 'transicion',
      agregacion: 'conteo',
      campo: null,
      formato: 'numero'
    },
    {
      id: 'tasa_devolucion_motivo',
      nombre: 'Tasa de devolución por motivo',
      evento: 'devolucion',
      agregacion: 'agrupar',
      campo: 'motivo',
      formato: 'texto'
    },
    {
      id: 'tasa_devolucion_sector',
      nombre: 'Tasa de devolución por sector',
      evento: 'devolucion',
      agregacion: 'agrupar',
      campo: 'email',
      formato: 'texto'
    },
    {
      id: 'renglones_aclaracion_rubro',
      nombre: 'Renglones con aclaración por rubro',
      evento: 'aclaracion',
      agregacion: 'conteo',
      campo: 'longitud',
      formato: 'numero'
    },
    {
      id: 'busquedas_sin_resultado',
      nombre: 'Búsquedas sin resultado',
      evento: 'busqueda_catalogo',
      agregacion: 'conteo',
      campo: 'sinResultado',
      formato: 'numero'
    },
    {
      id: 'dispersion_presupuestos',
      nombre: 'Dispersión entre presupuestos',
      evento: 'valor_referencia',
      agregacion: 'promedio',
      campo: 'preventivo',
      corte: 'indice',
      formato: 'numero'
    },
    {
      id: 'renglones_por_area',
      nombre: 'Renglones por área solicitante',
      evento: 'area_solicitante',
      agregacion: 'agrupar',
      campo: 'area',
      formato: 'texto'
    },
    {
      id: 'ediciones_por_grupo',
      nombre: 'Ediciones por grupo de campos',
      evento: 'edicion',
      agregacion: 'agrupar',
      campo: 'grupoCampos',
      formato: 'texto'
    },
    {
      id: 'entregables_generados',
      nombre: 'Entregables generados',
      evento: 'entregable',
      agregacion: 'conteo',
      campo: 'entregableId',
      formato: 'texto'
    },
    {
      // ORDEN-RONDA-14 §3.5 (ADR-033): la misma persona ejecuta un paso y su
      // supervisión — un transición con rolEfectivo (supervisor actuando como
      // supervisado) y otra del mismo correo con su rol propio. No bloquea
      // nada: sólo se ve en el tablero del Jefe de Contrataciones.
      id: 'misma_persona',
      nombre: 'Misma persona (paso y supervisión)',
      evento: 'transicion',
      agregacion: 'misma_persona',
      campo: null,
      formato: 'numero'
    }
  ];

  // Tabla de roles → fichas por defecto
  var TABLEROS_POR_ROL = {
    generador: ['tiempo_por_fase', 'tiempo_total', 'renglones_aclaracion_rubro'],
    abastecimiento: ['tiempo_por_fase', 'dispersion_presupuestos', 'busquedas_sin_resultado'],
    abastecimiento_supervisor: ['tiempo_por_fase', 'tasa_devolucion_motivo', 'entregables_generados'],
    contrataciones: ['tiempo_por_fase', 'tasa_devolucion_sector', 'ediciones_por_grupo'],
    contrataciones_supervisor: ['tiempo_total', 'tasa_devolucion_motivo', 'tasa_devolucion_sector', 'misma_persona'],
    juridica: ['tiempo_por_fase', 'ediciones_por_grupo'],
    contaduria: ['tiempo_por_fase', 'dispersion_presupuestos']
  };

  function buscarFicha(id) {
    for (var i = 0; i < FICHAS.length; i++) {
      if (FICHAS[i].id === id) return FICHAS[i];
    }
    return null;
  }

  function filtrarEventos(eventos, tipo) {
    if (!Array.isArray(eventos)) return [];
    if (!tipo || tipo === 'todos') return eventos;
    return eventos.filter(function (e) { return e && e.tipo === tipo; });
  }

  function calcularFicha(ficha, eventos) {
    var filtrados = filtrarEventos(eventos, ficha.evento);
    switch (ficha.agregacion) {
      case 'conteo':
        if (ficha.campo) {
          var conCampo = filtrados.filter(function (e) { return e[ficha.campo]; });
          return { valor: conCampo.length, detalle: null };
        }
        return { valor: filtrados.length, detalle: null };

      case 'suma':
        var suma = 0;
        for (var i = 0; i < filtrados.length; i++) {
          var v = typeof filtrados[i][ficha.campo] === 'number' ? filtrados[i][ficha.campo] : 0;
          suma += v;
        }
        return { valor: suma, detalle: null };

      case 'promedio':
        var total = 0;
        var count = 0;
        for (var j = 0; j < filtrados.length; j++) {
          var val = typeof filtrados[j][ficha.campo] === 'number' ? filtrados[j][ficha.campo] : 0;
          if (val > 0) { total += val; count++; }
        }
        return { valor: count > 0 ? total / count : 0, detalle: null };

      case 'duracion':
        var sumaDur = 0;
        for (var k = 0; k < filtrados.length; k++) {
          var dur = typeof filtrados[k][ficha.campo] === 'number' ? filtrados[k][ficha.campo] : 0;
          sumaDur += dur;
        }
        return { valor: sumaDur, detalle: null };

      case 'agrupar':
        var grupos = {};
        for (var g = 0; g < filtrados.length; g++) {
          var clave = String(filtrados[g][ficha.campo] || '(sin dato)');
          grupos[clave] = (grupos[clave] || 0) + 1;
        }
        return { valor: Object.keys(grupos).length, detalle: grupos };

      // ORDEN-RONDA-14 §3.5: correos con un transición como supervisión
      // (rolEfectivo presente, siempre distinto del rol propio) y otra como
      // rol propio. Contar es lo que hace visible algo que no queremos bloquear.
      case 'misma_persona':
        var conSupervision = {};
        var conPropio = {};
        for (var mp = 0; mp < filtrados.length; mp++) {
          var ev = filtrados[mp];
          if (ev.rolEfectivo) {
            conSupervision[ev.email] = true;
          } else {
            conPropio[ev.email] = true;
          }
        }
        var personas = [];
        for (var correo in conSupervision) {
          if (conPropio[correo]) {
            personas.push(correo);
          }
        }
        return { valor: personas.length, detalle: personas };

      default:
        return { valor: 0, detalle: null };
    }
  }

  function calcularTodas(eventos, ids) {
    var resultados = [];
    var lista = ids || FICHAS.map(function (f) { return f.id; });
    for (var i = 0; i < lista.length; i++) {
      var ficha = buscarFicha(lista[i]);
      if (!ficha) continue;
      var r = calcularFicha(ficha, eventos);
      resultados.push({ ficha: ficha, valor: r.valor, detalle: r.detalle });
    }
    return resultados;
  }

  function tableroPorDefecto(rol) {
    return (TABLEROS_POR_ROL[rol] || TABLEROS_POR_ROL.generador).slice();
  }

  SGC.core.indicadores = {
    FICHAS: FICHAS,
    TABLEROS_POR_ROL: TABLEROS_POR_ROL,
    buscarFicha: buscarFicha,
    calcularFicha: calcularFicha,
    calcularTodas: calcularTodas,
    tableroPorDefecto: tableroPorDefecto
  };
})(typeof window !== 'undefined' ? window : globalThis);

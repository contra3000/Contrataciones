/*
 * config.js
 * Máquina de estados declarativa de los 18 pasos del circuito de
 * contrataciones. Es el corazón del sistema: las vistas jamás conocen
 * los estados, sólo leen de este archivo.
 *
 * Fuentes:
 *  - Los 18 pasos, sus fases y sectores: FullScopeDoc.md §4.
 *  - Los roles: InstruccionesCodigo.md §10.1 (restaurado en la ronda 2;
 *    sus identificadores se adoptan en esta ronda, ver INFORME-RONDA-02.md §2).
 *
 * La asignación de rolEjecutor a nivel "gestor/supervisor" y el mapeo de
 * estadosDevolucion son una propuesta inicial de esta ronda, a validar con
 * los operadores (ver INFORME.md §2).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('config.js requiere que namespaces.js se cargue primero');
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------
  var ROLES = [
    { id: 'generador', nombre: 'Generador', sector: 'usuario', esComun: true },
    { id: 'abastecimiento', nombre: 'Gestor de Abastecimiento', sector: 'abastecimiento', esComun: false },
    { id: 'abastecimiento_supervisor', nombre: 'Supervisor de Abastecimiento', sector: 'abastecimiento', esComun: false },
    { id: 'contrataciones', nombre: 'Gestor de Contrataciones', sector: 'contrataciones', esComun: false },
    { id: 'contrataciones_supervisor', nombre: 'Supervisor de Contrataciones', sector: 'contrataciones', esComun: false },
    { id: 'juridica', nombre: 'Asesoría Jurídica', sector: 'juridica', esComun: true },
    { id: 'contaduria', nombre: 'Contaduría', sector: 'contaduria', esComun: true }
  ];

  // ---------------------------------------------------------------------------
  // Estados (18 pasos del FSD §4)
  // ---------------------------------------------------------------------------
  var ESTADOS = [
    {
      id: 'ESPECIFICACIONES_TECNICAS',
      numero: 1,
      titulo: 'Especificaciones Técnicas',
      fase: 1,
      rolEjecutor: 'generador',
      estadosSiguientes: ['SOLICITUD_CONTRATACION'],
      estadosDevolucion: [],
      camposRequeridos: [],
      entregablesObligatorios: ['especificacion-tecnica']
    },
    {
      id: 'SOLICITUD_CONTRATACION',
      numero: 2,
      titulo: 'Solicitud de Contratación (SCo)',
      fase: 2,
      rolEjecutor: 'abastecimiento',
      estadosSiguientes: ['ANALISIS_SCo'],
      estadosDevolucion: ['ESPECIFICACIONES_TECNICAS'],
      camposRequeridos: [],
      entregablesObligatorios: ['solicitud-contratacion']
    },
    {
      id: 'ANALISIS_SCo',
      numero: 3,
      titulo: 'Análisis de SCo',
      fase: 2,
      rolEjecutor: 'abastecimiento',
      estadosSiguientes: ['AUTORIZACION_SCo'],
      estadosDevolucion: ['SOLICITUD_CONTRATACION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'AUTORIZACION_SCo',
      numero: 4,
      titulo: 'Autorización de SCo',
      fase: 2,
      rolEjecutor: 'abastecimiento_supervisor',
      estadosSiguientes: ['REVISION_SCo'],
      estadosDevolucion: ['ANALISIS_SCo'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'REVISION_SCo',
      numero: 5,
      titulo: 'Revisión de SCo',
      fase: 3,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['CONFECCION_PROYECTOS'],
      estadosDevolucion: ['AUTORIZACION_SCo'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'CONFECCION_PROYECTOS',
      numero: 6,
      titulo: 'Confección de Proyectos',
      fase: 3,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['DICTAMEN_INICIAL'],
      estadosDevolucion: ['REVISION_SCo'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'DICTAMEN_INICIAL',
      numero: 7,
      titulo: 'Dictamen Inicial',
      fase: 4,
      rolEjecutor: 'juridica',
      estadosSiguientes: ['DILIGENCIA'],
      estadosDevolucion: ['CONFECCION_PROYECTOS'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'DILIGENCIA',
      numero: 8,
      titulo: 'Diligencia',
      fase: 5,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['FIRMAS_PLIEGO_DISPOSICION'],
      estadosDevolucion: ['DICTAMEN_INICIAL'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'FIRMAS_PLIEGO_DISPOSICION',
      numero: 9,
      titulo: 'Firmas de Pliego y Disposición',
      fase: 5,
      rolEjecutor: 'contrataciones_supervisor',
      estadosSiguientes: ['PUBLICACION'],
      estadosDevolucion: ['DILIGENCIA'],
      camposRequeridos: [],
      entregablesObligatorios: ['pliego-bases-condiciones']
    },
    {
      id: 'PUBLICACION',
      numero: 10,
      titulo: 'Publicación',
      fase: 5,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['APERTURA_PEDIDO_INFORMES'],
      estadosDevolucion: ['FIRMAS_PLIEGO_DISPOSICION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'APERTURA_PEDIDO_INFORMES',
      numero: 11,
      titulo: 'Apertura / Pedido de informes',
      fase: 5,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['EVALUACION'],
      estadosDevolucion: ['PUBLICACION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'EVALUACION',
      numero: 12,
      titulo: 'Evaluación',
      fase: 5,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['DICTAMEN_FINAL'],
      estadosDevolucion: ['APERTURA_PEDIDO_INFORMES'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'DICTAMEN_FINAL',
      numero: 13,
      titulo: 'Dictamen Final',
      fase: 6,
      rolEjecutor: 'juridica',
      estadosSiguientes: ['FIRMA_DISPOSICION'],
      estadosDevolucion: ['EVALUACION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'FIRMA_DISPOSICION',
      numero: 14,
      titulo: 'Firma de Disposición',
      fase: 7,
      rolEjecutor: 'contrataciones_supervisor',
      estadosSiguientes: ['ADJUDICACION'],
      estadosDevolucion: ['DICTAMEN_FINAL'],
      camposRequeridos: [],
      entregablesObligatorios: ['disposicion-adjudicacion']
    },
    {
      id: 'ADJUDICACION',
      numero: 15,
      titulo: 'Adjudicación',
      fase: 7,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['AFECTACION'],
      estadosDevolucion: ['FIRMA_DISPOSICION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'AFECTACION',
      numero: 16,
      titulo: 'Afectación',
      fase: 8,
      rolEjecutor: 'contaduria',
      estadosSiguientes: ['GENERACION_ORDEN_COMPRA'],
      estadosDevolucion: ['ADJUDICACION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'GENERACION_ORDEN_COMPRA',
      numero: 17,
      titulo: 'Generación de Orden de Compra',
      fase: 9,
      rolEjecutor: 'contrataciones',
      estadosSiguientes: ['PERFECCIONADA'],
      estadosDevolucion: ['AFECTACION'],
      camposRequeridos: [],
      entregablesObligatorios: ['orden-compra']
    },
    {
      id: 'PERFECCIONADA',
      numero: 18,
      titulo: 'Perfeccionada',
      fase: 10,
      rolEjecutor: 'abastecimiento',
      estadosSiguientes: [],
      estadosDevolucion: [],
      camposRequeridos: [],
      entregablesObligatorios: []
    }
  ];

  // ---------------------------------------------------------------------------
  // Catálogo cerrado de motivos de devolución
  // Versión inicial propuesta; se valida con los operadores en H9.
  // ---------------------------------------------------------------------------
  var MOTIVOS_DEVOLUCION = [
    { id: 'ESPECIFICACIONES_INCOMPLETAS', texto: 'Las especificaciones técnicas están incompletas o mal redactadas', sector: 'usuario' },
    { id: 'DATOS_INCONSISTENTES', texto: 'Datos inconsistentes o contradictorios entre documentos', sector: 'general' },
    { id: 'FALTA_DOCUMENTACION', texto: 'Falta documentación obligatoria', sector: 'general' },
    { id: 'ERRORES_FORMALES', texto: 'Errores formales o de tipeo', sector: 'general' },
    { id: 'INCUMPLE_NORMATIVA', texto: 'No cumple con la normativa vigente', sector: 'juridica' },
    { id: 'FALTA_VISTA_O_INFORME', texto: 'Falta vista o informe de un sector interviniente', sector: 'general' },
    { id: 'RENGLONES_INVALIDOS', texto: 'Renglones sin código de catálogo válido o mal cargados', sector: 'contrataciones' },
    { id: 'IMPUTACION_INCORRECTA', texto: 'Imputación presupuestaria incorrecta', sector: 'contaduria' },
    { id: 'SIN_DISPONIBILIDAD_FONDOS', texto: 'No hay afectación o disponibilidad de fondos', sector: 'contaduria' },
    { id: 'OBSERVACION_CONTRATACIONES', texto: 'Observaciones de Contrataciones sobre el expediente', sector: 'contrataciones' }
  ];

  var ESTADO_INICIAL = 'ESPECIFICACIONES_TECNICAS';
  var ESTADO_FINAL = 'PERFECCIONADA';

  // ---------------------------------------------------------------------------
  // Límite de la aclaración (ORDEN-RONDA-10 §2.1, enmienda 2026-08-19 de
  // ADR-014). Definición ÚNICA: los demás módulos la importan de acá.
  //  - MAX_ACLARACION (256): lo que se imprime en el requerimiento; es también
  //    el umbral de desborde hacia el anexo de EETT (ADR-022/H12). Coincide con
  //    el límite del sistema oficial.
  //  - MAX_ACLARACION_TOTAL (2000): tope duro de entrada. El texto que supera
  //    los 256 no se rechaza: va completo al anexo; a partir de este tope sí se
  //    rechaza, porque nadie transcribe más que eso y el campo no es un cajón
  //    de sastre (enmienda ADR-014, riesgo del piloto).
  // ---------------------------------------------------------------------------
  var MAX_ACLARACION = 256;
  var MAX_ACLARACION_TOTAL = 2000;

  // Tope duro de la justificación (ORDEN-RONDA-10-CIERRE §1.3, auditoría
  // §2.4: "¿qué pasa si el usuario pega un texto de 50.000 caracteres en la
  // justificación?"). Definición ÚNICA, misma lógica que MAX_ACLARACION_TOTAL:
  // es un campo de formulario con destino al documento impreso, no un
  // repositorio. Veinte mil caracteres son ~10 páginas; nadie justifica una
  // necesidad con más que eso. Aplica a `fundamentacion.justificacion` y a
  // `requerimiento.justificacionNecesidad`, y lo valida el servidor por su
  // cuenta (server/expedientes.js) además de la pantalla.
  var MAX_JUSTIFICACION = 20000;

  // ---------------------------------------------------------------------------
  // Entregables del circuito (ORDEN-RONDA-08 §2.1). Cada documento que una fase
  // produce queda registrado con un id estable: el mismo id es el que
  // `validacion.validarParaAvanzar` exige en `entregablesObligatorios`, el que
  // `guardarEntregable` guarda en la entrada del expediente y el que la vista
  // usa para elegir la plantilla. El id no cambia aunque cambie el nombre del
  // archivo o el título impreso.
  // ---------------------------------------------------------------------------
  var ENTREGABLES = [
    {
      id: 'especificacion-tecnica',
      estado: 'ESPECIFICACIONES_TECNICAS',
      fase: 1,
      archivo: 'especificacion-tecnica.html',
      titulo: 'Especificación Técnica'
    },
    {
      // Anexo de Especificaciones Técnicas (ORDEN-RONDA-10 §3.2, H12). No es
      // obligatorio en ningún estado: sólo se genera cuando algún renglón
      // desborda o hay condiciones particulares. `entregableDelEstado` devuelve
      // el primer match, así que la plantilla del requerimiento sigue siendo la
      // del estado; este id existe para que `guardarEntregable` lo acepte.
      id: 'anexo-eett',
      estado: 'ESPECIFICACIONES_TECNICAS',
      fase: 1,
      archivo: 'anexo-eett.html',
      titulo: 'Anexo de Especificaciones Técnicas'
    },
    {
      id: 'solicitud-contratacion',
      estado: 'SOLICITUD_CONTRATACION',
      fase: 2,
      archivo: 'solicitud-contratacion.html',
      titulo: 'Solicitud de Contratación (SCo)'
    },
    {
      id: 'pliego-bases-condiciones',
      estado: 'FIRMAS_PLIEGO_DISPOSICION',
      fase: 5,
      archivo: 'pliego-bases-condiciones.html',
      titulo: 'Pliego de Bases y Condiciones'
    },
    {
      id: 'disposicion-adjudicacion',
      estado: 'FIRMA_DISPOSICION',
      fase: 7,
      archivo: 'disposicion-adjudicacion.html',
      titulo: 'Disposición de Adjudicación'
    },
    {
      id: 'orden-compra',
      estado: 'GENERACION_ORDEN_COMPRA',
      fase: 9,
      archivo: 'orden-compra.html',
      titulo: 'Orden de Compra'
    }
  ];

  // El entregable que produce un estado (o null si el estado no produce).
  function entregableDelEstado(idEstado) {
    for (var i = 0; i < ENTREGABLES.length; i++) {
      if (ENTREGABLES[i].estado === idEstado) {
        return ENTREGABLES[i];
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Fases del FSD §4 (ORDEN-RONDA-06 §3.1). El tablero Kanban arma una columna
  // por fase (ADR-010), nunca por estado: dieciocho columnas obligarían a
  // desplazamiento horizontal permanente. El estado puntual va como etiqueta
  // dentro de la tarjeta.
  // ---------------------------------------------------------------------------
  var FASES = [
    { numero: 1, titulo: 'Fase 1 · Usuario' },
    { numero: 2, titulo: 'Fase 2 · Abastecimiento' },
    { numero: 3, titulo: 'Fase 3 · Contrataciones' },
    { numero: 4, titulo: 'Fase 4 · Asesoría Jurídica' },
    { numero: 5, titulo: 'Fase 5 · Contrataciones' },
    { numero: 6, titulo: 'Fase 6 · Asesoría Jurídica' },
    { numero: 7, titulo: 'Fase 7 · Contrataciones' },
    { numero: 8, titulo: 'Fase 8 · Contaduría' },
    { numero: 9, titulo: 'Fase 9 · Contrataciones' },
    { numero: 10, titulo: 'Fase 10 · Abastecimiento' }
  ];

  SGC.core.config = {
    ROLES: ROLES,
    ESTADOS: ESTADOS,
    ENTREGABLES: ENTREGABLES,
    MOTIVOS_DEVOLUCION: MOTIVOS_DEVOLUCION,
    FASES: FASES,
    ESTADO_INICIAL: ESTADO_INICIAL,
    ESTADO_FINAL: ESTADO_FINAL,
    MAX_ACLARACION: MAX_ACLARACION,
    MAX_ACLARACION_TOTAL: MAX_ACLARACION_TOTAL,
    MAX_JUSTIFICACION: MAX_JUSTIFICACION,
    entregableDelEstado: entregableDelEstado
  };
})(typeof window !== 'undefined' ? window : globalThis);

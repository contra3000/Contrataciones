/*
 * config.js
 * Máquina de estados declarativa de los 18 pasos del circuito de
 * contrataciones. Es el corazón del sistema: las vistas jamás conocen
 * los estados, sólo leen de este archivo.
 *
 * Fuentes:
 *  - Los 18 pasos, sus fases y sectores: FullScopeDoc.md §4.
 *  - Los roles: FullScopeDoc.md §3 (la sección §10.1 de InstruccionesCodigo.md
 *    no está disponible en el repositorio; ver INFORME.md §4).
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
    { id: 'gestor_abastecimiento', nombre: 'Gestor de Abastecimiento', sector: 'abastecimiento', esComun: false },
    { id: 'supervisor_abastecimiento', nombre: 'Supervisor de Abastecimiento', sector: 'abastecimiento', esComun: false },
    { id: 'gestor_contrataciones', nombre: 'Gestor de Contrataciones', sector: 'contrataciones', esComun: false },
    { id: 'supervisor_contrataciones', nombre: 'Supervisor de Contrataciones', sector: 'contrataciones', esComun: false },
    { id: 'asesoria_juridica', nombre: 'Asesoría Jurídica', sector: 'juridica', esComun: true },
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
      entregablesObligatorios: []
    },
    {
      id: 'SOLICITUD_CONTRATACION',
      numero: 2,
      titulo: 'Solicitud de Contratación (SCo)',
      fase: 2,
      rolEjecutor: 'gestor_abastecimiento',
      estadosSiguientes: ['ANALISIS_SCo'],
      estadosDevolucion: ['ESPECIFICACIONES_TECNICAS'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'ANALISIS_SCo',
      numero: 3,
      titulo: 'Análisis de SCo',
      fase: 2,
      rolEjecutor: 'gestor_abastecimiento',
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
      rolEjecutor: 'supervisor_abastecimiento',
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
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'asesoria_juridica',
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
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'supervisor_contrataciones',
      estadosSiguientes: ['PUBLICACION'],
      estadosDevolucion: ['DILIGENCIA'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'PUBLICACION',
      numero: 10,
      titulo: 'Publicación',
      fase: 5,
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'asesoria_juridica',
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
      rolEjecutor: 'supervisor_contrataciones',
      estadosSiguientes: ['ADJUDICACION'],
      estadosDevolucion: ['DICTAMEN_FINAL'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'ADJUDICACION',
      numero: 15,
      titulo: 'Adjudicación',
      fase: 7,
      rolEjecutor: 'gestor_contrataciones',
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
      rolEjecutor: 'gestor_contrataciones',
      estadosSiguientes: ['PERFECCIONADA'],
      estadosDevolucion: ['AFECTACION'],
      camposRequeridos: [],
      entregablesObligatorios: []
    },
    {
      id: 'PERFECCIONADA',
      numero: 18,
      titulo: 'Perfeccionada',
      fase: 10,
      rolEjecutor: 'gestor_abastecimiento',
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

  SGC.core.config = {
    ROLES: ROLES,
    ESTADOS: ESTADOS,
    MOTIVOS_DEVOLUCION: MOTIVOS_DEVOLUCION,
    ESTADO_INICIAL: ESTADO_INICIAL,
    ESTADO_FINAL: ESTADO_FINAL
  };
})(typeof window !== 'undefined' ? window : globalThis);

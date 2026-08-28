'use strict';

/*
 * ronda-11.test.js
 * ORDEN-RONDA-11 (H13 — ANEXO 1 y salida hacia el pliego):
 *
 *  - ADR-029: validacion.js y requerimiento.js (core/renders) exigen que
 *    anexo-eett.js esté cargado; si falta, throw con mensaje claro.
 *  - Integridad: verificarModulos lanza cuando falta un módulo del MANIFEST;
 *    alternativamente, verificar que los archivos del MANIFEST existen en disco.
 *  - R17 label: la columna de cantidad máxima en el requerimiento incluye
 *    "por Solicitud de Provisión" y no se queda con el nombre genérico.
 *  - ANEXO 1: componer produce HTML con las 14 secciones (§1–§14, con las
 *    condicionales §9–§12 ausentes cuando no corresponden); montar produce
 *    nodos DOM sin innerHTML (ADR-011).
 *  - YAML: escalar maneja dos puntos, comillas y caracteres especiales;
 *    emitir produce mapas y listas válidos.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'autorizacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-1.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'export', 'pliego-yaml.js'));

const { documento, obtenerConteoInnerHTML } = require('./helpers/dom-stub.js');
const { nodo } = require('./helpers/wizard-montura.js');

const SGC = globalThis.SGC;
const config = SGC.core.config;
const validacion = SGC.core.validacion;
const req = SGC.core.requerimiento;
const anexoUno = SGC.renders.anexoUno;
const yaml = SGC.descargas.pliegoYaml;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expedienteEnEstado(estadoId) {
  return {
    id: '2026-R11-001',
    estado: { id: estadoId, fase: 1, desde: '2026-08-20T10:00:00.000Z' },
    version: 1,
    actualizado: '2026-08-20T10:00:00.000Z',
    campos: {},
    entregables: [],
    auditoria: [],
    renglones: []
  };
}

function expedienteConAnexo1() {
  return {
    datos: {
      titulo: 'Adquisición de bienes',
      identificacion: { numero: '42' },
      renglones: [],
      anexo1: {
        titulo: 'Análisis de Abastecimiento',
        expediente: '2026-R11-042',
        objeto: 'Compra de insumos oficina',
        justificacion: 'Reposición de stocks agotados',
        empresasConsultadas: ['Distribuidora Norte S.A.', 'Insumos Sur S.R.L.'],
        precioReferencia: '$ 1.250.000',
        monedaExtranjera: '',
        pacPrevisto: 'Sí',
        pacNumeroOrden: 'PAC-2026-015',
        pacTrimestre: '1° trimestre',
        unidadResponsable: 'División Administrativa',
        usuarioGde: 'juan.perez@faa.mil.ar',
        unidadDireccion: 'Av. Libertador 1234',
        unidadTelefono: '011-5555-1234',
        unidadCorreo: 'admin@faa.mil.ar',
        lugarEntrega: 'Depósito central FAA',
        lugarFacturacion: 'Contaduría FAA',
        comisionRecepcion: 'Comisión de Recepción N° 3',
        personalTecnico: 'Ing. García, Lic. Martínez',
        requisitosMinimos: 'Material de primera calidad',
        visitaMuestra: '2026-09-15 a las 10:00',
        interadministrativa: '',
        bienesUso: '',
        hardwareSoftware: '',
        reparacionesInfra: '',
        documentacionObligatoria: 'Certificado de origen, RNE',
        criterioEvaluacion: 'Mejor oferta precio-calidad'
      }
    }
  };
}

// ---------------------------------------------------------------------------
// 1. ADR-029: validacion.js validarParaAvanzar throws when anexo-eett.js not loaded
// ---------------------------------------------------------------------------
test('ADR-029: validarParaAvanzar lanza cuando anexo-eett.js no está cargado', () => {
  const original = SGC.core.anexoEett;
  try {
    SGC.core.anexoEett = undefined;
    assert.throws(
      () => validacion.validarParaAvanzar(expedienteEnEstado('ESPECIFICACIONES_TECNICAS')),
      /anexo-eett\.js/,
      'validarParaAvanzar debe exigir que anexo-eett.js esté cargado'
    );
  } finally {
    SGC.core.anexoEett = original;
  }
});

// ---------------------------------------------------------------------------
// 2. ADR-029: validacion.js validarRequerimiento throws when anexo-eett.js not loaded
// ---------------------------------------------------------------------------
test('ADR-029: validarRequerimiento lanza cuando anexo-eett.js no está cargado', () => {
  const originalRequerimiento = SGC.core.requerimiento;
  try {
    SGC.core.requerimiento = undefined;
    assert.throws(
      () => validacion.validarRequerimiento({ renglones: [] }),
      /requerimiento\.js/,
      'validarRequerimiento debe exigir que core/requerimiento.js esté cargado'
    );
  } finally {
    SGC.core.requerimiento = originalRequerimiento;
  }
});

// ---------------------------------------------------------------------------
// 3. ADR-029: renders/requerimiento.js modelo() throws when anexo-eett.js not loaded
// ---------------------------------------------------------------------------
test('ADR-029: renders/requerimiento.js modelo() lanza cuando anexo-eett.js no está cargado', () => {
  const original = SGC.core.anexoEett;
  try {
    SGC.core.anexoEett = undefined;
    const rendersReq = SGC.renders.requerimiento;
    assert.throws(
      () => rendersReq.modelo(expedienteEnEstado('ESPECIFICACIONES_TECNICAS')),
      /anexo-eett\.js/,
      'modelo() del requerimiento debe exigir que anexo-eett.js esté cargado'
    );
  } finally {
    SGC.core.anexoEett = original;
  }
});

// ---------------------------------------------------------------------------
// 4. Integridad: verificarModulos falla al quitar un módulo de SGC
// ---------------------------------------------------------------------------
test('integridad: verificarModulos lanza cuando un módulo no está en SGC', () => {
  const { verificarModulos } = require(path.join(RAIZ, 'server', 'integridad.js'));
  const listaCompleta = [
    'namespaces.js', 'config.js', 'cotas-encabezado.js', 'autorizacion.js',
    'auditoria.js', 'migraciones.js', 'utils.js', 'requerimiento.js',
    'anexo-eett.js', 'validacion.js', 'estados.js'
  ];
  // Sin quitar nada: pasa
  assert.ok(verificarModulos(listaCompleta) > 0, 'pasa con la lista completa');

  // Sacamos un módulo de SGC.core y verificamos que lanza
  const original = SGC.core.config;
  try {
    SGC.core.config = undefined;
    assert.throws(
      () => verificarModulos(listaCompleta),
      /faltan los módulos/,
      'lanza cuando un módulo no está registrado en SGC'
    );
  } finally {
    SGC.core.config = original;
  }
});

// ---------------------------------------------------------------------------
// 5. R17 label: OCA column header includes "por Solicitud de Provisión"
// ---------------------------------------------------------------------------
test('R17: la columna de cantidad máxima del OCA incluye "por Solicitud de Provisión"', () => {
  const ENCABEZADOS_OCA_REQUERIMIENTO = [
    'N°', 'Código', 'Cantidad solicitada',
    'Cantidad máxima (por Solicitud de Provisión)', 'Cantidad mínima (opcional)'
  ];
  const columnaMaxima = ENCABEZADOS_OCA_REQUERIMIENTO[3];
  assert.ok(
    columnaMaxima.includes('por Solicitud de Provisión'),
    'la columna debe aclarar que la cantidad máxima es por Solicitud de Provisión'
  );
  assert.ok(
    !/^(Cantidad máxima|Cantidad maxima)$/i.test(columnaMaxima),
    'la columna NO debe ser simplemente "Cantidad máxima" sin contexto'
  );
  assert.ok(
    columnaMaxima.includes('Cantidad máxima'),
    'la columna conserva "Cantidad máxima" como base'
  );
});

// ---------------------------------------------------------------------------
// 6. ANEXO 1 render: componer produces HTML with all sections
// ---------------------------------------------------------------------------
test('ANEXO 1: componer produce HTML con todas las secciones', () => {
  const expediente = expedienteConAnexo1();
  const html = anexoUno.componer(expediente);

  assert.ok(html.includes('<!DOCTYPE html>'), 'produces a complete HTML document');
  assert.ok(html.includes('§1 Objeto y justificación'), '§1 present');
  assert.ok(html.includes('§2 Precio de referencia'), '§2 present');
  assert.ok(html.includes('§3 PAC'), '§3 present');
  assert.ok(html.includes('§4 Unidad requirente'), '§4 present');
  assert.ok(html.includes('§5 Comisión de recepción'), '§5 present');
  assert.ok(html.includes('§6 Personal técnico'), '§6 present');
  assert.ok(html.includes('§7 Requisitos mínimos'), '§7 present');
  assert.ok(html.includes('§13 Documentación obligatoria'), '§13 present');
  assert.ok(html.includes('§14 Criterio de evaluación'), '§14 present');

  assert.ok(html.includes('Compra de insumos oficina'), 'objeto rendered');
  assert.ok(html.includes('Reposición de stocks agotados'), 'justificación rendered');
  assert.ok(html.includes('Distribuidora Norte S.A.'), 'empresas consultadas rendered');

  // Conditional sections 9-12 are empty → must NOT appear
  assert.ok(!html.includes('§9 Caso interadministrativo'), '§9 absent when empty');
  assert.ok(!html.includes('§10 Bienes de uso'), '§10 absent when empty');
  assert.ok(!html.includes('§11 Hardware / Software'), '§11 absent when empty');
  assert.ok(!html.includes('§12 Reparaciones de infraestructura'), '§12 absent when empty');
});

test('ANEXO 1: componer incluye secciones condicionales cuando se proporcionan datos', () => {
  const expediente = expedienteConAnexo1();
  expediente.datos.anexo1.interadministrativa = 'Contrato interadministrativo con MOP';
  expediente.datos.anexo1.bienesUso = 'Sillas ergonómicas';
  const html = anexoUno.componer(expediente);

  assert.ok(html.includes('§9 Caso interadministrativo'), '§9 present when data provided');
  assert.ok(html.includes('MOP'), '§9 content rendered');
  assert.ok(html.includes('§10 Bienes de uso'), '§10 present when data provided');
  assert.ok(html.includes('Sillas ergonómicas'), '§10 content rendered');
  // §11 and §12 still absent
  assert.ok(!html.includes('§11 Hardware / Software'), '§11 still absent');
  assert.ok(!html.includes('§12 Reparaciones de infraestructura'), '§12 still absent');
});

// ---------------------------------------------------------------------------
// 7. ANEXO 1 render: montar populates DOM without innerHTML (ADR-011)
// ---------------------------------------------------------------------------
test('ANEXO 1: montar puebla el DOM con textContent, sin innerHTML (ADR-011)', () => {
  globalThis.document = documento;

  const expediente = expedienteConAnexo1();
  const contenedor = nodo('div', 'sgc-test-anexo1');
  const conteoAntes = obtenerConteoInnerHTML();

  anexoUno.montar(contenedor, expediente);

  assert.equal(obtenerConteoInnerHTML(), conteoAntes, 'no se usó innerHTML');

  const texto = [];
  const recorrer = (n) => {
    if (n.textContent) { texto.push(n.textContent); }
    for (const hijo of n.children) { recorrer(hijo); }
  };
  recorrer(contenedor);
  const textoUnido = texto.join(' ');

  assert.ok(textoUnido.includes('ANEXO 1'), 'encabezado del documento');
  assert.ok(textoUnido.includes('§1 Objeto y justificación'), '§1 en DOM');
  assert.ok(textoUnido.includes('§2 Precio de referencia'), '§2 en DOM');
  assert.ok(textoUnido.includes('§4 Unidad requirente'), '§4 en DOM');
  assert.ok(textoUnido.includes('§7 Requisitos mínimos'), '§7 en DOM');
  assert.ok(textoUnido.includes('§13 Documentación obligatoria'), '§13 en DOM');
  assert.ok(textoUnido.includes('§14 Criterio de evaluación'), '§14 en DOM');

  assert.ok(!textoUnido.includes('§9 Caso interadministrativo'), '§9 no en DOM cuando vacío');
  assert.ok(!textoUnido.includes('§10 Bienes de uso'), '§10 no en DOM cuando vacío');
  assert.ok(!textoUnido.includes('§11 Hardware / Software'), '§11 no en DOM cuando vacío');
  assert.ok(!textoUnido.includes('§12 Reparaciones de infraestructura'), '§12 no en DOM cuando vacío');
});

// ---------------------------------------------------------------------------
// 8. YAML emitter: escalar handles colons, quotes, and special characters
// ---------------------------------------------------------------------------
test('YAML: escalar envuelve en comillas dobles cuando contiene dos puntos con espacio', () => {
  assert.equal(yaml.escalar('value: with colon'), '"value: with colon"', 'dos puntos seguidos de espacio');
  assert.equal(yaml.escalar('key: value'), '"key: value"', 'par clave:valor como escalar');
  assert.equal(yaml.escalar('a: b: c'), '"a: b: c"', 'múltiples dos puntos');
});

test('YAML: escalar siempre entrecomilla cadenas (ADR-031)', () => {
  assert.equal(yaml.escalar('simple'), '"simple"', 'palabra simple entrecomillada');
  assert.equal(yaml.escalar(''), '""', 'cadena vacía → comillas dobles vacías');
  assert.equal(yaml.escalar(null), '""', 'null → comillas dobles vacías');
  assert.equal(yaml.escalar(undefined), '""', 'undefined → comillas dobles vacías');
  assert.equal(yaml.escalar(42), '42', 'número sin comillas');
  assert.equal(yaml.escalar(true), 'true', 'booleano JS sin comillas');
});

test('YAML: escalar envuelve en comillas dobles para #, -, booleanos YAML, números', () => {
  assert.equal(yaml.escalar('value # comment'), '"value # comment"', 'hash con espacio');
  assert.equal(yaml.escalar('- item'), '"- item"', 'guión al inicio');
  assert.equal(yaml.escalar('true'), '"true"', 'booleano YAML');
  assert.equal(yaml.escalar('no'), '"no"', 'booleano YAML');
  assert.equal(yaml.escalar(42), '42', 'número sin comillas');
  assert.equal(yaml.escalar(true), 'true', 'booleano JS sin comillas');
});

test('YAML: emitir produce pares clave-valor y listas de mapas', () => {
  const simple = yaml.emitir({ objeto: 'Compra de resmas', anio: '2026' });
  assert.ok(simple.includes('objeto:'), 'clave simple');
  assert.ok(simple.includes('"Compra de resmas"'), 'valor entrecomillado');
  assert.ok(simple.includes('anio:'), 'segunda clave');
  assert.ok(simple.endsWith('\n'), 'termina con newline');

  const conLista = yaml.emitir({
    organismos_requirentes: [
      { nombre: 'FAA', cuit: '30-71234567-9' },
      { nombre: 'DGCyC', cuit: '30-79876543-2' }
    ]
  });
  assert.ok(conLista.includes('organismos_requirentes:'), 'lista tiene clave');
  assert.ok(conLista.includes('- nombre:'), 'elemento de lista');
  assert.ok(conLista.includes('"FAA"'), 'primer elemento');
  assert.ok(conLista.includes('"DGCyC"'), 'segundo elemento');

  const conEspeciales = yaml.emitir({
    objeto: 'Artículo con ñ y á',
    nota: '# Etiqueta importante',
    estado: 'activo'
  });
  assert.ok(conEspeciales.includes('"Artículo con ñ y á"'), 'acentos y ñ entrecomillados');
  assert.ok(conEspeciales.includes('"# Etiqueta importante"'), 'hash con espacio escapado en comillas');
  assert.ok(conEspeciales.includes('"activo"'), 'valor simple entrecomillado');
});

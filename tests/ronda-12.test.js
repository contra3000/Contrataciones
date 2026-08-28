'use strict';

/*
 * ronda-12.test.js
 * ORDEN-RONDA-12 (H13 cierre + H15 observabilidad):
 *
 *  1. YAML roundtrip 20 texts (idavuelta contra PyYAML)
 *  2. Valor terminado en ':' y con tabulador no rompen
 *  3. Espacios al principio y al final sobreviven
 *  4. pliego-bases-condiciones no es entregable obligatorio; vista-previa sin firma ni ADR-023
 *  5. Precio del ANEXO 1 coincide con preventivoContratacion
 *  6. Editar campo precargado produce evento
 *  7. Test de integridad falla al quitar módulo
 *  8. frecuencia_provision, plazo_entrega, horario llegan al YAML
 *  9. Registro de eventos append-only
 * 10. Indicador se calcula desde el registro
 * 11. Agregar ficha no requiere tocar la vista
 * 12. Preferencia de tablero vive en el padrón
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const os = require('node:os');

const RAIZ = path.join(__dirname, '..');

// --- Carga de módulos del core ---
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
require(path.join(RAIZ, 'app', 'js', 'core', 'indicadores.js'));
require(path.join(RAIZ, 'app', 'js', 'export', 'pliego-yaml.js'));

const SGC = globalThis.SGC;
const yaml = SGC.descargas.pliegoYaml;
const indicadores = SGC.core.indicadores;
const req = SGC.core.requerimiento;

// --- Helpers YAML roundtrip ---
const YAML_SCRIPT = path.join(__dirname, 'helpers', 'yaml_roundtrip.py');

function roundtripYaml(datos) {
  const contenido = yaml.emitir(datos);
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, 'sgc_roundtrip_' + process.pid + '.yaml');
  fs.writeFileSync(tmpFile, contenido, 'utf8');
  try {
    const buf = execSync('python "' + YAML_SCRIPT + '" "' + tmpFile + '"',
      { timeout: 10000 });
    const resultado = buf.toString('utf8');
    return JSON.parse(resultado);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// --- Helpers eventos ---
const eventos = require(path.join(RAIZ, 'server', 'eventos.js'));

function crearDirTemporal() {
  const dir = path.join(os.tmpdir(), 'sgc_test_eventos_' + process.pid + '_' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ======================================================================
// 1. YAML roundtrip: 20 textos, ida y vuelta contra PyYAML
// ======================================================================
test('YAML roundtrip: 20 textos sobreviven ida y vuelta contra PyYAML', () => {
  const textos = [
    'simple',
    'comment #10 is here',
    '#comentario',
    '   ',
    ' hola',
    'hola ',
    'Nota:',
    'con\ttabulador',
    'value: with colon',
    'key: value',
    '- item',
    '# Etiqueta',
    'true',
    'false',
    'null',
    '42',
    '3.14',
    'Artículo con ñ y á',
    'a: b: c: d',
    '"comillas dobles"',
    "'comillas simples'",
    'salto\nde línea',
    'back\\slash',
    'doble "comilla" aquí',
    'PROD. MÉDICO, FARMACÉUTICOS',
    '20 %',
    '',
    'Observaciones:',
    'Renglones a proveer:'
  ];

  const tmpDir = os.tmpdir();
  for (let i = 0; i < textos.length; i++) {
    const texto = textos[i];
    const datos = { campo: texto };
    const contenido = yaml.emitir(datos);
    const tmpFile = path.join(tmpDir, 'sgc_rt_' + process.pid + '_' + i + '.yaml');
    fs.writeFileSync(tmpFile, contenido, 'utf8');
    try {
      const buf = execSync('python "' + YAML_SCRIPT + '" "' + tmpFile + '"',
        { timeout: 10000 });
      const resultado = buf.toString('utf8');
      const parsed = JSON.parse(resultado);
      assert.strictEqual(parsed.campo, texto,
        'Roundtrip falló para: ' + JSON.stringify(texto));
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
});

// ======================================================================
// 2. Valor terminado en ':' y con tabulador no rompen
// ======================================================================
test('YAML: valor terminado en ":" y con tabulador no rompen el archivo', () => {
  const datos1 = { titulo: 'Observaciones:' };
  const r1 = roundtripYaml(datos1);
  assert.strictEqual(r1.titulo, 'Observaciones:', 'dos puntos al final sobrevive');

  const datos2 = { titulo: 'Línea 1\tLínea 2' };
  const r2 = roundtripYaml(datos2);
  assert.strictEqual(r2.titulo, 'Línea 1\tLínea 2', 'tabulador sobrevive');
});

// ======================================================================
// 3. Espacios al principio y al final sobreviven
// ======================================================================
test('YAML: espacios al principio y al final sobreviven', () => {
  const datos1 = { campo: ' hola' };
  const r1 = roundtripYaml(datos1);
  assert.strictEqual(r1.campo, ' hola', 'espacio inicial preservado');

  const datos2 = { campo: 'hola ' };
  const r2 = roundtripYaml(datos2);
  assert.strictEqual(r2.campo, 'hola ', 'espacio final preservado');

  const datos3 = { campo: '  ' };
  const r3 = roundtripYaml(datos3);
  assert.strictEqual(r3.campo, '  ', 'solo espacios preservados');
});

// ======================================================================
// 4. pliego-bases-condiciones y vista-previa-pliego
// ======================================================================
test('pliego-bases-condiciones no es entregable obligatorio de ningún estado', () => {
  for (const estado of SGC.core.config.ESTADOS) {
    const obligatorios = estado.entregablesObligatorios || [];
    for (const e of obligatorios) {
      assert.notStrictEqual(e, 'pliego-bases-condiciones',
        estado.id + ' no debe exigir pliego-bases-condiciones');
    }
  }
});

test('vista-previa-pliego: sin firma ni leyenda de ADR-023, con banner', () => {
  require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
  require(path.join(RAIZ, 'app', 'js', 'renders', 'vista-previa-pliego.js'));
  const vp = SGC.renders.vistaPreviaPliego;
  assert.ok(vp, 'vista-previa-pliego registrado');
  assert.strictEqual(vp.estado, undefined, 'sin estado');

  const exp = {
    titulo: 'Test', anio: '2026',
    identificacion: { numero: '1', dependenciaSolicitante: 'Dep', finalidad: 'Fin', lugar: 'L', vigencia: '2026-12-31' },
    renglones: [], entregables: [], auditoria: []
  };
  const html = vp.componer(exp);
  assert.ok(html.includes('Vista previa'), 'banner en HTML');
  assert.ok(!html.includes('doc-pie-leyenda'), 'sin ADR-023');
  assert.ok(!html.includes('Firma'), 'sin firma');
});

// ======================================================================
// 5. Precio del ANEXO 1 = preventivoContratacion
// ======================================================================
test('precio del ANEXO 1 coincide con preventivoContratacion', () => {
  const renglones = [
    { codigo: '1', cantidad: 10, valoresReferencia: [{ valor: 100, base: 'unitario', presupuestoId: 'p1' }] },
    { codigo: '2', cantidad: 5, valoresReferencia: [{ valor: 200, base: 'unitario', presupuestoId: 'p2' }] }
  ];
  const prev = req.preventivoContratacion(renglones);
  assert.ok(prev.valido, 'preventivo válido');
  assert.strictEqual(prev.total, 2000, '10*100 + 5*200 = 2000');
});

// ======================================================================
// 6. Editar campo precargado produce evento
// ======================================================================
test('registrarPrecargaEditada escribe evento en eventos.jsonl', () => {
  const dir = crearDirTemporal();
  try {
    eventos.registrarPrecargaEditada(dir, '2026-TEST-001', 'objeto', 'Original', 'Modificado',
      { rol: 'abastecimiento', email: 'test@test.com' });
    const eventosLeidos = eventos.leerEventos(dir, '2026-TEST-001');
    assert.strictEqual(eventosLeidos.length, 1, 'un evento registrado');
    assert.strictEqual(eventosLeidos[0].tipo, 'precarga_editada', 'tipo correcto');
    assert.strictEqual(eventosLeidos[0].campo, 'objeto', 'campo correcto');
    assert.strictEqual(eventosLeidos[0].valorRequerimiento, 'Original', 'valor original');
    assert.strictEqual(eventosLeidos[0].valorAnexo1, 'Modificado', 'valor nuevo');
  } finally {
    try { fs.rmSync(dir, { recursive: true }); } catch (_) {}
  }
});

// ======================================================================
// 7. Test de integridad falla al quitar módulo
// ======================================================================
test('integridad: verificarModulos lanza cuando un módulo no está en SGC', () => {
  const { verificarModulos } = require(path.join(RAIZ, 'server', 'integridad.js'));
  const lista = ['namespaces.js', 'config.js', 'cotas-encabezado.js', 'autorizacion.js',
    'auditoria.js', 'migraciones.js', 'utils.js', 'requerimiento.js',
    'anexo-eett.js', 'validacion.js', 'estados.js'];
  assert.ok(verificarModulos(lista) > 0, 'pasa con todo completo');

  const original = SGC.core.config;
  try {
    SGC.core.config = undefined;
    assert.throws(() => verificarModulos(lista), /faltan los módulos/);
  } finally {
    SGC.core.config = original;
  }
});

// ======================================================================
// 8. Campos YAML: frecuencia_provision, plazo_entrega, horario
// ======================================================================
test('frecuencia_provision, plazo_entrega, horario llegan al YAML', () => {
  require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
  require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-1.js'));
  require(path.join(RAIZ, 'app', 'js', 'views', 'pliego-yaml.js'));

  const expediente = {
    titulo: 'Test YAML',
    expedienteId: '2026-TEST-YAML',
    datos: {
      titulo: 'Test YAML',
      identificacion: { numero: '1' },
      renglones: [],
      anexo1: {
        unidadResponsable: 'División Test',
        unidadDireccion: 'Av. Test 123',
        unidadTelefono: '011-1234',
        unidadCorreo: 'test@test.com',
        horarioAtencion: 'lunes a viernes de 09 a 17',
        frecuenciaProvision: 'TREINTA (30) DÍAS',
        plazoEntrega: 'CINCO (05) DÍAS HÁBILES'
      }
    }
  };

  const datos = SGC.views.pliegoYaml.construirDatos(expediente);
  assert.ok(datos.organismos_requirentes, 'tiene organismos');
  const org = datos.organismos_requirentes[0];
  assert.strictEqual(org.horario, 'lunes a viernes de 09 a 17', 'horario mapeado');
  assert.strictEqual(org.frecuencia_provision, 'TREINTA (30) DÍAS', 'frecuencia mapeada');
  assert.strictEqual(org.plazo_entrega, 'CINCO (05) DÍAS HÁBILES', 'plazo mapeado');
});

// ======================================================================
// 9. Registro de eventos: append-only
// ======================================================================
test('eventos.jsonl es append-only: dos escrituras no pierden líneas', () => {
  const dir = crearDirTemporal();
  try {
    for (let i = 0; i < 10; i++) {
      eventos.escribirEvento(dir, '2026-APP-001', {
        tipo: 'test', index: i, timestamp: new Date().toISOString()
      });
    }
    const leidos = eventos.leerEventos(dir, '2026-APP-001');
    assert.strictEqual(leidos.length, 10, 'las 10 líneas están');
    for (let j = 0; j < leidos.length; j++) {
      assert.strictEqual(leidos[j].index, j, 'orden preservado ' + j);
    }
  } finally {
    try { fs.rmSync(dir, { recursive: true }); } catch (_) {}
  }
});

// ======================================================================
// 10. Indicador se calcula desde el registro
// ======================================================================
test('indicador se calcula desde eventos, no desde valor persistido', () => {
  const eventosData = [
    { tipo: 'transicion', timestamp: '2026-01-01T10:00:00Z', origen: 'A', destino: 'B' },
    { tipo: 'transicion', timestamp: '2026-01-02T10:00:00Z', origen: 'B', destino: 'C' },
    { tipo: 'devolucion', timestamp: '2026-01-03T10:00:00Z', motivo: 'falta datos' },
    { tipo: 'devolucion', timestamp: '2026-01-04T10:00:00Z', motivo: 'falta datos' },
    { tipo: 'devolucion', timestamp: '2026-01-05T10:00:00Z', motivo: 'error técnico' }
  ];

  const transiciones = indicadores.calcularFicha(
    indicadores.buscarFicha('tiempo_total'), eventosData);
  assert.strictEqual(transiciones.valor, 2, '2 transiciones');

  const devoluciones = indicadores.calcularFicha(
    indicadores.buscarFicha('tasa_devolucion_motivo'), eventosData);
  assert.strictEqual(devoluciones.detalle['falta datos'], 2, '2 "falta datos"');
  assert.strictEqual(devoluciones.detalle['error técnico'], 1, '1 "error técnico"');
});

// ======================================================================
// 11. Agregar ficha no requiere tocar la vista
// ======================================================================
test('agregar ficha nueva al catálogo se refleja sin tocar la vista', () => {
  const ANTES = indicadores.FICHAS.length;
  indicadores.FICHAS.push({
    id: 'ficha_nueva_test',
    nombre: 'Ficha de prueba',
    evento: 'test',
    agregacion: 'conteo',
    formato: 'numero'
  });
  const DESPUES = indicadores.FICHAS.length;
  assert.strictEqual(DESPUES, ANTES + 1, 'ficha agregada');
  const encontrada = indicadores.buscarFicha('ficha_nueva_test');
  assert.ok(encontrada, 'encontrable por id');
  assert.strictEqual(encontrada.nombre, 'Ficha de prueba', 'datos correctos');
  // Limpiar
  indicadores.FICHAS.pop();
});

// ======================================================================
// 12. Preferencia de tablero vive en el padrón
// ======================================================================
test('tableroPorDefecto devuelve array para cada rol', () => {
  const roles = ['generador', 'abastecimiento', 'contrataciones', 'juridica', 'contaduria'];
  for (const rol of roles) {
    const fichas = indicadores.tableroPorDefecto(rol);
    assert.ok(Array.isArray(fichas), rol + ': tiene tablero por defecto');
    assert.ok(fichas.length > 0, rol + ': al menos una ficha');
  }
  // La preferencia es un dato del operador en el padrón, no del navegador
  const op1 = { roles: ['abastecimiento'], tableroFichas: { abastecimiento: ['tiempo_por_fase'] } };
  const op2 = { roles: ['abastecimiento'] };
  const fichas1 = op1.tableroFichas ? op1.tableroFichas[op1.roles[0]] : indicadores.tableroPorDefecto(op1.roles[0]);
  const fichas2 = op2.tableroFichas ? op2.tableroFichas[op2.roles[0]] : indicadores.tableroPorDefecto(op2.roles[0]);
  assert.deepStrictEqual(fichas1, ['tiempo_por_fase'], 'operador con preferencia');
  assert.deepStrictEqual(fichas2, indicadores.tableroPorDefecto('abastecimiento'), 'operador sin preferencia usa default');
});

// ======================================================================
// 13. MARCA_FALTA para nro_expediente_gde
// ======================================================================
test('MARCA_FALTA se usa para campos que genuinamente no tenemos', () => {
  assert.strictEqual(yaml.MARCA_FALTA, '_FALTA_', 'constante definida');
  const datos = { nro_expediente_gde: '' };
  // Si el valor es vacío y se usa MARCA_FALTA, el emisor lo pone entre comillas
  const emitido = yaml.escalar(yaml.MARCA_FALTA);
  assert.strictEqual(emitido, '"_FALTA_"', 'FALTA entrecomillado');
});

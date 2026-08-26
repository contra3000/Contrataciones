'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'utils.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'auditoria.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'validacion.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'estados.js'));

const config = globalThis.SGC.core.config;
const estados = globalThis.SGC.core.estados;
const auditoria = globalThis.SGC.core.auditoria;
const ESTADOS = config.ESTADOS;

function estadoPorId(id) {
  return ESTADOS.find((e) => e.id === id);
}

function expedienteEn(idEstado) {
  const est = estadoPorId(idEstado);
  return {
    id: '2026-001',
    numero: 1,
    anio: 2026,
    titulo: 'Expediente de prueba',
    estado: { id: idEstado, fase: est ? est.fase : null, desde: '2026-08-01T10:15:00.000Z' },
    version: 1,
    actualizado: '2026-08-01T10:15:00.000Z',
    renglones: [],
    entregables: est ? (est.entregablesObligatorios || []).slice() : [],
    auditoria: []
  };
}

function contextoPara(rol, ts) {
  return {
    email: rol + '.operador@faa.mil.ar',
    rol: rol,
    timestamp: ts || '2026-08-13T14:05:00.000Z',
    equipo: 'PC-TEST-01'
  };
}

test('1. matriz estado x rol: el rol correcto avanza y los demás no', () => {
  const roles = config.ROLES.map((r) => r.id);
  for (const estado of ESTADOS) {
    const ex = expedienteEn(estado.id);
    for (const rol of roles) {
      const r = estados.puedeAvanzar(ex, rol);
      if (rol === estado.rolEjecutor) {
        assert.equal(r.permitido, true, estado.id + ' con rol ' + rol);
        assert.equal(r.motivo, null, estado.id + ' con rol ' + rol);
      } else {
        assert.equal(r.permitido, false, estado.id + ' con rol ' + rol);
        assert.ok(r.motivo !== null, estado.id + ' con rol ' + rol);
      }
    }
  }
});

test('2. avanzar a un destino fuera de estadosSiguientes falla', () => {
  const ex = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const r = estados.avanzar(ex, 'generador', 'PERFECCIONADA', contextoPara('generador'));
  assert.equal(r.ok, false);
  assert.equal(r.expediente, null);
  assert.ok(r.error !== null && typeof r.error === 'string');
  assert.ok(r.error.indexOf('PERFECCIONADA') !== -1);
});

test('3. avanzar con el rol equivocado falla', () => {
  const ex = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const r = estados.avanzar(ex, 'contaduria', 'SOLICITUD_CONTRATACION', contextoPara('contaduria'));
  assert.equal(r.ok, false);
  assert.equal(r.expediente, null);
  assert.ok(r.error.indexOf('generador') !== -1);
});

test('4. devolver sin motivo o con motivo fuera del catálogo falla', () => {
  const ex = expedienteEn('REVISION_SCo');
  const ctx = contextoPara('contrataciones');

  const sinMotivo = estados.devolver(ex, 'contrataciones', 'AUTORIZACION_SCo', null, 'obs', ctx);
  assert.equal(sinMotivo.ok, false);
  assert.equal(sinMotivo.expediente, null);
  assert.ok(sinMotivo.error.indexOf('motivo') !== -1);

  const motivoInvalido = estados.devolver(ex, 'contrataciones', 'AUTORIZACION_SCo', 'MOTIVO_INEXISTENTE', 'obs', ctx);
  assert.equal(motivoInvalido.ok, false);
  assert.ok(motivoInvalido.error.indexOf('catálogo') !== -1);
});

test('4b. puedeDevolver: rol correcto puede devolver; el estado final no admite', () => {
  const roles = config.ROLES.map((r) => r.id);
  const ex = expedienteEn('REVISION_SCo');
  for (const rol of roles) {
    const r = estados.puedeDevolver(ex, rol);
    if (rol === 'contrataciones') {
      assert.equal(r.permitido, true);
      assert.deepEqual(r.destinos, ['AUTORIZACION_SCo']);
    } else {
      assert.equal(r.permitido, false);
    }
  }
  const final = expedienteEn(config.ESTADO_FINAL);
  const rf = estados.puedeDevolver(final, estadoPorId(config.ESTADO_FINAL).rolEjecutor);
  assert.equal(rf.permitido, false);
  assert.ok(rf.motivo.indexOf('devoluciones') !== -1);
});

test('5. pureza: avanzar y devolver no modifican el expediente de entrada', () => {
  const original = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const copia = JSON.parse(JSON.stringify(original));

  estados.avanzar(original, 'generador', 'SOLICITUD_CONTRATACION', contextoPara('generador'));
  assert.deepEqual(original, copia, 'avanzar no debe mutar el expediente');

  const paraDevolver = expedienteEn('REVISION_SCo');
  const copia2 = JSON.parse(JSON.stringify(paraDevolver));
  estados.devolver(paraDevolver, 'contrataciones', 'AUTORIZACION_SCo', 'FALTA_DOCUMENTACION', 'obs', contextoPara('contrataciones'));
  assert.deepEqual(paraDevolver, copia2, 'devolver no debe mutar el expediente');
});

test('6. determinismo: dos avances idénticos producen resultados idénticos', () => {
  const ex1 = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const ex2 = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const ctx = contextoPara('generador');
  const r1 = estados.avanzar(ex1, 'generador', 'SOLICITUD_CONTRATACION', ctx);
  const r2 = estados.avanzar(ex2, 'generador', 'SOLICITUD_CONTRATACION', ctx);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.deepEqual(r1.expediente, r2.expediente, 'el resultado y la entrada de auditoría deben ser idénticos');
  assert.equal(r1.expediente.auditoria.length, 1);
});

test('7. avanzar registra la transición en la auditoría', () => {
  const ex = expedienteEn('ESPECIFICACIONES_TECNICAS');
  const ctx = contextoPara('generador');
  const r = estados.avanzar(ex, 'generador', 'SOLICITUD_CONTRATACION', ctx);
  const entrada = r.expediente.auditoria[0];
  assert.equal(entrada.accion, 'avanzar');
  assert.equal(entrada.de, 'ESPECIFICACIONES_TECNICAS');
  assert.equal(entrada.a, 'SOLICITUD_CONTRATACION');
  assert.equal(entrada.rol, 'generador');
  assert.equal(entrada.email, ctx.email);
  assert.equal(entrada.hashPrevio, null);
  assert.deepEqual(auditoria.verificarCadena(r.expediente.auditoria), { integra: true, rotaEn: null });
});

test('8. recorrido completo con devolución: 18 estados, cadena íntegra', () => {
  let ex = expedienteEn(config.ESTADO_INICIAL);
  let actual = config.ESTADO_INICIAL;
  let vueltas = 0;
  const tope = 60;

  while (actual !== config.ESTADO_FINAL) {
    assert.ok(vueltas < tope, 'el recorrido no converge');
    vueltas++;
    const estado = estadoPorId(actual);
    const rol = estado.rolEjecutor;
    const ctx = contextoPara(rol);

    if (actual === 'REVISION_SCo') {
      const dev = estados.devolver(ex, rol, 'AUTORIZACION_SCo', 'FALTA_DOCUMENTACION', 'Falta el anexo firmado', ctx);
      assert.equal(dev.ok, true, dev.error);
      ex = dev.expediente;
      assert.equal(ex.estado.id, 'AUTORIZACION_SCo');
      assert.equal(ex.auditoria[ex.auditoria.length - 1].accion, 'devolver');

      const reavance = estados.avanzar(ex, estadoPorId('AUTORIZACION_SCo').rolEjecutor, 'REVISION_SCo', ctx);
      assert.equal(reavance.ok, true, reavance.error);
      ex = reavance.expediente;
    }

    // Un expediente que está en un estado productor ya generó su documento:
    // el motor no lo exige de nuevo (lo exige la validación al avanzar).
    const obligatorios = estado.entregablesObligatorios || [];
    for (const idEntregable of obligatorios) {
      if (ex.entregables.indexOf(idEntregable) === -1) {
        ex.entregables.push(idEntregable);
      }
    }

    const destino = estado.estadosSiguientes[0];
    const r = estados.avanzar(ex, rol, destino, ctx);
    assert.equal(r.ok, true, 'al avanzar de ' + actual + ' a ' + destino + ': ' + r.error);
    ex = r.expediente;
    actual = ex.estado.id;
  }

  assert.equal(actual, config.ESTADO_FINAL);
  assert.deepEqual(auditoria.verificarCadena(ex.auditoria), { integra: true, rotaEn: null });

  const acciones = ex.auditoria.map((e) => e.accion);
  assert.equal(acciones.filter((a) => a === 'devolver').length, 1, 'debe haber una devolución');
  assert.equal(acciones.filter((a) => a === 'avanzar').length, 18, '17 avances + el reavance posterior a la devolución');

  const ultima = ex.auditoria[ex.auditoria.length - 1];
  assert.equal(ultima.accion, 'avanzar');
  assert.equal(ultima.de, 'GENERACION_ORDEN_COMPRA');
  assert.equal(ultima.a, config.ESTADO_FINAL);
  assert.equal(ex.version, 1 + ex.auditoria.length, 'cada transición incrementa la versión');
});

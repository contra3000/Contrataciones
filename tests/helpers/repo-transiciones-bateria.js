'use strict';

/*
 * repo-transiciones-bateria.js
 * ORDEN-RONDA-07 §3.5 punto 5. Casos nuevos de las transiciones por intención
 * (ADR-021) corridos contra las dos implementaciones del contrato: repo.memoria
 * y repo.http. Si una pasa y la otra no, la semántica no está bien definida.
 *
 * El rechazo por rol, el rechazo por motivo y el conflicto de versión se
 * devuelven como valores ({ok:false, error} / {ok:false, conflicto:true}),
 * nunca como excepciones, en ambas caras.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { contextoBase, datosIniciales } = require('./repo-bateria.js');

// Operadores del padrón (config/usuarios.ejemplo.json), por rol: el cruce de
// autorización (ADR-021) exige que el rol declarado corresponda al correo.
const PADRON = {
  generador: { email: 'maria.gonzalez@faa.mil.ar' },
  abastecimiento: { email: 'juan.perez@faa.mil.ar' },
  abastecimiento_supervisor: { email: 'laura.fernandez@faa.mil.ar' },
  contrataciones: { email: 'carlos.ramirez@faa.mil.ar' },
  contrataciones_supervisor: { email: 'carlos.ramirez@faa.mil.ar' },
  juridica: { email: 'ana.torres@faa.mil.ar' },
  contaduria: { email: 'luis.diaz@faa.mil.ar' }
};

function contextoPadron(rol, extra) {
  return Object.assign({
    email: PADRON[rol].email,
    rol,
    equipo: 'PC-BATERIA'
  }, extra || {});
}

// Crea el expediente y guarda el documento que la Fase 1 (ESPECIFICACIONES_
// TECNICAS) exige para poder avanzar (ORDEN-RONDA-08 §2.1). El guardado
// versiona: el expediente queda en versión 2 y el siguiente avanzar pasa a 3.
async function crearConEntregable(ctx) {
  const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
  await ctx.repo.guardarEntregable(
    creado.id,
    'especificacion-tecnica.html',
    '<p>especificación</p>',
    contextoBase({ rol: 'generador' }),
    'especificacion-tecnica'
  );
  return creado;
}

function correrTransiciones(etiqueta, crearContexto) {
  const titulo = (nombre) => etiqueta + ': ' + nombre;
  const config = globalThis.SGC.core.config;

  const defInicial = config.ESTADOS.find((e) => e.id === 'ESPECIFICACIONES_TECNICAS');
  const destinoInicial = defInicial.estadosSiguientes[0];
  const defDestino = config.ESTADOS.find((e) => e.id === destinoInicial);

  test(titulo('avanzar con el rol correcto devuelve ok y persiste el resultado del motor'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await crearConEntregable(ctx);
      const r = await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      assert.equal(r.ok, true);
      assert.equal(r.version, 3);
      assert.equal(r.expediente.estado.id, destinoInicial);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 3);
      assert.equal(leido.expediente.estado.id, destinoInicial);
      const ultimo = leido.expediente.auditoria[leido.expediente.auditoria.length - 1];
      assert.equal(ultimo.accion, 'avanzar');
      assert.equal(ultimo.rol, 'generador', 'la entrada lleva el rol con el que el motor validó');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('avanzar con un rol que no corresponde al correo del padrón devuelve rechazo sin escribir'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      const r = await ctx.repo.avanzar(creado.id, 1, destinoInicial, {
        email: 'juan.perez@faa.mil.ar',
        rol: 'generador',
        equipo: 'PC-BATERIA'
      });
      assert.equal(r.ok, false);
      assert.equal(r.conflicto, false);
      assert.match(r.error, /no corresponde al correo/);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 1, 'el rechazo no escribe');
      assert.equal(leido.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
      assert.equal(leido.expediente.auditoria.length, 1, 'no se agrega ninguna entrada');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('avanzar con versión vieja devuelve conflicto sin tocar el estado'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await crearConEntregable(ctx);
      await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      assert.equal(r.ok, false);
      assert.equal(r.conflicto, true);
      assert.equal(r.versionRemota, 3);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 3);
      assert.equal(leido.expediente.estado.id, destinoInicial);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('devolver sin motivo válido devuelve rechazo por catálogo'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await crearConEntregable(ctx);
      await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 3, 'ESPECIFICACIONES_TECNICAS',
        'NO_EXISTE', null, contextoPadron(defDestino.rolEjecutor));
      assert.equal(r.ok, false);
      assert.match(r.error, /no pertenece al catálogo/);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.expediente.estado.id, destinoInicial);
      assert.equal(leido.version, 3);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('devolver con motivo válido y rol correcto ejecuta'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await crearConEntregable(ctx);
      await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 3, 'ESPECIFICACIONES_TECNICAS',
        'ERRORES_FORMALES', 'Observación', contextoPadron(defDestino.rolEjecutor));
      assert.equal(r.ok, true);
      assert.equal(r.version, 4);
      assert.equal(r.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
      const leido = await ctx.repo.leerExpediente(creado.id);
      const ultimo = leido.expediente.auditoria[leido.expediente.auditoria.length - 1];
      assert.equal(ultimo.accion, 'devolver');
      assert.equal(ultimo.motivo, 'ERRORES_FORMALES');
      assert.equal(ultimo.observacion, 'Observación');
      assert.equal(ultimo.rol, defDestino.rolEjecutor);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('devolver con rol válido en el padrón pero sin potestad sobre el estado recibe rechazo del motor'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await crearConEntregable(ctx);
      await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 3, 'ESPECIFICACIONES_TECNICAS',
        'ERRORES_FORMALES', null, contextoPadron('juridica'));
      assert.equal(r.ok, false);
      assert.equal(r.conflicto, false);
      assert.match(r.error, new RegExp('no puede operar sobre "' + destinoInicial + '"'));
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.expediente.estado.id, destinoInicial);
      assert.equal(leido.version, 3);
    } finally {
      await ctx.limpiar();
    }
  });
  // ORDEN-RONDA-27 pieza 3: el registro de SCo es parte del contrato de
  // persistencia, así que estos casos corren contra LAS DOS implementaciones
  // (repo.memoria y repo.http). Si una acepta algo que la otra rechaza, el
  // contrato no está bien definido y hay que arreglarlo, no eligiendo una.
  async function enSolicitudConNumero(ctx, numero) {
    const creado = await crearConEntregable(ctx);
    const r = await ctx.repo.avanzar(creado.id, 2, destinoInicial, contextoPadron('generador'));
    assert.equal(r.ok, true, 'llega a ' + destinoInicial);
    const expediente = JSON.parse(JSON.stringify(r.expediente));
    expediente.campos = expediente.campos || {};
    if (typeof numero === 'string') {
      expediente.campos.numeroSCo = numero;
    }
    return { id: creado.id, version: r.version, expediente: expediente };
  }

  test(titulo('leerSCo devuelve null antes de que exista el registro'), async () => {
    const ctx = await crearContexto();
    try {
      assert.equal(await ctx.repo.leerSCo('14/2026'), null);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('dos expedientes con el mismo número dejan un registro con los dos'), async () => {
    const ctx = await crearContexto();
    try {
      const a = await enSolicitudConNumero(ctx, '14/2026');
      const ra = await ctx.repo.guardarExpediente(a.id, a.expediente, a.version,
        contextoPadron('abastecimiento'));
      assert.equal(ra.ok, true, 'el primero carga el número: ' + JSON.stringify(ra));

      const b = await enSolicitudConNumero(ctx, '14/2026');
      const rb = await ctx.repo.guardarExpediente(b.id, b.expediente, b.version,
        contextoPadron('abastecimiento'));
      assert.equal(rb.ok, true, 'el segundo se suma: ' + JSON.stringify(rb));

      const registro = await ctx.repo.leerSCo('14/2026');
      assert.ok(registro, 'el registro existe');
      assert.equal(registro.numeroSCo, '14/2026', 'con el número tal cual');
      assert.deepEqual(registro.expedientes.slice().sort(), [a.id, b.id].sort(),
        'y con los dos expedientes');
      assert.equal(typeof registro.version, 'number', 'y con versión');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('cambiar el número saca al expediente de la SCo anterior'), async () => {
    const ctx = await crearContexto();
    try {
      const a = await enSolicitudConNumero(ctx, '14/2026');
      await ctx.repo.guardarExpediente(a.id, a.expediente, a.version, contextoPadron('abastecimiento'));
      const b = await enSolicitudConNumero(ctx, '14/2026');
      const guardadoB = await ctx.repo.guardarExpediente(b.id, b.expediente, b.version,
        contextoPadron('abastecimiento'));
      assert.equal(guardadoB.ok, true, 'B se suma primero');

      // Se relee porque el guardado de arriba ya subió la versión de B.
      const Actual = await ctx.repo.leerExpediente(b.id);
      Actual.expediente.campos.numeroSCo = '15/2026';
      const r = await ctx.repo.guardarExpediente(b.id, Actual.expediente, Actual.version,
        contextoPadron('abastecimiento'));
      assert.equal(r.ok, true, 'cambiar de número se guarda: ' + JSON.stringify(r));

      const de14 = await ctx.repo.leerSCo('14/2026');
      const de15 = await ctx.repo.leerSCo('15/2026');
      assert.deepEqual(de14.expedientes, [a.id], 'el 14/2026 se quedó con A');
      assert.deepEqual(de15.expedientes, [b.id], 'el 15/2026 tiene a B');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('sumarse a una SCo que ya avanzó se rechaza sin escribir nada'), async () => {
    const ctx = await crearContexto();
    try {
      const a = await enSolicitudConNumero(ctx, '14/2026');
      await ctx.repo.guardarExpediente(a.id, a.expediente, a.version, contextoPadron('abastecimiento'));
      // A sale de SOLICITUD_CONTRATACION: la SCo ya se movió.
      const leidoA = await ctx.repo.leerExpediente(a.id);
      const rA = await ctx.repo.avanzar(a.id, leidoA.version, 'ANALISIS_SCo',
        contextoPadron('abastecimiento'));
      assert.equal(rA.ok, true, 'A avanza a ANALISIS_SCo: ' + JSON.stringify(rA));

      const b = await enSolicitudConNumero(ctx, '14/2026');
      const rb = await ctx.repo.guardarExpediente(b.id, b.expediente, b.version,
        contextoPadron('abastecimiento'));
      assert.equal(rb.ok, false, 'B no se puede sumar');
      assert.equal(rb.conflicto, false, 'y no es un conflicto de versión');
      assert.match(rb.error, /no se puede sumar a la SCo 14\/2026/,
        'el motivo va en castellano');
      assert.ok(rb.error.indexOf(a.id) !== -1, 'y nombra a quien ya avanzó');

      const registro = await ctx.repo.leerSCo('14/2026');
      assert.deepEqual(registro.expedientes, [a.id], 'el registro no se agrandó');
      const bDespues = await ctx.repo.leerExpediente(b.id);
      assert.notEqual((bDespues.expediente.campos || {}).numeroSCo, '14/2026',
        'y el número de B no se guardó');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('guardar el mismo número dos veces no duplica al expediente'), async () => {
    const ctx = await crearContexto();
    try {
      const a = await enSolicitudConNumero(ctx, '14/2026');
      await ctx.repo.guardarExpediente(a.id, a.expediente, a.version, contextoPadron('abastecimiento'));
      const leido = await ctx.repo.leerExpediente(a.id);
      const otra = await ctx.repo.guardarExpediente(a.id, leido.expediente, leido.version,
        contextoPadron('abastecimiento'));
      assert.equal(otra.ok, true, 'guardar el mismo número no es un error');
      const registro = await ctx.repo.leerSCo('14/2026');
      assert.deepEqual(registro.expedientes, [a.id], 'y el expediente está una sola vez');
    } finally {
      await ctx.limpiar();
    }
  });
}

module.exports = { correrTransiciones };
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

function correrTransiciones(etiqueta, crearContexto) {
  const titulo = (nombre) => etiqueta + ': ' + nombre;
  const config = globalThis.SGC.core.config;

  const defInicial = config.ESTADOS.find((e) => e.id === 'ESPECIFICACIONES_TECNICAS');
  const destinoInicial = defInicial.estadosSiguientes[0];
  const defDestino = config.ESTADOS.find((e) => e.id === destinoInicial);

  test(titulo('avanzar con el rol correcto devuelve ok y persiste el resultado del motor'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      const r = await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      assert.equal(r.ok, true);
      assert.equal(r.version, 2);
      assert.equal(r.expediente.estado.id, destinoInicial);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 2);
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
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      assert.equal(r.ok, false);
      assert.equal(r.conflicto, true);
      assert.equal(r.versionRemota, 2);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 2);
      assert.equal(leido.expediente.estado.id, destinoInicial);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('devolver sin motivo válido devuelve rechazo por catálogo'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 2, 'ESPECIFICACIONES_TECNICAS',
        'NO_EXISTE', null, contextoPadron(defDestino.rolEjecutor));
      assert.equal(r.ok, false);
      assert.match(r.error, /no pertenece al catálogo/);
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.expediente.estado.id, destinoInicial);
      assert.equal(leido.version, 2);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('devolver con motivo válido y rol correcto ejecuta'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 2, 'ESPECIFICACIONES_TECNICAS',
        'ERRORES_FORMALES', 'Observación', contextoPadron(defDestino.rolEjecutor));
      assert.equal(r.ok, true);
      assert.equal(r.version, 3);
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
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase({ rol: 'generador' }));
      await ctx.repo.avanzar(creado.id, 1, destinoInicial, contextoPadron('generador'));
      const r = await ctx.repo.devolver(creado.id, 2, 'ESPECIFICACIONES_TECNICAS',
        'ERRORES_FORMALES', null, contextoPadron('juridica'));
      assert.equal(r.ok, false);
      assert.equal(r.conflicto, false);
      assert.match(r.error, new RegExp('no puede operar sobre "' + destinoInicial + '"'));
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.expediente.estado.id, destinoInicial);
      assert.equal(leido.version, 2);
    } finally {
      await ctx.limpiar();
    }
  });
}

module.exports = { correrTransiciones };
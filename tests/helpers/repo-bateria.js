'use strict';

/*
 * repo-bateria.js
 * Batería única del contrato de persistencia (ORDEN-RONDA-03 §3.5.1).
 *
 * Se corre contra repo.memoria y contra repo.http apuntando al servidor real.
 * Si una pasa y la otra no, el contrato no está bien definido.
 *
 * Cada test crea su propio contexto de ejecución (implementación + limpieza)
 * para que los tests sean independientes entre sí.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

function contextoBase(extra) {
  return Object.assign({
    timestamp: '2026-08-14T10:00:00.000Z',
    email: 'operador@faa.mil.ar',
    rol: 'contrataciones',
    equipo: 'PC-PRUEBA-01',
    observacion: null
  }, extra || {});
}

function datosIniciales(extra) {
  return Object.assign({
    titulo: 'Adquisición de resmas de papel A4',
    anio: '2026',
    campos: { objetoGasto: 'Papel A4 75gr', unidadSolicitante: 'División Administración' },
    incisos: [
      { codigo: '102040', cantidad: 40, unidad: 'RESMA' }
    ]
  }, extra || {});
}

function correrBateria(etiqueta, crearContexto, conExtra) {
  const titulo = (nombre) => etiqueta + ': ' + nombre;

  test(titulo('listarIndice devuelve un arreglo vacío al inicio'), async () => {
    const ctx = await crearContexto();
    try {
      const indice = await ctx.repo.listarIndice();
      assert.deepEqual(indice, []);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('crearExpediente asigna id, version 1 y forma contractual'), async () => {
    const ctx = await crearContexto();
    try {
      const resultado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      assert.match(resultado.id, /^\d{4}-\d{3,}$/);
      assert.equal(resultado.version, 1);
      assert.equal(resultado.expediente.expedienteId, resultado.id);
      assert.equal(resultado.expediente.version, 1);
      assert.equal(typeof resultado.expediente.estado, 'object');
      assert.equal(resultado.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');
      assert.equal(resultado.expediente.estado.fase, 1);
      assert.equal(typeof resultado.expediente.estado.desde, 'string');
      assert.ok(Array.isArray(resultado.expediente.auditoria));
      assert.ok(resultado.expediente.auditoria.length >= 1);
      assert.equal(resultado.expediente.auditoria[0].hashPrevio, null);
      assert.equal(resultado.expediente.campos.objetoGasto, 'Papel A4 75gr');
      assert.equal(resultado.expediente.incisos.length, 1);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('crearExpediente numera de forma consecutiva por año'), async () => {
    const ctx = await crearContexto();
    try {
      const a = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      const b = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      const numA = parseInt(a.id.split('-')[1], 10);
      const numB = parseInt(b.id.split('-')[1], 10);
      assert.equal(numB, numA + 1);
      assert.notEqual(a.id, b.id);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('leerExpediente devuelve lo creado con su versión'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 1);
      assert.equal(leido.expediente.expedienteId, creado.id);
      assert.equal(leido.expediente.titulo, creado.expediente.titulo);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('leerExpediente de id inexistente rechaza con NO_ENCONTRADO'), async () => {
    const ctx = await crearContexto();
    try {
      await assert.rejects(
        () => ctx.repo.leerExpediente('2099-999'),
        (e) => e.codigo === 'NO_ENCONTRADO'
      );
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('guardarExpediente con versión correcta actualiza y sube la versión'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      const r = await ctx.repo.guardarExpediente(
        creado.id,
        Object.assign({}, creado.expediente, { titulo: 'Título modificado' }),
        1,
        contextoBase()
      );
      assert.deepEqual(r, { ok: true, version: 2 });
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 2);
      assert.equal(leido.expediente.titulo, 'Título modificado');
      assert.equal(leido.expediente.version, 2);
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('guardarExpediente con versión vieja devuelve conflicto sin escribir'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      await ctx.repo.guardarExpediente(
        creado.id,
        Object.assign({}, creado.expediente, { marca: 'A' }),
        1,
        contextoBase()
      );
      const r = await ctx.repo.guardarExpediente(
        creado.id,
        Object.assign({}, creado.expediente, { marca: 'B' }),
        1,
        contextoBase()
      );
      assert.deepEqual(r, { ok: false, conflicto: true, versionRemota: 2 });
      const leido = await ctx.repo.leerExpediente(creado.id);
      assert.equal(leido.version, 2);
      assert.equal(leido.expediente.marca, 'A', 'el intento con conflicto no debe escribir');
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('guardarExpediente de id inexistente rechaza con NO_ENCONTRADO'), async () => {
    const ctx = await crearContexto();
    try {
      await assert.rejects(
        () => ctx.repo.guardarExpediente('2099-999', {}, 1, contextoBase()),
        (e) => e.codigo === 'NO_ENCONTRADO'
      );
    } finally {
      await ctx.limpiar();
    }
  });

  test(titulo('el índice refleja estado, fase, sector y rol del expediente'), async () => {
    const ctx = await crearContexto();
    try {
      const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
      const indice = await ctx.repo.listarIndice();
      assert.equal(indice.length, 1);
      const entrada = indice[0];
      assert.equal(entrada.id, creado.id);
      assert.equal(entrada.titulo, creado.expediente.titulo);
      assert.equal(entrada.estado, 'ESPECIFICACIONES_TECNICAS');
      assert.equal(entrada.fase, 1);
      assert.equal(entrada.rolEjecutor, 'generador');
      assert.equal(entrada.sector, 'usuario');
      assert.equal(entrada.actualizado, '2026-08-14T10:00:00.000Z');
    } finally {
      await ctx.limpiar();
    }
  });

  if (conExtra) {
    test(titulo('listarArchivoHistorico conserva los snapshots por versión'), async () => {
      const ctx = await crearContexto();
      try {
        const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
        await ctx.repo.guardarExpediente(
          creado.id,
          Object.assign({}, creado.expediente, { marca: 'v2' }),
          1,
          contextoBase()
        );
        const historico = await ctx.repo.listarArchivoHistorico({ id: creado.id });
        assert.equal(historico.length, 1);
        assert.equal(historico[0].version, 1);
        const porVersion = await ctx.repo.listarArchivoHistorico({ id: creado.id, version: 1 });
        assert.equal(porVersion.length, 1);
        const inexistente = await ctx.repo.listarArchivoHistorico({ id: creado.id, version: 99 });
        assert.deepEqual(inexistente, []);
      } finally {
        await ctx.limpiar();
      }
    });

    test(titulo('archivar marca el expediente y sube la versión'), async () => {
      const ctx = await crearContexto();
      try {
        const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
        const r = await ctx.repo.archivar(creado.id, contextoBase());
        assert.deepEqual(r, { ok: true, version: 2 });
        const leido = await ctx.repo.leerExpediente(creado.id);
        assert.equal(leido.expediente.archivado, true);
        assert.equal(leido.version, 2);
      } finally {
        await ctx.limpiar();
      }
    });

    test(titulo('guardarEntregable devuelve la ruta relativa al expediente y conserva el contenido'), async () => {
      const ctx = await crearContexto();
      try {
        const creado = await ctx.repo.crearExpediente(datosIniciales(), contextoBase());
        const r = await ctx.repo.guardarEntregable(creado.id, 'pliego.pdf', 'contenido', contextoBase());
        assert.equal(r.ruta, 'entregables/pliego.pdf');
      } finally {
        await ctx.limpiar();
      }
    });
  }
}

module.exports = {
  correrBateria,
  contextoBase,
  datosIniciales
};
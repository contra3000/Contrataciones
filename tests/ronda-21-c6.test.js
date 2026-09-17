'use strict';

/*
 * ronda-21-c6.test.js
 * ORDEN-RONDA-21 §2 · C6: la cadena de roles hasta la firma.
 *
 * Con la montura real y sólo por el DOM: se importa el padrón (14 claves en
 * pantalla), el generador crea el expediente con el fast-track REAL (sube un
 * JSON modelo por el input #sgc-archivo-modelo, no por API), y después cada
 * rol del circuito entra, abre el expediente desde el tablero, guarda el
 * entregable obligatorio de su estado y avanza por botón, hasta PERFECCIONADA
 * (que archiva el expediente en el servidor).
 *
 * La matriz de 18 × 7 funciona en la pantalla y no sólo en el núcleo: cada
 * avance es un botón de la vista, jamás una llamada a función de vista ni a
 * la API.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');
const { importarPadron, cambiarSesion, irAlExpediente, guardarDocumento, avanzarEstado } = require('./helpers/circuito-ronda-21.js');

const MODELO_FASTTRACK = JSON.stringify({
  titulo: 'Adquisición de termostatos para calefactores',
  anio: '2026',
  dependenciaSolicitante: 'División Mantenimiento',
  justificacion: 'Se reponen termostatos de calefactores en uso corriente.',
  objetivo: '',
  renglones: [
    { codigo: '2.9.6-1115.1', cantidad: 2, unidad: 'UN', aclaracion: '' }
  ]
}, null, 2);

// Título del estado que aparece en el resumen del expediente al llegar a él.
const TITULO = {
  SOLICITUD: 'Solicitud de Contratación (SCo)',
  ANALISIS: 'Análisis de SCo',
  AUTORIZACION: 'Autorización de SCo',
  REVISION: 'Revisión de SCo',
  CONFECCION: 'Confección de Proyectos',
  DICTAMEN_INICIAL: 'Dictamen Inicial',
  DILIGENCIA: 'Diligencia',
  FIRMAS: 'Firmas de Pliego y Disposición',
  PUBLICACION: 'Publicación',
  APERTURA: 'Apertura / Pedido de informes',
  EVALUACION: 'Evaluación',
  DICTAMEN_FINAL: 'Dictamen Final',
  FIRMA: 'Firma de Disposición',
  ADJUDICACION: 'Adjudicación',
  AFECTACION: 'Afectación',
  GENERACION: 'Generación de Orden de Compra',
  PERFECCIONADA: 'Perfeccionada'
};

test('C6: la cadena de roles hasta la firma por la montura real', async function () {
  const m = await am.arrancar({ prefix: 'rp21c6-' });
  try {
    const d = m.documento;

    // C7 (prerequisito, por pantalla): importar el padrón y leer las claves.
    await m.prepararAdmin();
    const padron = await importarPadron(m);
    const fijas = {};

    // La primera entrada de cada email cambia la provisoria por la fija; las
    // siguientes entran directo con la fija (la provisoria ya no existe).
    async function entrar(email) {
      if (fijas[email]) {
        return await cambiarSesion(m, email, fijas[email], fijas[email]);
      }
      const fija = await cambiarSesion(m, email, padron.clavesDe[email]);
      fijas[email] = fija;
      return fija;
    }

    // -----------------------------------------------------------------------
    // Generador: crea el expediente con el fast-track REAL (archivo subido).
    // -----------------------------------------------------------------------
    await entrar('generador.c21@test.local');
    assert.match(d.getElementById('sgc-operador-actual').textContent, /generador\.c21@test\.local/);
    const archivoModelo = d.getElementById('sgc-archivo-modelo');
    archivoModelo.files = [
      { name: 'modelo.json', type: 'application/json', size: MODELO_FASTTRACK.length, contenido: MODELO_FASTTRACK }
    ];
    archivoModelo.emit('change');
    await m.esperar(() => (d.getElementById('sgc-fasttrack-msj').textContent || '')
      .indexOf('Modelo importado correctamente') !== -1, 30000, 'modelo importado por el archivo');
    await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
      'paso de renglones visible con el modelo importado');
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
      20000, 'el renglón del modelo queda sin errores');

    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
      'paso de fundamentación visible');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
      'paso de revisión visible');
    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 30000,
      'expediente creado por el generador');
    const expId = d.getElementById('sgc-exito-id').textContent.replace(/^Expediente\s*/, '').trim();
    assert.ok(expId, 'muestra el id del expediente');

    // El generador guarda la especificación técnica (obligatoria) y avanza.
    await irAlExpediente(m, expId);
    await guardarDocumento(m);
    await avanzarEstado(m, TITULO.SOLICITUD);

    // Abastecimiento: SOLICITUD_CONTRATACION → ANALISIS_SCo → AUTORIZACION_SCo.
    await entrar('abastecimiento.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /abastecimiento\.c21@test\.local/);
    await guardarDocumento(m);
    await avanzarEstado(m, TITULO.ANALISIS);
    await avanzarEstado(m, TITULO.AUTORIZACION);

    // Abastecimiento supervisor: AUTORIZACION_SCo → REVISION_SCo.
    await entrar('supervisor-abastecimiento.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /supervisor-abastecimiento\.c21@test\.local/);
    await avanzarEstado(m, TITULO.REVISION);

    // Contrataciones: REVISION_SCo → CONFECCION_PROYECTOS → DICTAMEN_INICIAL.
    await entrar('contrataciones.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /contrataciones\.c21@test\.local/);
    await avanzarEstado(m, TITULO.CONFECCION);
    await avanzarEstado(m, TITULO.DICTAMEN_INICIAL);

    // Jurídica: DICTAMEN_INICIAL → DILIGENCIA.
    await entrar('juridica.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /juridica\.c21@test\.local/);
    await avanzarEstado(m, TITULO.DILIGENCIA);

    // Contrataciones (2º): DILIGENCIA → FIRMAS_PLIEGO_DISPOSICION.
    await entrar('contrataciones2.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /contrataciones2\.c21@test\.local/);
    await avanzarEstado(m, TITULO.FIRMAS);

    // Supervisor de contrataciones: FIRMAS_PLIEGO_DISPOSICION → PUBLICACION.
    await entrar('supervisor-contrataciones.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /supervisor-contrataciones\.c21@test\.local/);
    await avanzarEstado(m, TITULO.PUBLICACION);

    // Contrataciones (3º): PUBLICACION → APERTURA → EVALUACION → DICTAMEN_FINAL.
    await entrar('contrataciones3.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /contrataciones3\.c21@test\.local/);
    await avanzarEstado(m, TITULO.APERTURA);
    await avanzarEstado(m, TITULO.EVALUACION);
    await avanzarEstado(m, TITULO.DICTAMEN_FINAL);

    // Jurídica (2º): DICTAMEN_FINAL → FIRMA_DISPOSICION.
    await entrar('juridica.c21@test.local');
    await irAlExpediente(m, expId);
    await avanzarEstado(m, TITULO.FIRMA);

    // Supervisor de contrataciones (2º): guarda la disposición y avanza.
    await entrar('supervisor-contrataciones2.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /supervisor-contrataciones2\.c21@test\.local/);
    await guardarDocumento(m);
    await avanzarEstado(m, TITULO.ADJUDICACION);

    // Contrataciones: ADJUDICACION → AFECTACION.
    await entrar('contrataciones.c21@test.local');
    await irAlExpediente(m, expId);
    await avanzarEstado(m, TITULO.AFECTACION);

    // Contaduría: AFECTACION → GENERACION_ORDEN_COMPRA.
    await entrar('contaduria.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /contaduria\.c21@test\.local/);
    await avanzarEstado(m, TITULO.GENERACION);

    // Contrataciones: guarda la orden de compra y avanza a PERFECCIONADA.
    await entrar('contrataciones2.c21@test.local');
    await irAlExpediente(m, expId);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /contrataciones2\.c21@test\.local/);
    await guardarDocumento(m);
    await avanzarEstado(m, TITULO.PERFECCIONADA);

    // PERFECCIONADA es terminal: el botón de avanzar queda deshabilitado.
    assert.strictEqual(d.getElementById('sgc-expediente-avanzar').disabled, true,
      'C6: al llegar a PERFECCIONADA el avance se deshabilita');
    assert.match((d.getElementById('sgc-expediente-avanzar-porque').textContent || ''),
      /archivado/, 'C6: el avance explica que el expediente está archivado');
  } finally {
    await m.cerrar();
  }
});
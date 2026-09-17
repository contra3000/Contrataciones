'use strict';

/*
 * ronda-20.test.js
 * ORDEN-RONDA-20 §1 y §3. Un solo recorrido de banco de pruebas real
 * (tests/helpers/aplicacion-montura.js), sin llamar a ninguna función de
 * vista a mano:
 *
 *  §1.1 · H1: los presupuestos se suben POR LA PANTALLA y llegan al servidor.
 *         (El defecto era el nombre del campo: la vista mandaba
 *         "contenidoBase64" y el servidor exige "contenido".)
 *  §1.2 · H2: el ANEXO 1 oculta SU SECCIÓN y nunca la raíz de la aplicación.
 *  §1.3 · C5: los datos del ANEXO 1 se guardan y al reabrir están presentes
 *         (los doce identificadores alineados).
 *  §1.4 · H4: al salir, la pantalla de ingreso queda limpia y la lista del
 *         modo declarado no aparece en modo autenticado.
 *  §3.1 · C2 completo: generar carga un requerimiento de verdad con 3
 *         renglones del catálogo real + 2 presupuestos por la pantalla.
 *  §3.3 · C4: entrar con abastecimiento, abrir el expediente y hacerlo
 *         avanzar al siguiente paso por botón (nunca por API).
 *  §3.2 · C3 (parcial acá): guardar el documento del estado y exportar con el
 *         modal de advertencia de por medio. El pliego contra el generador
 *         real queda declarado en INFORME-RONDA-20.md §4 / §3.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

test('§1 + §3: C2 completo → C4 → C5 (+C3 parcial) por la montura real', async function () {
  const m = await am.arrancar({ prefix: 'rp20-' });
  const capturas = [];
  globalThis.URL.createObjectURL = function (blob) {
    capturas.push(blob);
    return 'blob:capturado';
  };
  try {
    const d = m.documento;

  async function esperarDocumentoRemontado() {
    // ORDEN-RONDA-21 §1.1: tras guardar el documento, la vista de expediente se
    // recarga sola (expediente.abrir) y re-monta el documento; el avance que
    // sigue no debe dar 409 de versión. Sin el fix, el sector queda intacto y
    // la espera expira (rojo), el mismo síntoma que reportó la RONDA-20.
    const sector = d.getElementById('sgc-expediente-documento');
    const previo = sector.children[0];
    await m.esperar(() => sector.children[0] !== previo && sector.children.length > 0,
      30000, 'el documento se re-montó por la recarga automática tras guardar');
  }

  function esperarPresupuestoEnLista(nombre) {
    return m.esperar(() => (d.getElementById('sgc-req-presupuestos-lista').textContent || '')
      .indexOf(nombre) !== -1 && (d.getElementById('sgc-req-presupuestos-lista').textContent || '')
      .indexOf('id asignado:') !== -1, 30000,
      'el presupuesto "' + nombre + '" quedó guardado por el servidor');
  }

    // -----------------------------------------------------------------------
    // C2 · el generador carga un requerimiento de verdad (3 renglones reales)
    // -----------------------------------------------------------------------
    await m.prepararOperador('generador.ronda20@test.local', 'Generadora', 'Ronda 20', 'generador');
    assert.match(d.getElementById('sgc-operador-actual').textContent, /generador\.ronda20@test\.local/);

    m.escribir('sgc-titulo', 'Adquisición de insumos y servicios de oficina');
    m.escribir('sgc-anio', '2026');
    m.escribir('sgc-dependencia', 'Dirección General de Administración');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
      'paso de renglones visible');

    await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
      30000, 'índice del catálogo cargado');
    const clases = globalThis.SGC.catalogo.carga.obtenerEstado().clases;
    const clasesConItems = clases.filter((c) => c[3] > 0);
    assert.ok(clasesConItems.length >= 3, 'el catálogo real tiene al menos tres clases con ítems');

    for (let i = 0; i < 3; i++) {
      m.escribir('sgc-campo-clases', clasesConItems[i][2]);
      await m.esperar(() => d.getElementById('sgc-opcion-clase-0'), 20000,
        'opción de la clase ' + (i + 1) + ' renderizada');
      m.mousedown('sgc-opcion-clase-0');
      await m.esperar(() => d.getElementById('sgc-opcion-item-0'), 30000,
        'ítems de la clase ' + (i + 1) + ' cargados');
      m.mousedown('sgc-opcion-item-0');
      await m.esperar(() => d.getElementById('sgc-lista-renglones').children.length === i + 1,
        20000, 'renglón ' + (i + 1) + ' agregado');
    }
    for (const fila of d.getElementById('sgc-lista-renglones').children) {
      const unidad = fila.querySelector('[aria-label="Unidad de medida"]');
      assert.ok(unidad, 'cada fila expone el campo de unidad');
      m.escribirEnNodo(unidad, 'unidad');
    }
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
      20000, 'los 3 renglones quedan sin errores');

    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
      'paso de fundamentación visible');
    m.escribir('sgc-justificacion', 'Se reponen insumos y se contratan servicios básicos para el funcionamiento del área.');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
      'paso de revisión visible');
    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 30000,
      'expediente creado y confirmado');
    const expId = d.getElementById('sgc-exito-id').textContent.replace(/^Expediente\s*/, '').trim();
    assert.ok(expId, 'muestra el id del expediente');

    // Tablero: se abre el expediente desde una tarjeta del índice real.
    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta del expediente en el tablero');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden, 20000,
      'vista de expediente visible');
    await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
      .indexOf('Estado:') !== -1, 30000, 'el expediente quedó renderizado');

    // H2: el ANEXO 1 oculta su sección, jamás la raíz de la aplicación.
    assert.strictEqual(d.getElementById('app').hidden, false,
      'H2: la raíz de la aplicación nunca se oculta');
    assert.strictEqual(d.getElementById('sgc-anexo1-seccion').hidden, true,
      'H2: la sección del ANEXO 1 queda oculta en ESPECIFICACIONES_TECNICAS');

    // C2 · H1 · presupuestos subidos por la pantalla (2, reales al servidor).
    const entradapresupuesto = d.getElementById('sgc-req-presupuesto-archivo');
    entradapresupuesto.files = [
      { name: 'presupuesto-uno.pdf', type: 'application/pdf', size: 1024 },
      { name: 'presupuesto-dos.png', type: 'image/png', size: 2048 }
    ];
    entradapresupuesto.emit('change');
    await esperarPresupuestoEnLista('presupuesto-uno.pdf');
    await esperarPresupuestoEnLista('presupuesto-dos.png');
    assert.match(d.getElementById('sgc-req-presupuestos-lista').textContent, /id asignado:/,
      'H1: ambos presupuestos tienen id asignado por el servidor (el campo "contenido" recorrió toda la subida)');
    assert.match(d.getElementById('sgc-requerimiento-msj').textContent, /Presupuesto guardado:/,
      'H1: la pantalla avisa que el presupuesto quedó guardado');

    // C3 (parcial) · el documento del estado (especificación técnica) se
    // guarda como entregable por botón; sin eso no se puede avanzar.
    d.getElementById('sgc-expediente-documento-guardar').click();
    await m.esperar(() => (d.getElementById('sgc-expediente-documento-msj').textContent || '')
      .indexOf('Documento guardado') !== -1, 30000, 'documento del estado guardado');
    assert.strictEqual(d.getElementById('sgc-expediente-documento-enlace').href,
      'api/expedientes/' + expId + '/entregables/especificacion-tecnica.html',
      'enlace al entregable guardado');

    // C4 · el generador avanza ESPECIFICACIONES_TECNICAS → SOLICITUD_CONTRATACION.
    await esperarDocumentoRemontado();
    d.getElementById('sgc-expediente-avanzar').click();
    await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
      .indexOf('Solicitud de Contratación') !== -1, 30000, 'el expediente avanzó a Solicitud de Contratación');

    // H4 · salir: la pantalla de ingreso queda limpia y sin la lista declarada.
    d.getElementById('sgc-sesion-salir').click();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'pantalla de ingreso tras salir');
    assert.strictEqual(d.getElementById('sgc-lista-operadores').hidden, true,
      'H4: la lista del modo declarado no aparece en modo autenticado');
    assert.strictEqual(d.getElementById('sgc-ingreso').hidden, false,
      'H4: el formulario de ingreso es la única puerta visible');

    // -----------------------------------------------------------------------
    // C4 · abastecimiento abre el expediente y lo hace avanzar por botón
    // -----------------------------------------------------------------------
    await m.prepararOperador('abastecimiento.ronda20@test.local', 'Abastecimiento', 'Ronda 20', 'abastecimiento');
    assert.match(d.getElementById('sgc-operador-actual').textContent, /abastecimiento\.ronda20@test\.local/);
    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta del expediente en el tablero (fase de abastecimiento)');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden &&
      (d.getElementById('sgc-expediente-resumen').textContent || '').indexOf('Solicitud de Contratación') !== -1,
      30000, 'expediente abierto por abastecimiento (estado Solicitud de Contratación)');

    // El documento del estado (solicitud de contratación) se guarda antes de
    // avanzar: es el entregable obligatorio del paso.
    d.getElementById('sgc-expediente-documento-guardar').click();
    await m.esperar(() => (d.getElementById('sgc-expediente-documento-msj').textContent || '')
      .indexOf('Documento guardado') !== -1, 30000, 'solicitud de contratación guardada');
    await esperarDocumentoRemontado();
    d.getElementById('sgc-expediente-avanzar').click();
    await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
      .indexOf('Análisis de SCo') !== -1, 30000, 'C4: el expediente avanzó a Análisis de SCo');

    // H2 (complemento): en ANALISIS_SCo el ANEXO 1 muestra SU sección.
    await m.esperar(() => d.getElementById('sgc-anexo1-seccion').hidden === false, 20000,
      'la sección del ANEXO 1 se muestra en ANALISIS_SCo');
    assert.strictEqual(d.getElementById('app').hidden, false,
      'H2: la raíz sigue visible con el ANEXO 1 activo');

    // -----------------------------------------------------------------------
    // C5 · ANEXO 1: llenar por pantalla, guardar, recargar, reabrir, leer
    // -----------------------------------------------------------------------
    m.setear('sgc-anexo1-objeto', 'Adquisición de insumos y servicios de oficina');
    m.setear('sgc-anexo1-justificacion', 'Cobertura de necesidades operativas del área.');
    m.setear('sgc-anexo1-unidad-resp', 'División Compras');
    m.setear('sgc-anexo1-usuario-gde', 'GDE-2026-001');
    m.setear('sgc-anexo1-unidad-dir', 'Av. Costanera 1234');
    m.setear('sgc-anexo1-unidad-tel', '011-4567-8900');
    m.setear('sgc-anexo1-unidad-correo', 'compras@organismo.gob.ar');
    m.setear('sgc-anexo1-lugar-entrega', 'Depósito Central, Galpón 2');
    m.setear('sgc-anexo1-lugar-fact', 'Dirección General de Administración');
    m.setear('sgc-anexo1-requisitos', 'Los renglones deben entregarse con su certificado de conformidad.');
    m.setear('sgc-anexo1-empresas', 'EMPRESA A SA\nEMPRESA B SA');
    m.setear('sgc-anexo1-precio-ref', '$ 12.000,50');
    m.setear('sgc-anexo1-moneda-ext', 'USD');
    d.getElementById('sgc-anexo1-pac-previsto').checked = true;
    m.setear('sgc-anexo1-pac-orden', 'P-2026-0007');
    m.setear('sgc-anexo1-pac-trimestre', '2°');
    m.setear('sgc-anexo1-comision', 'Comisión evaluadora de tres miembros.');
    m.setear('sgc-anexo1-personal', 'Un técnico del área.');
    m.setear('sgc-anexo1-visita', 'Se realizará visita a la planta.');
    m.setear('sgc-anexo1-interadmin', 'Sí');
    m.setear('sgc-anexo1-bienes-uso', 'Los bienes quedan a resguardo del área usuaria.');
    m.setear('sgc-anexo1-hw-sw', 'No aplica.');
    m.setear('sgc-anexo1-reparaciones', 'No aplica.');
    m.setear('sgc-anexo1-doc-obligatoria', 'Factura A, planilla de entrega.');
    m.setear('sgc-anexo1-criterio', 'Menor precio con cumplimiento de especificaciones.');
    d.getElementById('sgc-anexo1-guardar').click();
    await m.esperar(() => (d.getElementById('sgc-anexo1-msj').textContent || '')
      .indexOf('ANEXO 1 guardado (versión ') !== -1, 30000, 'ANEXO 1 guardado');

    // Reabrir (recarga de la pestaña) y comprobar que los datos están.
    m.recargar();
    await m.esperar(() => !d.getElementById('sgc-tablero-nav').hidden, 20000,
      'navegación visible tras la recarga');
    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta visible tras la recarga');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-anexo1-seccion').hidden, 20000,
      'ANEXO 1 visible al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-objeto').value, 'Adquisición de insumos y servicios de oficina',
      'C5: el objeto guardado está al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-unidad-resp').value, 'División Compras',
      'C5: la unidad responsable guardada está al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-pac-orden').value, 'P-2026-0007',
      'C5: el número de orden PAC guardado está al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-pac-trimestre').value, '2°',
      'C5: el trimestre PAC guardado está al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-pac-previsto').checked, true,
      'C5: el PAC previsto continúa marcado');
    assert.strictEqual(d.getElementById('sgc-anexo1-precio-ref').value, '$ 12.000,50',
      'C5: el precio de referencia guardado está al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-empresas').value, 'EMPRESA A SA\nEMPRESA B SA',
      'C5: las empresas consultadas guardadas están al reabrir');
    assert.strictEqual(d.getElementById('sgc-anexo1-criterio').value,
      'Menor precio con cumplimiento de especificaciones.',
      'C5: el criterio de evaluación guardado está al reabrir');

    // -----------------------------------------------------------------------
    // C3 (parcial) · documento del estado + exportar con modal de advertencia
    // -----------------------------------------------------------------------
    d.getElementById('sgc-expediente-documento-guardar').click();
    await m.esperar(() => (d.getElementById('sgc-expediente-documento-msj').textContent || '')
      .indexOf('Documento guardado') !== -1, 30000, 'ANEXO 1 guardado como documento del estado');
    assert.ok(d.getElementById('sgc-expediente-documento-enlace').href.indexOf('anexo-1.html') !== -1,
      'C3: el enlace apunta al entregable anexo-1.html');

    d.getElementById('sgc-expediente-exportar-json').click();
    assert.strictEqual(d.getElementById('sgc-modal-advertencia').hidden, false,
      'C3: el modal de advertencia aparece antes de exportar');
    d.getElementById('sgc-modal-advertencia-confirmar').click();
    await m.esperar(() => capturas.length > 0, 20000, 'la descarga se generó');
    const blobExportado = capturas[0];
    const contenidoExportado = blobExportado.partes
      ? blobExportado.partes.join('') : await blobExportado.text();
    const jsonExportado = JSON.parse(contenidoExportado);
    assert.strictEqual(jsonExportado.expedienteId || jsonExportado.id, expId,
      'C3: el JSON exportado es del expediente del recorrido');
    assert.strictEqual(jsonExportado.estado && jsonExportado.estado.id, 'ANALISIS_SCo',
      'C3: el JSON exportado refleja el estado actual');
  } finally {
    await m.cerrar();
  }
});
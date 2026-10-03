'use strict';

/*
 * circuito-ronda-21.js
 * ORDEN-RONDA-21 §2. Helpers de los caminos C6, C7 y C9.
 */

const botonAbrirDelTablero = function (d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
};

const PADRON_INICIAL_CSV = 'nombre;apellido;email;rol;sector;activo\n'
  + 'Elena;Ríos;generador.c21@test.local;generador;;si\n'
  + 'María;Solá;generadora2.c21@test.local;generador;;si\n'
  + 'Diego;Ferreyra;generadora3.c21@test.local;generador;;si\n'
  + 'Ana;Castro;abastecimiento.c21@test.local;abastecimiento;;si\n'
  + 'Luis;Méndez;abastecimiento2.c21@test.local;abastecimiento;;si\n'
  + 'Carlos;Pérez;supervisor-abastecimiento.c21@test.local;abastecimiento_supervisor;;si\n'
  + 'Rosa;Gómez;supervisora-abastecimiento.c21@test.local;abastecimiento_supervisor;;si\n'
  + 'Jorge;López;contrataciones.c21@test.local;contrataciones;;si\n'
  + 'Silvia;Ruiz;contrataciones2.c21@test.local;contrataciones;;si\n'
  + 'Pedro;Díaz;contrataciones3.c21@test.local;contrataciones;;si\n'
  + 'Norma;Vera;supervisor-contrataciones.c21@test.local;contrataciones_supervisor;;si\n'
  + 'Osvaldo;Román;supervisor-contrataciones2.c21@test.local;contrataciones_supervisor;;si\n'
  + 'Adriana;Núñez;juridica.c21@test.local;juridica;;si\n'
  + 'Ricardo;Molina;contaduria.c21@test.local;contaduria;;si\n';

async function importarPadron(m) {
  const d = m.documento;
  d.getElementById('sgc-padron-importar').click();
  const area = d.getElementById('sgc-padron-importar-area');
  await m.esperar(() => d.getElementById('sgc-padron-importar-texto'), 20000,
    'área de importación visible');
  d.getElementById('sgc-padron-importar-texto').value = PADRON_INICIAL_CSV;
  m.botonEn(area, 'Procesar').click();
  await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 30000,
    'bloque de claves del padrón importado visible');
  const emails = PADRON_INICIAL_CSV.trim().split('\n').slice(1).map((l) => l.split(';')[2]);
  const claves = emails.map((e) => m.claveEnPantalla(e));
  if (claves.some((c) => !c)) {
    throw new Error('no se leyeron las catorce claves de la pantalla');
  }
  return { emails, claves, clavesDe: Object.fromEntries(emails.map((e, i) => [e, claves[i]])) };
}

function claveFijaDe(email) {
  return 'clave-fija-cuatro-palabras-' + email.split('@')[0].replace(/[^a-z]/g, '');
}

async function cambiarSesion(m, email, clave, claveFija) {
  const d = m.documento;
  // La decisión se toma por la barra de sesión, no por la visibilidad de la
  // pantalla de ingreso: tras un re-ingreso con clave fija la pantalla de
  // ingreso queda visible aunque haya una sesión activa, y ese resto no debe
  // confundir el guard (primera entrada: sin sesión, se entra directo).
  if (d.getElementById('sgc-sesion-barra').hidden) {
    // Primera entrada del test: no hay sesión activa, el ingreso está visible.
  } else {
    d.getElementById('sgc-sesion-salir').click();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'pantalla de ingreso visible tras salir');
  }
  const fija = claveFija || claveFijaDe(email);
  m.setear('sgc-ingreso-email', email);
  m.setear('sgc-ingreso-clave', clave);
  m.enviarFormulario('sgc-ingreso');
  await m.esperar(() => !d.getElementById('sgc-cambio-clave-forma').hidden ||
    !d.getElementById('sgc-sesion-barra').hidden, 20000, 'ingreso de ' + email);
  if (!d.getElementById('sgc-cambio-clave-forma').hidden) {
    m.setear('sgc-cambio-clave-vieja', clave);
    m.setear('sgc-cambio-clave-nueva', fija);
    m.enviarFormulario('sgc-cambio-clave-forma');
  }
  await m.esperar(() => !d.getElementById('sgc-sesion-barra').hidden, 20000,
    'aplicación visible para ' + email);
  return fija;
}

async function irAlExpediente(m, expId) {
  const d = m.documento;
  if (d.getElementById('sgc-expediente').hidden) {
    if (d.getElementById('sgc-kanban').hidden) {
      d.getElementById('sgc-nav-tablero').click();
      await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000,
        'tablero visible');
    }
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta del expediente en el tablero');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden, 20000,
      'vista de expediente visible');
  }
  await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
    .indexOf('Estado:') !== -1, 30000, 'expediente renderizado');
}

async function guardarDocumento(m) {
  const d = m.documento;
  const previo = d.getElementById('sgc-expediente-documento').children[0];
  d.getElementById('sgc-expediente-documento-guardar').click();
  await m.esperar(() => (d.getElementById('sgc-expediente-documento-msj').textContent || '')
    .indexOf('Documento guardado') !== -1, 30000, 'documento del estado guardado');
  await m.esperar(() => {
    const actual = d.getElementById('sgc-expediente-documento').children[0];
    return actual !== previo && d.getElementById('sgc-expediente-documento').children.length > 0;
  }, 30000, 'el documento se re-montó tras guardar');
}

// ORDEN-RONDA-26 pieza 4: la SCo ya no produce documento; el paso exige el
// número de SCo, que se carga por su sección propia y se guarda por botón.
async function cargarNumeroSCo(m) {
  const d = m.documento;
  await m.esperar(() => d.getElementById('sgc-sco-numero-seccion').hidden === false, 30000,
    'sección del número de SCo visible');
  m.escribir('sgc-sco-numero', '2026-0000' + String(Math.floor(Math.random() * 9000) + 1000));
  const hitos = d.getElementById('sgc-expediente-auditoria');
  const previoHito = hitos.children[0];
  d.getElementById('sgc-sco-guardar').click();
  await m.esperar(() => (d.getElementById('sgc-sco-msj').textContent || '')
    .indexOf('Número de SCo guardado') !== -1, 30000, 'número de SCo guardado');
  await m.esperar(() => hitos.children[0] !== previoHito, 30000,
    'el expediente se recargó tras guardar el número de SCo');
}

async function avanzarEstado(m, proximoTitulo) {
  const d = m.documento;
  d.getElementById('sgc-expediente-avanzar').click();
  await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
    .indexOf(proximoTitulo) !== -1, 30000, 'avanzó a "' + proximoTitulo + '"');
}

// ORDEN-RONDA-26 pieza 5: para abandonar ESPECIFICACIONES_TECNICAS hay que
// subir dos presupuestos por la pantalla, llenar los dos valores de referencia
// del renglón y guardar el requerimiento por su botón antes de avanzar.
async function cargarRequerimientoEett(m) {
  const d = m.documento;
  await m.esperar(() => d.getElementById('sgc-requerimiento-seccion').hidden === false, 30000,
    'sección del requerimiento visible');
  const entrada = d.getElementById('sgc-req-presupuesto-archivo');
  entrada.files = [
    { name: 'presupuesto-uno.pdf', type: 'application/pdf', size: 1024 },
    { name: 'presupuesto-dos.png', type: 'image/png', size: 2048 }
  ];
  entrada.emit('change');
  await m.esperar(() => (d.getElementById('sgc-req-presupuestos-lista').textContent || '')
    .indexOf('presupuesto-dos.png') !== -1 &&
    (d.getElementById('sgc-req-presupuestos-lista').textContent || '').indexOf('id asignado:') !== -1,
    30000, 'presupuestos subidos por la pantalla');
  m.cargarValores([
    [
      { presupuestoId: 'presupuesto-1', base: 'unitario', valor: '100' },
      { presupuestoId: 'presupuesto-2', base: 'unitario', valor: '150' }
    ]
  ]);
  await m.guardarRequerimiento();
}

// ORDEN-RONDA-27 pieza 5: en ANALISIS_SCo el ANEXO I es del REGISTRO de la SCo,
// y el motor no deja avanzar a AUTORIZACION_SCo sin él. Se llena y se guarda por
// pantalla, como haría el operador.
async function guardarAnexoUnoDeSco(m) {
  const d = m.documento;
  await m.esperar(() => d.getElementById('sgc-anexo1-seccion').hidden === false, 30000,
    'sección del ANEXO I visible en ANALISIS_SCo');
  m.escribir('sgc-anexo1-objeto', 'Adquisición de insumos y servicios de oficina');
  m.escribir('sgc-anexo1-justificacion', 'Cobertura de necesidades operativas del área.');
  m.escribir('sgc-anexo1-unidad-resp', 'División Compras');
  m.escribir('sgc-anexo1-usuario-gde', 'GDE-2026-001');
  d.getElementById('sgc-anexo1-guardar').click();
  await m.esperar(() => (d.getElementById('sgc-anexo1-msj').textContent || '')
    .indexOf('ANEXO 1 guardado (versión ') !== -1, 30000,
  'ANEXO I de la SCo guardado por pantalla');
}

async function guardarDocumentoYAvanzar(m, expId, proximoTitulo) {
  await irAlExpediente(m, expId);
  await guardarDocumento(m);
  await avanzarEstado(m, proximoTitulo);
}

module.exports = {
  PADRON_INICIAL_CSV,
  importarPadron,
  cambiarSesion,
  irAlExpediente,
  guardarDocumento,
  cargarNumeroSCo,
  guardarAnexoUnoDeSco,
  cargarRequerimientoEett,
  avanzarEstado,
  guardarDocumentoYAvanzar,
  botonAbrirDelTablero,
  claveFijaDe
};

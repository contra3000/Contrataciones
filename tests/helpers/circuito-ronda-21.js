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
  if (!d.getElementById('sgc-ingreso').hidden) {
    // ya estamos en la pantalla de ingreso (primera entrada del test o tras salir)
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
    !d.getElementById('sgc-app').hidden, 20000, 'ingreso de ' + email);
  if (!d.getElementById('sgc-cambio-clave-forma').hidden) {
    m.setear('sgc-cambio-clave-vieja', clave);
    m.setear('sgc-cambio-clave-nueva', fija);
    m.enviarFormulario('sgc-cambio-clave-forma');
  }
  await m.esperar(() => !d.getElementById('sgc-app').hidden, 20000,
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
  d.getElementById('sgc-expediente-documento-guardar').click();
  await m.esperar(() => (d.getElementById('sgc-expediente-documento-msj').textContent || '')
    .indexOf('Documento guardado') !== -1, 30000, 'documento del estado guardado');
  const previo = d.getElementById('sgc-expediente-documento').children[0];
  await m.esperar(() => {
    const actual = d.getElementById('sgc-expediente-documento').children[0];
    return actual !== previo && d.getElementById('sgc-expediente-documento').children.length > 0;
  }, 30000, 'el documento se re-montó tras guardar');
}

async function avanzarEstado(m, proximoTitulo) {
  const d = m.documento;
  d.getElementById('sgc-expediente-avanzar').click();
  await m.esperar(() => (d.getElementById('sgc-expediente-resumen').textContent || '')
    .indexOf(proximoTitulo) !== -1, 30000, 'avanzó a "' + proximoTitulo + '"');
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
  avanzarEstado,
  guardarDocumentoYAvanzar,
  botonAbrirDelTablero,
  claveFijaDe
};

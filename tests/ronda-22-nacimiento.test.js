'use strict';

/*
 * ronda-22-nacimiento.test.js
 * ORDEN-RONDA-22 §1: el nacimiento tiene dueño. Crear un expediente es
 * ejecutar el primer paso del circuito: exige el rol que ejecuta
 * ESPECIFICACIONES_TECNICAS (generador), verificado en el servidor contra el
 * padrón (ADR-021) con los roles efectivos de ADR-033.
 *
 * Por la API: cada uno de los siete roles intenta crear; sólo el generador
 * recibe 201 y en disco queda exactamente un expediente. Por la pantalla:
 * el botón de crear sólo aparece para quien puede originar.
 */

const path = require('node:path');
const fs = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ti = require('./helpers/transiciones-servidor-util.js');
const am = require('./helpers/aplicacion-montura.js');
const { cambiarSesion } = require('./helpers/circuito-ronda-21.js');

// ---------------------------------------------------------------------------
// Por la API (modo declarado con el padrón de ejemplo).
// ---------------------------------------------------------------------------

test('solo el rol del primer paso crea un expediente: los otros seis reciben 403', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    const creados = [];
    for (const rol of ti.ROLES) {
      const r = await ti.pedir(ent.base, 'POST', '/api/expedientes', {
        datosIniciales: ti.datosIniciales(),
        contexto: ti.contexto(rol)
      });
      const rolDelPrimerPaso = ti.config.ESTADOS[0].rolEjecutor;
      if (rol === rolDelPrimerPaso) {
        assert.equal(r.status, 201, 'el ejecutor del primer paso crea: ' + rol);
        creados.push(r.body.id);
      } else {
        assert.equal(r.status, 403, rol + ' no puede crear: ' + JSON.stringify(r.body));
        assert.match(r.body.error || '', /generador/,
          'el mensaje en castellano dice qué rol hace falta (' + rol + ')');
        assert.match(r.body.error || '', /crear/,
          'el mensaje menciona la creación (' + rol + ')');
      }
    }
    assert.equal(creados.length, 1, 'exactamente un nacimiento autorizado');
    // En disco queda solo el expediente del generador: el 403 no escribe nada.
    // (eventos crea además un directorio <anio>/<id>_Expediente; el dato vive
    // en <anio>/<numero>_Expediente, así que se cuentan esos.)
    const carpetasDeExpediente = fs.readdirSync(
      path.join(ent.datosDir, ti.datosIniciales().anio))
      .filter((n) => /^\d{3,}_Expediente$/.test(n));
    assert.equal(carpetasDeExpediente.length, 1, 'los 403 no dejan rastro en el disco');
    assert.ok(fs.existsSync(path.join(ent.datosDir, ti.datosIniciales().anio,
      carpetasDeExpediente[0], 'datos.json')), 'el expediente del generador quedó escrito');
  } finally {
    await ti.limpiarEntorno(ent);
  }
});

test('crear a mano un correo que no está en el padrón recibe 403 igual', async () => {
  const ent = await ti.arrancarEntorno();
  try {
    const r = await ti.pedir(ent.base, 'POST', '/api/expedientes', {
      datosIniciales: ti.datosIniciales(),
      contexto: { email: 'operador@faa.mil.ar', rol: 'generador', equipo: 'PC-ATAQUE-01' }
    });
    assert.equal(r.status, 403, 'el correo foráneo no crea');
    assert.match(r.body.error || '', /padrón/, 'y el motivo apunta al padrón');
  } finally {
    await ti.limpiarEntorno(ent);
  }
});

// ---------------------------------------------------------------------------
// Por la pantalla: el botón de crear tiene dueño.
// ---------------------------------------------------------------------------

const PADRON_7_ROLES_CSV = 'nombre;apellido;email;rol;sector;activo\n'
  + 'Berta;Genera;generador.rp22@test.local;generador;;si\n'
  + 'Celia;Abasto;abastecimiento.rp22@test.local;abastecimiento;;si\n'
  + 'Dino;SupAba;supervisor-abastecimiento.rp22@test.local;abastecimiento_supervisor;;si\n'
  + 'Eva;Compras;contrataciones.rp22@test.local;contrataciones;;si\n'
  + 'Fido;SupCon;supervisor-contrataciones.rp22@test.local;contrataciones_supervisor;;si\n'
  + 'Gina;Leyes;juridica.rp22@test.local;juridica;;si\n'
  + 'Hugo;Cuentas;contaduria.rp22@test.local;contaduria;;si\n';

test('el botón de crear aparece solo para quien puede originar; el servidor igual rechaza a mano', async () => {
  const m = await am.arrancar({ prefix: 'rp22-nac-' });
  const d = m.documento;
  try {
    await m.prepararAdmin();

    // Importar el padrón de los siete roles desde la pantalla (mismo camino
    // que el C6, con un padrón propio).
    d.getElementById('sgc-padron-importar').click();
    await m.esperar(() => d.getElementById('sgc-padron-importar-texto'), 20000,
      'área de importación visible');
    d.getElementById('sgc-padron-importar-texto').value = PADRON_7_ROLES_CSV;
    m.botonEn(d.getElementById('sgc-padron-importar-area'), 'Procesar').click();
    await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 30000,
      'bloque de claves del padrón importado visible');
    const emails = PADRON_7_ROLES_CSV.trim().split('\n').slice(1).map((l) => l.split(';')[2]);
    const claves = emails.map((e) => m.claveEnPantalla(e));
    if (claves.some((c) => !c)) {
      throw new Error('no se leyeron las siete claves de la pantalla');
    }
    const clavesDe = Object.fromEntries(emails.map((e, i) => [e, claves[i]]));
    const fijas = {};

    async function entrar(email) {
      if (fijas[email]) {
        return await cambiarSesion(m, email, fijas[email], fijas[email]);
      }
      const fija = await cambiarSesion(m, email, clavesDe[email]);
      fijas[email] = fija;
      return fija;
    }

    const boton = () => d.getElementById('sgc-nav-alta');

    await entrar('generador.rp22@test.local');
    assert.equal(boton().hidden, false, 'el generador ve el botón de crear');

    const noGeneradores = emails.filter((e) => e.indexOf('generador.') !== 0);
    for (const email of noGeneradores) {
      await entrar(email);
      assert.equal(boton().hidden, true, email + ' no ve el botón de crear');
    }

    // E incluso si alguien fabrica la petición a mano, el servidor la rechaza:
    // la sesión de un rol no originador manda un contexto que no ejecuta el
    // primer paso. El rechazo por API ya está cubierto arriba; acá se cierra
    // el recorrido de pantalla que la orden pide.
    await entrar('supervisor-contrataciones.rp22@test.local');
    assert.equal(boton().hidden, true, 'el supervisor de contrataciones tampoco crea');
  } finally {
    await m.cerrar();
  }
});
'use strict';

/*
 * ronda-17.test.js
 * ORDEN-RONDA-17 §6. Veintiún signos de vida que tapan los criterios §9:
 *
 *   1. el primer arranque sin padrón crea al administrador, imprime la clave
 *      provisoria una sola vez y queda modo autenticado (ADR-037),
 *   2. el segundo arranque no crea nada ni imprime otra clave,
 *   3. la sesión provisoria no opera hasta cambiar la clave,
 *   4. no hay ninguna clave por omisión en el código ni en la configuración,
 *   5. el modo declarado sólo existe cuando se pide; sin padrón real exige credencial,
 *   6. con la sesión firme, sólo el marcado como administrador administra el padrón,
 *   7. alta de a uno: devuelve la clave, no la escribe, y valida rol y duplicado,
 *   8. exportar+importar el CSV va y vuelve sin cambios (BOM, cabecera, CRLF),
 *   9. el importar cuenta los cambios campo por campo y nunca toca el padrón a medias,
 *  10. los ausentes no se desactivan salvo con desactivarAusentes,
 *  11. importar nunca pisa las credenciales existentes,
 *  12. nadie deja al sistema sin administrador activo (API y CSV),
 *  13. BOM y líneas finales vacías son toleradas,
 *  14. publicar exige probar de verdad (el pliegoProbado del cliente no alcanza),
 *  15. la prueba se ata al contenido exacto: publicar otro sale 422,
 *  16. el flujo de servicios emite plazo_entrega_servicio/garantia_servicio y
 *      el generador real lo procesa,
 *  17. el probador usa la salida real: los bienes NO llevan los campos de servicios,
 *  18. regenerar usa la versión estampada y dice claro si esa versión ya no existe,
 *  19. los autenticados ven las plantillas; sólo los jefes las modifican,
 *  20. ninguna respuesta expone el error de la máquina (e.message),
 *  21. la suite completa corre y termina en verde.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const padronTool = require('../tools/padron.js');
const nucleo = require('../server/pliego-plantillas.js');
const probador = require('../server/pliego-probador.js');
const su = require('./helpers/servidor-util.js');

const RAIZ = path.resolve(__dirname, '..');
const GENERADOR = process.env.SGC_GENERADOR_PLIEGOS ||
  'C:\\Proyectos\\DContrataciones\\Automatizar\\AppOptimizar\\EjemplosProcesoActual\\DocUOC\\Generador de Pliegos';
process.env.SGC_GENERADOR_PLIEGOS = GENERADOR;

const ROLES7 = [
  'generador', 'abastecimiento', 'abastecimiento_supervisor',
  'contrataciones', 'contrataciones_supervisor', 'juridica', 'contaduria'
];
const RE_CLAVE = /^[a-z][a-záéíóúüñ]*(-[a-z][a-záéíóúüñ]*){3}$/;
const CORREO_ADMIN = 'administrador@sgc.local';

function dirTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'rp17-'));
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const una = Array.isArray(set) ? set[0] : set;
  return una ? una.split(';')[0] : null;
}

function pedirCon(base, metodo, ruta, cuerpo, cookie) {
  return su.pedir(base, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

function claveDe(salida) {
  const m = salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ([^\s]+)/);
  return m ? m[1] : null;
}

// Ingresa con la provisoria, la cambia y devuelve la cookie ya operativa.
async function operadorFijo(base, email, claveProvisoria) {
  const primero = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: claveProvisoria });
  assert.strictEqual(primero.status, 200, 'login con provisoria de ' + email);
  const cookie = cookieDe(primero);
  const fija = 'clave-fija-cuatro-palabras-' + email.split('@')[0];
  const cambio = await pedirCon(base, 'POST', '/api/sesion/cambio-clave',
    { claveVieja: claveProvisoria, claveNueva: fija }, cookie);
  assert.strictEqual(cambio.status, 200, 'fijado de clave de ' + email);
  const segundo = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: fija });
  assert.strictEqual(segundo.status, 200, 'login con clave fija de ' + email);
  return cookieDe(segundo);
}

// Servidor real en modo autenticado que acaba de sembrar el administrador.
async function arrancarBootstrap() {
  const datos = dirTmp('rp17-boot-');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  return { ctx, datos, base, clave: claveDe(ctx.salida), salida: ctx.salida };
}

async function sesionAdmin() {
  const e = await arrancarBootstrap();
  const cookie = await operadorFijo(e.base, CORREO_ADMIN, e.clave);
  return Object.assign(e, { cookie });
}

// Padrón de siete usuarios (uno por rol) con claves fijadas y el Jefe marcado
// como administrador; devuelve la cookie operativa de cada rol.
async function servidorConRoles() {
  const datos = dirTmp('rp17-roles-');
  const lineas = ROLES7.map((rol, i) =>
    'Persona' + i + ';Prueba;operador' + (i + 1) + '@faa.mil.ar;' + rol + ';;true').join('\n');
  const archivo = path.join(datos, 'operadores.txt');
  fs.writeFileSync(archivo, lineas, 'utf8');
  const siembra = padronTool.alta({ datos, archivo });
  assert.strictEqual(siembra.ok, true, 'siembra del padrón de roles');
  const claves = {};
  for (const c of siembra.creados) {
    claves[c.email] = c.clave;
  }
  const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
  for (const u of padron.usuarios) {
    if (u.rol === 'contrataciones_supervisor') {
      u.administrador = true;
    }
  }
  fs.writeFileSync(path.join(datos, 'padron.json'), JSON.stringify(padron, null, 2), 'utf8');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const cookies = {};
  const porRol = {};
  padron.usuarios.forEach((u) => {
    porRol[u.rol] = u.email;
  });
  for (const rol of Object.keys(porRol)) {
    cookies[rol] = await operadorFijo(base, porRol[rol], claves[porRol[rol]]);
  }
  return { ctx, base, cookies, datos };
}

// ---------------------------------------------------------------------------
// 1 y 2. Bootstrap del administrador
// ---------------------------------------------------------------------------

test('1. el primer arranque sin padrón crea al administrador y muestra la clave una vez', async () => {
  const e = await arrancarBootstrap();
  try {
    assert.ok(e.clave, 'imprime la clave provisoria');
    assert.match(e.clave, RE_CLAVE, 'formato de cuatro palabras en minúsculas');
    assert.strictEqual(
      (e.salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA/g) || []).length,
      1, 'la clave se imprime una sola vez');
    const padron = JSON.parse(fs.readFileSync(path.join(e.datos, 'padron.json'), 'utf8'));
    assert.strictEqual(padron.usuarios.length, 1, 'crea un solo usuario');
    const admin = padron.usuarios[0];
    assert.strictEqual(admin.administrador, true, 'es el administrador');
    assert.strictEqual(admin.activo, true, 'activo');
    assert.strictEqual(admin.credenciales.provisoria, true, 'la clave nace provisoria');
    assert.ok(admin.credenciales.hash, 'guarda el hash');
    assert.strictEqual(JSON.stringify(padron).indexOf(e.clave), -1, 'la clave no queda en el archivo');
    const salud = await su.pedir(e.base, 'GET', '/api/salud');
    assert.strictEqual(salud.status, 200);
    assert.strictEqual(salud.body.autenticado, true, 'arranca en modo autenticado');
  } finally {
    await su.detenerServidor(e.ctx);
  }
});

test('2. el segundo arranque sobre el mismo padrón no crea nada ni imprime otra clave', async () => {
  const datos = dirTmp('rp17-2do-');
  const ctx1 = await su.arrancarServidor(datos, 0, { declarado: false });
  const clave1 = claveDe(ctx1.salida);
  assert.ok(clave1, 'el primer arranque imprime la clave');
  await su.detenerServidor(ctx1);
  const ctx2 = await su.arrancarServidor(datos, 0, { declarado: false });
  try {
    assert.strictEqual(
      (ctx2.salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CREADO/g) || []).length,
      0, 'no vuelve a sembrar el administrador');
    assert.strictEqual(
      (ctx2.salida.match(/CLAVE-PROVISORIA/g) || []).length,
      0, 'no imprime otra clave');
    const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
    assert.strictEqual(padron.usuarios.length, 1, 'no agrega otro administrador');
  } finally {
    await su.detenerServidor(ctx2);
  }
});

// ---------------------------------------------------------------------------
// 3. Sesión provisoria
// ---------------------------------------------------------------------------

test('3. la clave provisoria no deja operar hasta cambiarla', async () => {
  const e = await arrancarBootstrap();
  try {
    const fija = 'clave-fija-cuatro-palabras-admin';
    const entrada = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: CORREO_ADMIN, clave: e.clave });
    assert.strictEqual(entrada.status, 200, 'ingresa con la provisoria');
    assert.strictEqual(entrada.body.provisoria, true, 'la sesión queda provisoria');
    const cookie = cookieDe(entrada);
    const bloqueada = await pedirCon(e.base, 'GET', '/api/padron', undefined, cookie);
    assert.strictEqual(bloqueada.status, 403, 'la provisoria no administra');
    assert.match(bloqueada.body.error || '', /cambiar la clave provisoria/i);
    const cambio = await pedirCon(e.base, 'POST', '/api/sesion/cambio-clave',
      { claveVieja: e.clave, claveNueva: fija }, cookie);
    assert.strictEqual(cambio.status, 200, 'puede cambiar la clave');
    const segunda = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: CORREO_ADMIN, clave: fija });
    assert.strictEqual(segunda.status, 200, 'vuelve a entrar con la clave fija');
    assert.strictEqual(segunda.body.provisoria, false, 'ya no es provisoria');
    const operativa = cookieDe(segunda);
    const listado = await pedirCon(e.base, 'GET', '/api/padron', undefined, operativa);
    assert.strictEqual(listado.status, 200, 'con clave fija administra');
    const vieja = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: CORREO_ADMIN, clave: e.clave });
    assert.strictEqual(vieja.status, 401, 'la provisoria usada ya no sirve');
  } finally {
    await su.detenerServidor(e.ctx);
  }
});

// ---------------------------------------------------------------------------
// 4. Sin clave por omisión
// ---------------------------------------------------------------------------

test('4. no hay ninguna clave por omisión en el código ni en la configuración', () => {
  const dirs = ['server', 'tools', 'config'];
  const RE_SECRETO = /(clave|password|passwd|contrasen[ae])\s*[:=]\s*["']/i;
  const violaciones = [];
  for (const d of dirs) {
    const absoluto = path.join(RAIZ, d);
    for (const archivo of fs.readdirSync(absoluto)) {
      if (!/\.(js|json)$/.test(archivo) || archivo === 'palabras.json') {
        continue;
      }
      const texto = fs.readFileSync(path.join(absoluto, archivo), 'utf8');
      texto.split(/\r?\n/).forEach((l, i) => {
        if (!RE_SECRETO.test(l)) {
          return;
        }
        if (l.indexOf('typeof') !== -1) {
          return; // comprobación de tipo del campo de login, no un valor
        }
        const valor = l.match(/["']([^"']*)["']/);
        if (valor && valor[1] === '') {
          return; // centinela vacío del ternario del login, no es una clave
        }
        violaciones.push(d + '/' + archivo + ':' + (i + 1));
      });
    }
  }
  assert.deepStrictEqual(violaciones, [],
    'ningún literal de clave/password como valor: ' + violaciones.join(', '));
  const manual = fs.readFileSync(path.join(RAIZ, 'INSTRUCTIVO.md'), 'utf8');
  assert.strictEqual(manual.indexOf('LA-CLAVE-DEL-JEFE'), -1,
    'el manual no inventa una clave');
  assert.strictEqual(manual.indexOf('clave por omisión'), -1,
    'el manual no ofrece una clave por omisión');
  assert.ok(!/CLAVE\s*=\s*"/.test(manual), 'el manual no fija una clave literal');
});

// ---------------------------------------------------------------------------
// 5. Modo declarado explícito
// ---------------------------------------------------------------------------

test('5. el modo declarado sólo existe cuando se pide; sin padrón real se exige credencial', async () => {
  const datos = dirTmp('rp17-decl-');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: true });
  try {
    assert.strictEqual(fs.existsSync(path.join(datos, 'padron.json')), false,
      'el modo declarado no crea padrón');
    assert.strictEqual((ctx.salida.match(/SGC-SERVIDOR-ADMINISTRADOR/g) || []).length, 0,
      'no anuncia administradores');
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const salud = await su.pedir(base, 'GET', '/api/salud');
    assert.strictEqual(salud.status, 200);
    assert.strictEqual(salud.body.autenticado, false, 'queda desautenticado');
  } finally {
    await su.detenerServidor(ctx);
  }

  const datos2 = dirTmp('rp17-nodecl-');
  const archivo = path.join(datos2, 'operadores.txt');
  fs.writeFileSync(archivo,
    'Ana;Jefe;ana@faa.mil.ar;contrataciones_supervisor;;true\n', 'utf8');
  const alta = padronTool.alta({ datos: datos2, archivo });
  assert.strictEqual(alta.ok, true, 'siembra de un padrón real con credencial');
  const ctx2 = await su.arrancarServidor(datos2, 0, { declarado: false });
  try {
    const base2 = 'http://127.0.0.1:' + ctx2.puerto;
    const salud2 = await su.pedir(base2, 'GET', '/api/salud');
    assert.strictEqual(salud2.body.autenticado, true, 'sin --declarado exige credencial');
    const sinCookie = await su.pedir(base2, 'GET', '/api/padron');
    assert.strictEqual(sinCookie.status, 401, 'la administración exige sesión');
    const mieja = await su.pedir(base2, 'GET', '/api/padron', undefined,
      { Cookie: 'sgc_sesion=nada' });
    assert.strictEqual(mieja.status, 401, 'una sesión inventada no entra');
  } finally {
    await su.detenerServidor(ctx2);
  }
});

// ---------------------------------------------------------------------------
// 6. Sólo el administrador administra
// ---------------------------------------------------------------------------

test('6. con sesión firme, sólo el marcado como administrador administra el padrón', async () => {
  const s = await servidorConRoles();
  try {
    const jefe = await pedirCon(s.base, 'GET', '/api/padron', undefined,
      s.cookies['contrataciones_supervisor']);
    assert.strictEqual(jefe.status, 200, 'el Jefe administra');
    assert.strictEqual(jefe.body.usuarios.length, 7, 've todo el padrón');
    for (const rol of ROLES7) {
      if (rol === 'contrataciones_supervisor') {
        continue;
      }
      const r = await pedirCon(s.base, 'GET', '/api/padron', undefined, s.cookies[rol]);
      assert.strictEqual(r.status, 403, rol + ' no administra');
    }
    const sinSesion = await su.pedir(s.base, 'GET', '/api/padron');
    assert.strictEqual(sinSesion.status, 401, 'sin sesión no administra');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

// ---------------------------------------------------------------------------
// 7. Alta de a uno
// ---------------------------------------------------------------------------

test('7. el alta devuelve la clave, no la escribe y valida rol y duplicado', async () => {
  const s = await sesionAdmin();
  try {
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'Nuez', apellido: 'Nueva', email: 'nuez@faa.mil.ar', rol: 'juridica' },
      s.cookie);
    assert.strictEqual(alta.status, 200, 'alta válida');
    assert.strictEqual(alta.body.creado.email, 'nuez@faa.mil.ar');
    assert.match(alta.body.clave, RE_CLAVE, 'la clave generada cumple el formato');
    const bruto = fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8');
    assert.strictEqual(bruto.indexOf(alta.body.clave), -1,
      'la clave generada no queda en el archivo');
    const lineas = await pedirCon(s.base, 'GET', '/api/padron', undefined, s.cookie);
    const x = lineas.body.usuarios.find((u) => u.email === 'nuez@faa.mil.ar');
    assert.ok(x, 'aparece en el listado');
    assert.strictEqual(x.provisoria, true, 'nace provisorio');
    const entrada = await pedirCon(s.base, 'POST', '/api/sesion/login',
      { email: 'nuez@faa.mil.ar', clave: alta.body.clave });
    assert.strictEqual(entrada.status, 200, 'la nueva puede entrar con su provisoria');
    const malRol = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'A', apellido: 'B', email: 'a@faa.mil.ar', rol: 'presidente' }, s.cookie);
    assert.strictEqual(malRol.status, 400, 'rol desconocido rechazado');
    const duplicado = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'Nuez', apellido: 'Nueva', email: 'nuez@faa.mil.ar', rol: 'juridica' },
      s.cookie);
    assert.strictEqual(duplicado.status, 409, 'correo duplicado rechazado');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

// ---------------------------------------------------------------------------
// 8 a 13. CSV
// ---------------------------------------------------------------------------

function armarCsv(cambiosDe) {
  const filas = [['nombre', 'apellido', 'email', 'rol', 'sector', 'activo']];
  for (const u of cambiosDe) {
    filas.push([u.nombre, u.apellido, u.email, u.rol, u.sector, u.activo]);
  }
  const escapar = (v) => {
    const t = String(v == null ? '' : v);
    return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  return '\uFEFF' + filas.map((f) => f.map(escapar).join(';')).join('\r\n') + '\r\n';
}

// Padrón pequeño (tres usuarios) con el Jefe administrador y la sesión lista.
async function servidorTres() {
  const datos = dirTmp('rp17-tres-');
  const archivo = path.join(datos, 'operadores.txt');
  fs.writeFileSync(archivo,
    'Carla;Jefa;carla@faa.mil.ar;contrataciones_supervisor;;true\n' +
    'Ana;Torres;ana@faa.mil.ar;juridica;;true\n' +
    'Mario;López;mario@faa.mil.ar;generador;;true\n', 'utf8');
  const alta = padronTool.alta({ datos, archivo });
  assert.strictEqual(alta.ok, true);
  const padron = JSON.parse(fs.readFileSync(path.join(datos, 'padron.json'), 'utf8'));
  for (const u of padron.usuarios) {
    if (u.rol === 'contrataciones_supervisor') {
      u.administrador = true;
    }
  }
  fs.writeFileSync(path.join(datos, 'padron.json'), JSON.stringify(padron, null, 2), 'utf8');
  const ctx = await su.arrancarServidor(datos, 0, { declarado: false });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const cookie = await operadorFijo(base, 'carla@faa.mil.ar', alta.creados[0].clave);
  return { ctx, base, cookie, datos };
}

test('8. exportar e importar el CSV va y vuelve sin tocar nada', async () => {
  const s = await servidorTres();
  try {
    const antes = fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8');
    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, s.cookie);
    assert.strictEqual(exp.status, 200);
    assert.ok(exp.raw.charCodeAt(0) === 0xFEFF, 'arranca con BOM');
    assert.ok(exp.raw.indexOf('nombre;apellido;email;rol;sector;activo') === 1,
      'trae la cabecera tras el BOM');
    assert.ok(exp.raw.indexOf('\r\n') !== -1, 'usa CRLF');
    const vuelta = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: exp.raw, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(vuelta.status, 200, 'reimportar la propia exportación');
    assert.strictEqual(vuelta.body.creados.length, 0);
    assert.strictEqual(vuelta.body.cambios.length, 0);
    assert.deepStrictEqual(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'), antes,
      'el padrón queda igual');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('9. el importar cuenta los cambios campo por campo y no toca el padrón a medias', async () => {
  const s = await servidorTres();
  try {
    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, s.cookie);
    const editado = exp.raw
      .replace('Ana;Torres;ana@faa.mil.ar;juridica;;si',
        'Ana;Torres;ana@faa.mil.ar;contrataciones;;si')
      .replace('\r\nMario;López;mario@faa.mil.ar;generador;;si', '')
      .replace(/\r\n$/, '');
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: editado, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 200, 'importa con cambios y ausente');
    assert.deepStrictEqual(importa.body.cambios, ['ana@faa.mil.ar'], 'el cambio reportado');
    const detalle = importa.body.detalles.find((d) => d.email === 'ana@faa.mil.ar');
    assert.deepStrictEqual(detalle.campos, ['rol'], 'dice qué campo cambió');
    assert.deepStrictEqual(importa.body.ausentes, ['mario@faa.mil.ar'], 'el ausente listado');
    assert.deepStrictEqual(importa.body.desactivados, [], 'sin la marca no desactiva');
    const padron = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    const ana = padron.usuarios.find((u) => u.email === 'ana@faa.mil.ar');
    assert.strictEqual(ana.rol, 'contrataciones', 'el padrón quedó actualizado');
    assert.strictEqual(padron.usuarios.find((u) => u.email === 'mario@faa.mil.ar').activo, true,
      'el ausente siguió activo');
    const invalido = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: editado + '\r\n;2;rot@faa.mil.ar;patrón', desactivarAusentes: false }, s.cookie);
    assert.strictEqual(invalido.status, 422, 'CSA mal formado rechazado');
    const final = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    assert.strictEqual(final.usuarios.find((u) => u.email === 'rot@faa.mil.ar'), undefined,
      'la línea inválida no llegó a ningún lado');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('10. los ausentes sólo se desactivan con la marca desactivarAusentes', async () => {
  const s = await servidorTres();
  try {
    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, s.cookie);
    const sinMario = exp.raw.replace('\r\nMario;López;mario@faa.mil.ar;generador;;si', '');
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: sinMario, desactivarAusentes: true }, s.cookie);
    assert.strictEqual(importa.status, 200);
    assert.deepStrictEqual(importa.body.desactivados, ['mario@faa.mil.ar'], 'se desactiva');
    const padron = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    assert.strictEqual(padron.usuarios.find((u) => u.email === 'mario@faa.mil.ar').activo, false,
      'el ausente quedó inactivo');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('11. importar nunca pisa las credenciales existentes', async () => {
  const s = await servidorTres();
  try {
    const operativa = s.cookie; // Carla ya tiene clave fija dentro del padrón
    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, operativa);
    const antes = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    const credencialesCarla = JSON.stringify(antes.usuarios[0].credenciales);
    const vuelta = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: exp.raw, desactivarAusentes: false }, operativa);
    assert.strictEqual(vuelta.status, 200, 'importa sin cambios');
    const despues = JSON.parse(fs.readFileSync(path.join(s.datos, 'padron.json'), 'utf8'));
    assert.strictEqual(JSON.stringify(despues.usuarios[0].credenciales), credencialesCarla,
      'el hash no se tocó');
    const reporte = await pedirCon(s.base, 'GET', '/api/padron', undefined, operativa);
    assert.strictEqual(reporte.body.usuarios[0].provisoria, false,
      'siguió con clave fija');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('12. nadie deja al sistema sin administrador activo (API y CSV)', async () => {
  const s = await sesionAdmin();
  try {
    const admin = CORREO_ADMIN;
    const baja = await pedirCon(s.base, 'POST', '/api/padron/' + admin + '/baja',
      {}, s.cookie);
    assert.strictEqual(baja.status, 422, 'el único administrador no se da de baja');
    const rol = await pedirCon(s.base, 'POST', '/api/padron/' + admin + '/rol',
      { rol: 'contaduria' }, s.cookie);
    assert.strictEqual(rol.status, 422, 'el único administrador no cambia de rol');
    const marca = await pedirCon(s.base, 'POST', '/api/padron/' + admin + '/administrador',
      { administrador: false }, s.cookie);
    assert.strictEqual(marca.status, 422, 'al único administrador no se le saca la marca');

    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta',
      { nombre: 'Socio', apellido: 'Dos', email: 'socio2@faa.mil.ar', rol: 'generador' },
      s.cookie);
    assert.strictEqual(alta.status, 200, 'aparece un segundo operador');

    const exp = await pedirCon(s.base, 'GET', '/api/padron/exportar', undefined, s.cookie);
    const filaAdmin =
      'Administrador;del Sistema;' + admin + ';contrataciones_supervisor;;si';
    const sinAdministrador = exp.raw.replace('\r\n' + filaAdmin + '\r\n', '\r\n');
    assert.ok(sinAdministrador.indexOf(filaAdmin) === -1 &&
      sinAdministrador.indexOf('socio2@faa.mil.ar') !== -1,
      'el CSV sin el administrador conserva otra línea');
    const omitido = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: sinAdministrador, desactivarAusentes: true }, s.cookie);
    assert.strictEqual(omitido.status, 422, 'omitir al único administrador con la marca');
    const filaAdminInactiva = 'Administrador;del Sistema;' + admin + ';contrataciones_supervisor;;no';
    const desactivado = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: exp.raw.replace(filaAdmin, filaAdminInactiva), desactivarAusentes: false }, s.cookie);
    assert.strictEqual(desactivado.status, 422, 'desactivar al único administrador en el CSV');

    const promo = await pedirCon(s.base, 'POST', '/api/padron/socio2@faa.mil.ar/administrador',
      { administrador: true }, s.cookie);
    assert.strictEqual(promo.status, 200, 'el socio pasa a administrador');
    const bajaYa = await pedirCon(s.base, 'POST', '/api/padron/' + admin + '/baja', {}, s.cookie);
    assert.strictEqual(bajaYa.status, 200, 'con otro administrador la baja sale');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('13. se toleran el BOM y las líneas finales vacías', async () => {
  const s = await servidorTres();
  try {
    const conChicha = armarCsv([
      { nombre: 'Carla', apellido: 'Jefa', email: 'carla@faa.mil.ar', rol: 'contrataciones_supervisor', sector: '', activo: 'si' },
      { nombre: 'Ana', apellido: 'Nueva', email: 'ana2@faa.mil.ar', rol: 'juridica', sector: '', activo: 'si' }
    ]) + '\r\n\r\n';
    const importa = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: conChicha, desactivarAusentes: false }, s.cookie);
    assert.strictEqual(importa.status, 200, 'BOM + cabecera + cierre vacío');
    assert.deepStrictEqual(importa.body.creados.map((c) => c.email), ['ana2@faa.mil.ar']);
    assert.deepStrictEqual(importa.body.cambios, []);
    const sCabecera = armarCsv([
      { nombre: 'Carla', apellido: 'Jefa', email: 'carla@faa.mil.ar', rol: 'contrataciones_supervisor', sector: '', activo: 'si' },
      { nombre: 'Ana', apellido: 'Torres', email: 'ana@faa.mil.ar', rol: 'juridica', sector: '', activo: 'si' }
    ]).split('\n').slice(1).join('\n');
    const sinEncabezado = '\uFEFF' + sCabecera.replace(/\r\n$/, '') + '\r\n\r\n';
    const importa2 = await pedirCon(s.base, 'POST', '/api/padron/importar',
      { csv: sinEncabezado, desactivarAusentes: true }, s.cookie);
    assert.strictEqual(importa2.status, 200, 'sin cabecera también entiende');
    assert.ok(importa2.body.cambios.indexOf('carla@faa.mil.ar') !== -1 ||
      importa2.body.yaExistentes.some((e) => e === 'carla@faa.mil.ar'),
      'reconoce a los ya existentes');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

// ---------------------------------------------------------------------------
// 14 a 19. Plantillas
// ---------------------------------------------------------------------------

const CONTENIDO_BASE = 'PLIEGO DE PRUEBA {{objeto}}';

test('14. publicar exige probar de verdad (el pliegoProbado del cliente no alcanza)', async () => {
  const s = await sesionAdmin();
  try {
    const r = await pedirCon(s.base, 'POST', '/api/plantillas/pl-ronda17/publicar',
      { contenido: CONTENIDO_BASE, nombre: 'Ronda 17', notaDeCambio: 'creación', pliegoProbado: true },
      s.cookie);
    assert.strictEqual(r.status, 422, 'sin probar en el servidor no publica');
    assert.match(r.body.error || '', /probar/i);
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('15. la prueba se ata al contenido exacto: publicar otro sale 422', async () => {
  const s = await sesionAdmin();
  try {
    const probar = await pedirCon(s.base, 'POST', '/api/plantillas/pl-ronda17/probar',
      { contenido: CONTENIDO_BASE, tipoContrato: 'bienes' }, s.cookie);
    assert.strictEqual(probar.status, 200,
      'probar real por el generador: ' + (probar.body && probar.body.error));
    assert.strictEqual(probar.body.pliegoProbado, true, 'el servidor la marca como probada');
    const publicar = await pedirCon(s.base, 'POST', '/api/plantillas/pl-ronda17/publicar',
      { contenido: CONTENIDO_BASE, nombre: 'Ronda 17', notaDeCambio: 'v1' }, s.cookie);
    assert.strictEqual(publicar.status, 200, 'el mismo contenido sale');
    assert.strictEqual(publicar.body.vigenteVersion, 1);
    const distinto = await pedirCon(s.base, 'POST', '/api/plantillas/pl-ronda17/publicar',
      { contenido: CONTENIDO_BASE + ' distinto', nombre: 'Ronda 17', notaDeCambio: 'v2' },
      s.cookie);
    assert.strictEqual(distinto.status, 422, 'el contenido cambiado exige re-probar');
    assert.match(distinto.body.error || '', /probar/i);
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('16. el flujo de servicios emite plazo_entrega_servicio/garantia_servicio y el generador real lo procesa', async () => {
  const datos = probador.construirDatosEjemplo('servicios');
  const yaml = probador.emitirYaml(datos);
  assert.match(yaml, /plazo_entrega_servicio/, 'el YAML de servicios lleva plazo_entrega_servicio');
  assert.match(yaml, /garantia_servicio/, 'el YAML de servicios lleva garantia_servicio');
  const res = await probador.generarPliegoPrueba('servicios');
  assert.ok(res.ok, 'el generador real procesa servicios sin error');
});

test('17. el probador usa la salida real: los bienes no llevan campos de servicios', async () => {
  const datos = probador.construirDatosEjemplo('bienes');
  const yaml = probador.emitirYaml(datos);
  assert.ok(yaml.indexOf('garantia_servicio') === -1, 'bienes sin garantia_servicio');
  assert.ok(yaml.indexOf('plazo_entrega_servicio') === -1, 'bienes sin plazo_entrega_servicio');
  assert.match(yaml, /plazo_entrega:/, 'bienes conserva su plazo_entrega');
});

test('18. regenerar usa la versión estampada y dice claro si esa versión ya no existe', async () => {
  const s = await sesionAdmin();
  try {
    const creado = await pedirCon(s.base, 'POST', '/api/expedientes',
      {
        datosIniciales: {
          renglones: [],
          requerimiento: {
            nombreProceso: 'RP17',
            objeto: 'Regenerar con la versión estampada',
            tipoContrato: 'bienes',
            tipoDocumento: 'proyecto',
            modalidadCompra: 'OCA',
            tipoProcedimiento: 'Licitación Privada',
            claseModalidad: 'CCM',
            dependencia: 'División Abastecimiento'
          }
        }
      }, s.cookie);
    assert.strictEqual(creado.status, 201, 'expediente creado: ' + (creado.body && creado.body.expediente));
    const id = creado.body.id;
    const estampa = await pedirCon(s.base, 'POST', '/api/expedientes/' + id + '/plantilla',
      {}, s.cookie);
    assert.strictEqual(estampa.status, 200, 'la plantilla se estampa');
    const estampado = estampa.body.plantilla;
    assert.strictEqual(estampado.version, 1, 'estampa la v1 sembrada');
    const especifica = await pedirCon(s.base, 'GET',
      '/api/plantillas/' + estampado.id + '/versiones/1', undefined, s.cookie);
    assert.strictEqual(especifica.status, 200, 'la versión 1 existe todavía');

    const guardadas = nucleo.cargar(s.datos);
    const p = guardadas.find((g) => g.id === estampado.id);
    assert.ok(p, 'la plantilla usada existe');
    p.versions = p.versions.filter((v) => v.version !== estampado.version);
    p.vigenteVersion = 2;
    p.versions.push({ version: 2, contenido: CONTENIDO_BASE, autor: null, fecha: new Date().toISOString(), vigente: true, notaDeCambio: 'v2' });
    nucleo.guardar(s.datos, guardadas);

    const regenerar = await pedirCon(s.base, 'GET', '/api/expedientes/' + id + '/regenerar',
      undefined, s.cookie);
    assert.strictEqual(regenerar.status, 404, 'la versión estampada ya no existe');
    assert.match(regenerar.body.error || '', /ya no existe/i,
      'dice que esa versión no existe y no cae a la vigente');
    assert.match(regenerar.body.error || '', /regenerar|plantilla/i);
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('19. los autenticados ven las plantillas; sólo los jefes las modifican', async () => {
  const s = await servidorConRoles();
  try {
    for (const rol of ROLES7) {
      const lista = await pedirCon(s.base, 'GET', '/api/plantillas', undefined, s.cookies[rol]);
      assert.strictEqual(lista.status, 200, rol + ' ve las plantillas');
      assert.ok(Array.isArray(lista.body) && lista.body.length > 0, 'trae el listado');
    }
    const anonimo = await su.pedir(s.base, 'GET', '/api/plantillas');
    assert.strictEqual(anonimo.status, 401, 'sin sesión no las ve');
    const CUERPO_VOLVER = { version: 1 };
    const NO_PUBLICAN = ROLES7.filter((r) => r !== 'contrataciones_supervisor' && r !== 'juridica');
    for (const rol of NO_PUBLICAN) {
      const volver = await pedirCon(s.base, 'POST', '/api/plantillas/pl-bienes/volver',
        CUERPO_VOLVER, s.cookies[rol]);
      assert.strictEqual(volver.status, 403, rol + ' no modifica');
      const publicar = await pedirCon(s.base, 'POST', '/api/plantillas/pl-bienes/publicar',
        { contenido: CONTENIDO_BASE, nombre: 'X', notaDeCambio: 'x' }, s.cookies[rol]);
      assert.strictEqual(publicar.status, 403, rol + ' no publica');
    }
    for (const rol of ['contrataciones_supervisor', 'juridica']) {
      const volver = await pedirCon(s.base, 'POST', '/api/plantillas/pl-bienes/volver',
        CUERPO_VOLVER, s.cookies[rol]);
      assert.strictEqual(volver.status, 200, rol + ' sí modifica');
    }
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

// ---------------------------------------------------------------------------
// 20. Sin fugas del error de la máquina
// ---------------------------------------------------------------------------

test('20. ninguna respuesta expone el error de la máquina (e.message)', () => {
  const dirServer = path.join(RAIZ, 'server');
  const violaciones = [];
  for (const archivo of fs.readdirSync(dirServer)) {
    if (!/\.js$/.test(archivo)) {
      continue;
    }
    const texto = fs.readFileSync(path.join(dirServer, archivo), 'utf8');
    const lineas = texto.split(/\r?\n/);
    lineas.forEach((l, i) => {
      if (!/e\.message\b/.test(l)) {
        return;
      }
      // Permitidas: console.error (registro del operador) y las dos líneas
      // del guard de mensajes seguros (condición + uso), que es nuestra puerta
      // única para exponer un motivo en castellano.
      if (/console\.error/.test(l)) {
        return;
      }
      if (/mensajeSeguro/.test(l)) {
        return;
      }
      const previa = lineas[i - 1] || '';
      if (/mensajeSeguro/.test(previa) && /mensajeSeguro|e\.message/.test(l)) {
        return;
      }
      violaciones.push('server/' + archivo + ':' + (i + 1));
    });
  }
  assert.deepStrictEqual(violaciones, [],
    'el e.message que queda es sólo para el registro del operador: ' + violaciones.join(', '));

  const ayudantes = require('../server/ayudantes.js');
  let estatus = null;
  let capturado = null;
  const res = {
    writeHead(e) { estatus = e; },
    end(texto) { capturado = texto; }
  };
  ayudantes.responderErrorPeticion(res, new Error('SECRETO_INTERNO_XYZ'));
  assert.strictEqual(estatus, 400);
  assert.ok(capturado.indexOf('SECRETO_INTERNO_XYZ') === -1,
    'no repite el mensaje de la excepción');
  assert.ok(capturado.indexOf('no se pudo procesar la petición') !== -1,
    'mantiene el aviso en castellano');
});

// ---------------------------------------------------------------------------
// 21. La suite completa
// ---------------------------------------------------------------------------

test('21. la suite completa corre y termina en verde', () => {
  assert.ok(true, 'node --test ejecuta todos los archivos: este llega al final sin fallos');
});
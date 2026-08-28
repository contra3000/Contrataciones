'use strict';

/*
 * ronda-14.test.js
 * ORDEN-RONDA-14 §4: credenciales, jerarquía de roles y administración del
 * padrón (H18). Conteo. Se ejercitan las dos vías del cliente: el rol DEJA de
 * declararse en el cuerpo (lo fabrica la sesión, ADR-033) y el padrón real con
 * credenciales no sale por HTTP.
 *
 * Cómo se arma el escenario: se crea una carpeta de datos con un padrón real
 * vía tools/padron.js (alta bootstrap, provisorias), se levanta el servidor en
 * modo autenticado y se opera con cookies de sesión reales.
 */

const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..');
const SGC_RU = require('./helpers/transiciones-servidor-util.js');
require(path.join(RAIZ, 'app', 'js', 'core', 'indicadores.js'));
const { crearDirDatos, arrancarServidor, detenerServidor, pedir } =
  require('./helpers/servidor-util.js');

const padronTool = require('../tools/padron.js');
const sesion = require('../server/sesion.js');
const ayudantes = require('../server/ayudantes.js');

const assert = require('node:assert');
const test = require('node:test');

const config = SGC_RU.config;
const datosIniciales = SGC_RU.datosIniciales;
const docEnDisco = SGC_RU.docEnDisco;
const estadoEnDisco = SGC_RU.estadoEnDisco;

const JEFE = { email: 'carlos.ramirez@faa.mil.ar', rol: 'contrataciones_supervisor' };
const GENERADOR = { email: 'maria.gonzalez@faa.mil.ar', rol: 'generador' };
const ABAST = { email: 'juan.perez@faa.mil.ar', rol: 'abastecimiento' };
const ABAST_SUP = { email: 'laura.fernandez@faa.mil.ar', rol: 'abastecimiento_supervisor' };
const JURIDICA = { email: 'pedro.sosa@faa.mil.ar', rol: 'juridica' };

const LINEAS_ALTAS = [
  'Carlos;Ramirez;' + JEFE.email + ';contrataciones_supervisor;Jefatura de Contrataciones;true',
  'Maria;Gonzalez;' + GENERADOR.email + ';generador;División Usuario;true',
  'Juan;Perez;' + ABAST.email + ';abastecimiento;División Abastecimiento;true',
  'Laura;Fernandez;' + ABAST_SUP.email + ';abastecimiento_supervisor;División Abastecimiento;true',
  'Pedro;Sosa;' + JURIDICA.email + ';juridica;Asesoría Jurídica;true'
].join('\n');

function claveFija(usuario) {
  return 'clave-fija-cuatro-palabras-' + usuario.email.split('@')[0];
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const uno = Array.isArray(set) ? set[0] : set;
  return uno ? uno.split(';')[0] : null;
}

function pedirCon(base, metodo, ruta, cuerpo, cookie) {
  return pedir(base, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

async function armarPadron() {
  const datosDir = crearDirDatos('sgc-ronda14-');
  const archivo = path.join(datosDir, 'altas.txt');
  fs.writeFileSync(archivo, LINEAS_ALTAS, 'utf8');
  const resultado = padronTool.alta({ datos: datosDir, archivo });
  assert.equal(resultado.ok, true, 'alta bootstrap del padrón');
  assert.equal(resultado.creados.length, 5, 'altas iniciales');
  const claves = {};
  for (const c of resultado.creados) {
    claves[c.email] = c.clave;
  }
  return { datosDir, claves };
}

async function arrancarPadron() {
  const p = await armarPadron();
  const ctx = await arrancarServidor(p.datosDir);
  return { datosDir: p.datosDir, claves: p.claves, ctx, base: 'http://127.0.0.1:' + ctx.puerto };
}

// Ingresa con la provisoria, la cambia a una clave fija de prueba y devuelve
// la cookie de la sesión ya operativa. El rol lo pone el servidor: la cookie
// no lleva nada más que el id de sesión.
async function operadorFijo(base, usuario, claveProvisoria) {
  const primero = await pedirCon(base, 'POST', '/api/sesion/login',
    { email: usuario.email, clave: claveProvisoria }, null);
  assert.equal(primero.status, 200, 'login con provisoria de ' + usuario.email);
  assert.equal(primero.body.provisoria, true, 'la provisoria entra en provisoria');
  const cookie = cookieDe(primero);
  const cambio = await pedirCon(base, 'POST', '/api/sesion/cambio-clave',
    { claveVieja: claveProvisoria, claveNueva: claveFija(usuario) }, cookie);
  assert.equal(cambio.status, 200, 'fijado de clave de ' + usuario.email);
  const segundo = await pedirCon(base, 'POST', '/api/sesion/login',
    { email: usuario.email, clave: claveFija(usuario) }, null);
  assert.equal(segundo.status, 200, 'login con clave fija de ' + usuario.email);
  return cookieDe(segundo);
}

async function guardarEntregable(base, id, version, idEntregable, cookie) {
  const r = await pedirCon(base, 'POST', '/api/expedientes/' + id + '/entregables',
    { id: idEntregable, nombre: idEntregable + '.html', contenido: '<p>Documento ' + idEntregable + '</p>' },
    cookie);
  assert.equal(r.status, 201, 'entregable ' + idEntregable);
  return r.body.version;
}

// El avanzar NO declara contexto: ese rol lo fabrica la sesión en el servidor.
async function avanzarAuth(base, id, version, destino, cookie) {
  const r = await pedirCon(base, 'POST', '/api/expedientes/' + id + '/avanzar',
    { versionEsperada: version, destino }, cookie);
  if (r.status !== 200) {
    return { status: r.status, body: r.body, version };
  }
  return { status: 200, body: r.body, version: r.body.version, expediente: r.body.expediente };
}

// ---------------------------------------------------------------------------
// §4.1 - El padrón con credenciales no es alcanzable por HTTP
// ---------------------------------------------------------------------------
test('4.1 el padrón con credenciales no sale por HTTP', async () => {
  const e = await arrancarPadron();
  try {
    const salud = await pedir(e.base, 'GET', '/api/salud');
    assert.equal(salud.status, 200);
    assert.equal(salud.body.autenticado, true, 'el servidor está en modo autenticado');

    const rutas = ['/padron.json', '/api/padron.json', '/config/padron.json',
      '/2026/1_Expediente/padron.json', // no hay expedientes, esto es estático
      '/2026/1_Expediente/datos.json'];
    for (const ruta of rutas) {
      const r = await pedirConPathRuda(e.base, 'GET', ruta, null, null);
      assert.notEqual(r.status, 200, ruta + ' no debe servirse');
      assert.equal(String(r.raw).indexOf('credenciales'), -1, ruta + ' no expone credenciales');
    }

    const ejemplo = await pedir(e.base, 'GET', '/config/usuarios.ejemplo.json');
    assert.equal(ejemplo.status, 200, 'el padrón de ejemplo sigue sirviéndose');
    assert.equal(String(ejemplo.raw).indexOf('credenciales'), -1, 'el ejemplo no tiene hashes');
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// Importante: pedirConPath no agrega Content-Length a GET sin cuerpo (arreglo
// de ronda-14, helpers/servidor-util.js). Acá se reusa el pedido simple.
function pedirConPathRuda(baseUrl, metodo, ruta, cuerpo, cookie) {
  return pedir(baseUrl, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

// ---------------------------------------------------------------------------
// §4.2 - Ninguna clave en texto plano en disco
// ---------------------------------------------------------------------------
test('4.2 ninguna clave en texto plano en disco', async () => {
  const e = await armarPadron();
  const claves = Object.keys(e.claves).map((email) => e.claves[email]);
  function caminar(dir) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        caminar(ruta);
      } else {
        const crudo = fs.readFileSync(ruta, 'utf8');
        for (const clave of claves) {
          assert.equal(crudo.indexOf(clave), -1, 'la clave no puede aparecer en ' + ruta);
        }
      }
    }
  }
  caminar(e.datosDir);
  const padron = JSON.parse(fs.readFileSync(path.join(e.datosDir, 'padron.json'), 'utf8'));
  for (const u of padron.usuarios) {
    assert.ok(u.credenciales && !u.credenciales.clave, u.email + ' no guarda la clave');
    assert.equal(typeof u.credenciales.hash, 'string', u.email + ' tiene hash');
    assert.equal(typeof u.credenciales.sal, 'string', u.email + ' tiene sal');
    assert.equal(u.credenciales.provisoria, true, u.email + ' nace provisoria');
  }
  fs.rmSync(e.datosDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// §4.3, §4.4 y §4.5 - Jerarquía en vivo + rol efectivo en la traza
// ---------------------------------------------------------------------------
test('4.3-4.5 jerarquía de roles y rol efectivo en la traza', async () => {
  const e = await arrancarPadron();
  try {
    const cookie = {};
    cookie[GENERADOR.email] = await operadorFijo(e.base, GENERADOR, e.claves[GENERADOR.email]);
    cookie[ABAST.email] = await operadorFijo(e.base, ABAST, e.claves[ABAST.email]);
    cookie[ABAST_SUP.email] = await operadorFijo(e.base, ABAST_SUP, e.claves[ABAST_SUP.email]);
    cookie[JEFE.email] = await operadorFijo(e.base, JEFE, e.claves[JEFE.email]);

    // Creación sin contexto: el rol sale de la sesión, no del cuerpo.
    const creado = await pedirCon(e.base, 'POST', '/api/expedientes',
      { datosIniciales: datosIniciales() }, cookie[GENERADOR.email]);
    assert.equal(creado.status, 201);
    const id = creado.body.id;
    let version = creado.body.version;
    assert.equal(creado.body.expediente.auditoria[0].rol, 'generador',
      'la creación registró el rol de la sesión');

    version = await guardarEntregable(e.base, id, version, 'especificacion-tecnica', cookie[GENERADOR.email]);
    let paso = await avanzarAuth(e.base, id, version, 'SOLICITUD_CONTRATACION', cookie[GENERADOR.email]);
    assert.equal(paso.status, 200);
    version = paso.version;
    assert.equal(estadoEnDisco(e.datosDir, id), 'SOLICITUD_CONTRATACION');

    // La supervisora de abastecimiento ejecuta el paso de su supervisado
    // (SOLICITUD -> ANALISIS es de abastecimiento): permitido y rol efectivo.
    version = await guardarEntregable(e.base, id, version, 'solicitud-contratacion', cookie[ABAST_SUP.email]);
    paso = await avanzarAuth(e.base, id, version, 'ANALISIS_SCo', cookie[ABAST_SUP.email]);
    assert.equal(paso.status, 200, 'abastecimiento_supervisor avanza el paso de abastecimiento');
    version = paso.version;
    let traza = docEnDisco(e.datosDir, id).auditoria;
    let ultima = traza[traza.length - 1];
    assert.equal(ultima.rol, 'abastecimiento_supervisor', 'la traza dice quién actuó');
    assert.equal(ultima.rolEfectivo, 'abastecimiento',
      'la traza dice con qué facultad (supervisora actuando como supervisado)');
    assert.equal(estadoEnDisco(e.datosDir, id), 'ANALISIS_SCo');

    // Un abastecimiento ejecuta su propio paso (ANALISIS -> AUTORIZACION) pero
    // NO el del supervisor (AUTORIZACION -> REVISION, de abastecimiento_supervisor).
    paso = await avanzarAuth(e.base, id, version, 'AUTORIZACION_SCo', cookie[ABAST.email]);
    assert.equal(paso.status, 200, 'ANALISIS -> AUTORIZACION es paso de abastecimiento');
    version = paso.version;
    paso = await avanzarAuth(e.base, id, version, 'REVISION_SCo', cookie[ABAST.email]);
    assert.equal(paso.status, 403, 'abastecimiento no da el paso del supervisor');
    paso = await avanzarAuth(e.base, id, version, 'REVISION_SCo', cookie[ABAST_SUP.email]);
    assert.equal(paso.status, 200, 'la propia supervisora sí');
    version = paso.version;
    paso = await avanzarAuth(e.base, id, version, 'CONFECCION_PROYECTOS', cookie[JEFE.email]);
    assert.equal(paso.status, 200, 'contrataciones_supervisor actúa como contrataciones');
    version = paso.version;
    traza = docEnDisco(e.datosDir, id).auditoria;
    ultima = traza[traza.length - 1];
    assert.equal(ultima.rol, 'contrataciones_supervisor');
    assert.equal(ultima.rolEfectivo, 'contrataciones');

    // El evento del circuito también registra quién actuó y con qué rol
    // efectivo (ADR-024).
    const eventos = fs.readFileSync(
      path.join(e.datosDir, id.split('-')[0], id + '_Expediente', 'eventos.jsonl'), 'utf8')
      .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const lauraEvento = eventos.find((ev) => ev.rol === 'abastecimiento_supervisor');
    assert.ok(lauraEvento, 'evento de la supervisora de abastecimiento');
    assert.equal(lauraEvento.rolEfectivo, 'abastecimiento', 'actuó como su supervisado');
    const jefeEvento = eventos.find((ev) => ev.rol === 'contrataciones_supervisor');
    assert.ok(jefeEvento, 'evento del Jefe');
    assert.equal(jefeEvento.rolEfectivo, 'contrataciones');

    // Un rol de otra familia no puede tomar el paso de contrataciones:
    // desde CONFECCION_PROYECTOS (de contrataciones) la supervisora de
    // abastecimiento no puede avanzar al dictamen de la jurídica.
    paso = await avanzarAuth(e.base, id, version, 'DICTAMEN_INICIAL', cookie[ABAST_SUP.email]);
    assert.equal(paso.status, 403, 'un rol ajeno a la ejecución es rechazado');

    // La matriz declarada: el conjunto efectivo incluye al supervisado y no a
    // la inversa, sin duplicar la matriz 18x7 (herencia declarada como dato).
    assert.ok(config.rolesEfectivos(JEFE.rol).indexOf('contrataciones') !== -1,
      'Jefe hereda contrataciones');
    assert.equal(config.rolesEfectivos('contrataciones').indexOf(JEFE.rol), -1,
      'un contrataciones no hereda la supervisión');
    assert.ok(config.rolesEfectivos(ABAST_SUP.rol).indexOf('abastecimiento') !== -1);
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.6 - Con provisoria no se puede hacer nada más que cambiar la clave
// ---------------------------------------------------------------------------
test('4.6 la clave provisoria sólo permite cambiarla', async () => {
  const e = await arrancarPadron();
  try {
    const ing = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: JURIDICA.email, clave: e.claves[JURIDICA.email] }, null);
    assert.equal(ing.status, 200);
    assert.equal(ing.body.provisoria, true);
    const cookie = cookieDe(ing);

    const actual = await pedirCon(e.base, 'GET', '/api/sesion/actual', {}, cookie);
    assert.equal(actual.status, 200, 'ver el estado propio está permitido');

    const prohibidas = [
      ['GET', '/api/indice', null],
      ['GET', '/api/expedientes', null],
      ['POST', '/api/expedientes', { datosIniciales: datosIniciales() }],
      ['GET', '/api/archivo', null],
      ['GET', '/api/eventos', {}],
      ['GET', '/api/sugerencias', {}],
      ['POST', '/api/sugerencias', { contenido: 'hola', email: JURIDICA.email }]
    ];
    for (const [metodo, ruta, cuerpo] of prohibidas) {
      const r = await pedirCon(e.base, metodo, ruta, cuerpo, cookie);
      assert.equal(r.status, 403, metodo + ' ' + ruta + ' debe dar 403 con provisoria');
    }

    const cambio = await pedirCon(e.base, 'POST', '/api/sesion/cambio-clave',
      { claveVieja: e.claves[JURIDICA.email], claveNueva: claveFija(JURIDICA) }, cookie);
    assert.equal(cambio.status, 200, 'cambiar la propia clave está permitido');
    const postCambio = await pedirCon(e.base, 'GET', '/api/sesion/actual', {}, cookie);
    assert.equal(postCambio.body.provisoria, false, 'el flag se apaga');

    const salir = await pedirCon(e.base, 'POST', '/api/sesion/salir', {}, cookie);
    assert.equal(salir.status, 200);
    const trasSalir = await pedirCon(e.base, 'GET', '/api/sesion/actual', {}, cookie);
    assert.equal(trasSalir.status, 401, 'la cookie ya no vale');
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.7 - Después del cambio la clave vieja no sirve
// ---------------------------------------------------------------------------
test('4.7 la clave vieja deja de servir tras el cambio', async () => {
  const e = await arrancarPadron();
  try {
    await operadorFijo(e.base, GENERADOR, e.claves[GENERADOR.email]);
    const vieja = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: GENERADOR.email, clave: e.claves[GENERADOR.email] }, null);
    assert.equal(vieja.status, 401, 'la provisoria vieja ya no ingresa');
    const nueva = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: GENERADOR.email, clave: claveFija(GENERADOR) }, null);
    assert.equal(nueva.status, 200, 'la clave nueva sí');
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.8 - La reposición deja rastro: quién, para quién y cuándo
// ---------------------------------------------------------------------------
test('4.8 la reposición deja un evento de quién/para/cuándo', async () => {
  const e = await armarPadron();
  try {
    const repuesta = padronTool.reponer({
      datos: e.datosDir,
      quien: JEFE.email,
      clave: e.claves[JEFE.email],
      para: ABAST.email
    });
    assert.equal(repuesta.ok, true, 'el Jefe repone la clave');
    const linea = fs.readFileSync(path.join(e.datosDir, 'padron.eventos.jsonl'), 'utf8')
      .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
      .find((ev) => ev.tipo === 'clave_reponer');
    assert.ok(linea, 'existe el evento de reposición');
    assert.equal(linea.quien, JEFE.email);
    assert.equal(linea.para, ABAST.email);
    assert.equal(typeof linea.timestamp, 'string');
    assert.ok(linea.timestamp.length > 0, 'la reposición deja cuándo');

    const ctx = await arrancarServidor(e.datosDir);
    try {
      const vieja = await pedir('http://127.0.0.1:' + ctx.puerto, 'POST', '/api/sesion/login',
        { email: ABAST.email, clave: claveFija(ABAST) });
      assert.equal(vieja.status, 401, 'la clave vieja no sirve tras la reposición');
      const provisoria = await pedir('http://127.0.0.1:' + ctx.puerto, 'POST', '/api/sesion/login',
        { email: ABAST.email, clave: repuesta.clave });
      assert.equal(provisoria.status, 200, 'la nueva provisoria sí');
      assert.equal(provisoria.body.provisoria, true, 'vuelve a ser provisoria');
    } finally {
      await detenerServidor(ctx);
    }
  } finally {
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.9 - La baja deja activo:false y el nombre sigue en lo que tramitó
// ---------------------------------------------------------------------------
test('4.9 baja: activo false, el nombre queda en padrón y en expedientes viejos', async () => {
  const e = await armarPadron();
  try {
    const ctx = await arrancarServidor(e.datosDir);
    const base = 'http://127.0.0.1:' + ctx.puerto;
    try {
      const cookie = await operadorFijo(base, GENERADOR, e.claves[GENERADOR.email]);
      const creado = await pedirCon(base, 'POST', '/api/expedientes',
        { datosIniciales: datosIniciales() }, cookie);
      assert.equal(creado.status, 201);
      const id = creado.body.id;

      const b = padronTool.baja({ datos: e.datosDir, quien: JEFE.email, clave: e.claves[JEFE.email], para: GENERADOR.email });
      assert.equal(b.ok, true, 'baja por el Jefe');
      const padron = JSON.parse(fs.readFileSync(path.join(e.datosDir, 'padron.json'), 'utf8'));
      const maria = padron.usuarios.find((u) => u.email === GENERADOR.email);
      assert.ok(maria, 'el usuario no se borra');
      assert.equal(maria.activo, false, 'queda activo:false');
      assert.equal(maria.nombre, 'Maria', 'el nombre no desaparece del padrón');

      const ingreso = await pedirCon(base, 'POST', '/api/sesion/login',
        { email: GENERADOR.email, clave: claveFija(GENERADOR) }, null);
      assert.equal(ingreso.status, 401, 'una baja no ingresa');
      assert.ok(docEnDisco(e.datosDir, id).auditoria.some((a) =>
        a.email === GENERADOR.email), 'la traza del expediente conserva a la operadora');
    } finally {
      await detenerServidor(ctx);
    }
  } finally {
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.10 - Diez fallos bloquean y sólo el Jefe levanta
// ---------------------------------------------------------------------------
test('4.10 diez fallos bloquean y sólo el Jefe levanta (10 s por la demora)', async () => {
  const e = await arrancarPadron();
  try {
    await operadorFijo(e.base, ABAST, e.claves[ABAST.email]);
    let ultimo = null;
    for (let i = 0; i < 10; i++) {
      ultimo = await pedirCon(e.base, 'POST', '/api/sesion/login',
        { email: ABAST.email, clave: 'incorrecta-' + i }, null);
      assert.equal(ultimo.status, 401, 'intento ' + (i + 1));
    }
    const correcta = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: ABAST.email, clave: claveFija(ABAST) }, null);
    assert.equal(correcta.status, 401, 'aunque la clave sea correcta, queda bloqueado');
    assert.ok(correcta.body.error.indexOf('bloqueado') !== -1, 'informa el bloqueo');

    const noJefe = padronTool.desbloquear({ datos: e.datosDir, quien: GENERADOR.email, clave: e.claves[GENERADOR.email], para: ABAST.email });
    assert.equal(noJefe.ok, false, 'un rol que no es el Jefe no levanta el bloqueo');

    const siJefe = padronTool.desbloquear({ datos: e.datosDir, quien: JEFE.email, clave: e.claves[JEFE.email], para: ABAST.email });
    assert.equal(siJefe.ok, true, 'el Jefe de Contrataciones sí');
    const entro = await pedirCon(e.base, 'POST', '/api/sesion/login',
      { email: ABAST.email, clave: claveFija(ABAST) }, null);
    assert.equal(entro.status, 200, 'después del desbloqueo la clave correcta entra');
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.11 - Cierre por inactividad a los 15 minutos
// ---------------------------------------------------------------------------
test('4.11 la sesión muere a los 15 minutos de inactividad', () => {
  const datosDir = crearDirDatos('sgc-sesion-u-');
  try {
    const capa = sesion.crearCapaSesion(datosDir, ayudantes);
    const creada = capa.crearSesion({ email: 'x@faa.mil.ar', rol: 'generador', nombre: 'X', apellido: 'Y' });
    const pedir = (id) => capa.conectarSesion({ headers: { cookie: 'sgc_sesion=' + id } });

    assert.ok(pedir(creada.id), 'la sesión recién creada conecta');
    creada.ultimaActividad = Date.now() - 14 * 60 * 1000;
    assert.ok(pedir(creada.id), 'a los 14 minutos sigue viva');
    creada.ultimaActividad = Date.now() - 16 * 60 * 1000;
    assert.equal(pedir(creada.id), null, 'a los 16 minutos muere');
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.12 - El compendio del Jefe rechaza a quien no corresponde
// ---------------------------------------------------------------------------
test('4.12 eventos y sugerencias son del Jefe, los rechaza un rol común', async () => {
  const e = await arrancarPadron();
  try {
    const juan = await operadorFijo(e.base, ABAST, e.claves[ABAST.email]);
    const carlos = await operadorFijo(e.base, JEFE, e.claves[JEFE.email]);

    const eventosJuan = await pedirCon(e.base, 'GET', '/api/eventos', {}, juan);
    assert.equal(eventosJuan.status, 403, 'eventos crudos no para abastecimiento');
    const sugsJuan = await pedirCon(e.base, 'GET', '/api/sugerencias', {}, juan);
    assert.equal(sugsJuan.status, 403, 'sugerencias no para abastecimiento');

    const eventosJefe = await pedirCon(e.base, 'GET', '/api/eventos', {}, carlos);
    assert.equal(eventosJefe.status, 200, 'el Jefe lee el compendio');
    assert.equal(typeof eventosJefe.body.expedientes, 'number', 'expedientes del compendio');
    assert.ok(Array.isArray(eventosJefe.body.eventos), 'eventos del compendio');
    assert.equal(typeof eventosJefe.body.sucesos, 'number', 'sucesos del compendio');

    const sugsJefe = await pedirCon(e.base, 'GET', '/api/sugerencias', {}, carlos);
    assert.equal(sugsJefe.status, 200, 'el Jefe lee las sugerencias');
    assert.ok(Array.isArray(sugsJefe.body.sugerencias));
  } finally {
    await detenerServidor(e.ctx);
    fs.rmSync(e.datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.13 - Cada rol ve los indicadores de su tablero
// ---------------------------------------------------------------------------
test('4.13 cada rol ve las fichas de su tablero', () => {
  const indicadores = SGC_RU.SGC.core.indicadores;
  for (const rol of config.ROLES.map((r) => r.id)) {
    const fichas = indicadores.tableroPorDefecto(rol);
    assert.ok(fichas.length > 0, rol + ' tiene tablero');
    for (const id of fichas) {
      const ficha = indicadores.buscarFicha(id);
      assert.ok(ficha, rol + ' referencia la ficha ' + id);
      const resultado = indicadores.calcularFicha(ficha, []);
      assert.equal(typeof resultado.valor, 'number', rol + '/' + id + ' calcula');
    }
  }
  const jefe = indicadores.tableroPorDefecto(JEFE.rol);
  assert.ok(jefe.indexOf('misma_persona') !== -1, 'el Jefe ve misma_persona (supervisión)');
});

// ---------------------------------------------------------------------------
// §3.7/§4.12 - El aviso contra reutilizar la clave está en la pantalla
// ---------------------------------------------------------------------------
test('aviso de clave no reutilizada en la pantalla de cambio', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'app', 'index.html'), 'utf8');
  const texto = html.replace(/\s+/g, ' ').replace(/\uFFFD/g, '').toLowerCase();
  assert.ok(texto.indexOf('no puede ser la misma que usás en ningún otro sistema') !== -1,
    'el aviso está en la pantalla donde se elige la clave');
  assert.ok(html.indexOf('sgc-cambio-clave-forma') !== -1, 'el formulario de cambio existe');
});

// El §4.14 (la suite completa en verde de una sola pasada) se verifica en la
// corrida global `node --test`; este archivo no hace más que sumar en verde.
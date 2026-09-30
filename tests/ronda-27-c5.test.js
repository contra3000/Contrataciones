'use strict';

/*
 * ronda-27-c5.test.js
 * ORDEN-RONDA-27 pieza 5 · un ANEXO I por SCo, con los renglones sumados.
 *
 * Con la pieza 3 la SCo es un registro que sabe qué expedientes la componen y
 * con la pieza 4 esa SCo se mueve junta. Con la pieza 5 el documento también es
 * de la SCo: el ANEXO I deja de ser de cada expediente y pasa al registro, se
 * edita desde cualquiera de sus miembros y el control de concurrencia es la
 * versión del REGISTRO, no la del expediente.
 *
 * Lo que se comprueba acá:
 *  1. dos requerimientos que piden el mismo código dejan UN renglón, con la
 *     cantidad sumada y el desglose de quién pidió qué;
 *  2. sin ANEXO I de la SCo no se sale de ANALISIS_SCo, y el mensaje dice que
 *     se edita desde cualquiera de sus expedientes;
 *  3. guardado, se ve igual desde cualquier miembro, porque es uno solo;
 *  4. la versión que manda es la del registro: si otro operador lo guardó, 409
 *     con su nombre;
 *  5. el ANEXO I de un expediente que ya lo tenía es el punto de partida
 *     cuando la SCo tiene un solo miembro, y con varios no se elige ninguno
 *     detrás de otro.
 *
 * Todo por la API real contra un servidor real, con datos en disco: si el
 * consolidado se calculara en la pantalla, estas pruebas pasarían igual. Los dos
 * últimos casos son del otro lado —la plantilla del documento— porque el ANEXO
 * I también se imprime, y lo que se imprime tiene que salir consolidado.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ti = require('./helpers/transiciones-servidor-util.js');

const RAIZ = path.join(__dirname, '..');
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-1.js'));

const anexoUno = globalThis.SGC.renders.anexoUno;

const SOLICITUD = 'SOLICITUD_CONTRATACION';
const ANALISIS = 'ANALISIS_SCo';
const NUMERO = '14/2026';

// Los mismos dos renglones que trae `datosIniciales` del andamiaje, para que
// los miembros de la SCo compartan un código y se pueda ver la suma. La
// validación de renglones del servidor (ORDEN-RONDA-10 §3.1) corre de verdad.
const COMPARTIDO = { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210' };

function dirDe(datosDir, id) {
  return path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente');
}

function enDisco(datosDir, id) {
  return JSON.parse(fs.readFileSync(path.join(dirDe(datosDir, id), 'datos.json'), 'utf8'));
}

async function leer(base, id) {
  const leido = await ti.pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.status, 200, 'el expediente ' + id + ' se puede leer');
  return leido.body;
}

// El mismo camino que la pantalla: leer, cambiar y PUT con la versión leída.
// El rol por omisión es el que ejecuta SOLICITUD_CONTRATACION, que es donde
// viven los miembros de la SCo: el servidor exige ese rol para escribir ahí.
async function poner(base, id, version, cambios, rol) {
  const leido = await leer(base, id);
  const expediente = leido.expediente;
  cambios(expediente);
  return ti.pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: expediente,
    versionEsperada: version,
    contexto: ti.contexto(rol || 'abastecimiento')
  });
}

async function cargarNumero(base, id, version, numero) {
  const r = await poner(base, id, version, (exp) => {
    if (typeof exp.campos !== 'object' || exp.campos === null) {
      exp.campos = {};
    }
    exp.campos.numeroSCo = numero;
  }, 'abastecimiento');
  assert.equal(r.status, 200, 'el expediente ' + id + ' carga el número de SCo: ' + JSON.stringify(r.body));
  return r.body.version;
}

// Un expediente con UN renglón propio, para ver el desglose. Va en el camino
// que la pantalla usaría: se crea, se le pone el número de SCo y después se
// cambia el renglón.
async function miembro(base, datosDir, numero, renglones) {
  const e = await ti.crearEnEstado(base, datosDir, SOLICITUD, assert);
  const conNumero = await cargarNumero(base, e.id, e.version, numero);
  if (Array.isArray(renglones) && renglones.length > 0) {
    const r = await poner(base, e.id, conNumero, (exp) => {
      exp.renglones = renglones;
    }, 'abastecimiento');
    assert.equal(r.status, 200, 'se cargan los renglones de ' + e.id + ': ' + JSON.stringify(r.body));
    return { id: e.id, version: r.body.version };
  }
  return { id: e.id, version: conNumero };
}

async function leerSco(base, numero) {
  return ti.pedir(base, 'GET', '/api/sco/' + encodeURIComponent(numero));
}

async function guardarAnexo1(base, numero, anexo1, versionEsperada, rol) {
  return ti.pedir(base, 'PUT', '/api/sco/' + encodeURIComponent(numero) + '/anexo1', {
    anexo1: anexo1,
    versionEsperada: versionEsperada,
    contexto: ti.contexto(rol || 'abastecimiento')
  });
}

async function avanzar(base, id, destino, rol) {
  const leido = await leer(base, id);
  return ti.pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
    versionEsperada: leido.version,
    destino: destino,
    contexto: ti.contexto(rol)
  });
}

async function renglonDe(renglones, codigo) {
  for (const r of renglones) {
    if (r.codigo === codigo) {
      return r;
    }
  }
  return null;
}

let ENTORNO = null;

test.beforeEach(async () => {
  ENTORNO = await ti.arrancarEntorno();
});

test.afterEach(async () => {
  if (ENTORNO) {
    await ti.limpiarEntorno(ENTORNO);
    ENTORNO = null;
  }
});

test('RONDA-27 pieza 5 · el mismo código de dos requerimientos es un solo renglón, sumado y con desglose', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const b = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO,
    [COMPARTIDO, { codigo: '2.1.1-439.103', cantidad: 1, unidad: 'UN', rubro: '4210' }]);

  const r = await leerSco(ENTORNO.base, NUMERO);
  assert.equal(r.status, 200, 'se lee el registro de la SCo: ' + JSON.stringify(r.body));
  assert.equal(r.body.registro.expedientes.length, 2, 'la SCo tiene los dos expedientes');

  const renglones = r.body.renglones;
  assert.equal(renglones.length, 2,
    'el código repetido colapsa en un renglón y el que no se repite queda aparte: ' + JSON.stringify(renglones));

  const repetido = await renglonDe(renglones, COMPARTIDO.codigo);
  assert.ok(repetido, 'el código compartido está en el consolidado');
  assert.equal(repetido.cantidad, 4,
    'la cantidad está SUMADA: 2 del primero y 2 del segundo');
  assert.equal(repetido.unidad, 'UN', 'y conserva la unidad');
  assert.equal(repetido.desglose.length, 2, 'el desglose trae una parte por expediente');
  assert.deepEqual(repetido.desglose.map((d) => d.cantidad).sort(), [2, 2],
    'cada parte dice cuánto pidió cada expediente');
  const desgloseDe = repetido.desglose.map((d) => d.expediente).sort();
  assert.deepEqual(desgloseDe, [a.id, b.id].sort(),
    'y se sabe de qué expediente salió cada parte, que es lo que pedía la ronda');

  const propio = await renglonDe(renglones, '2.1.1-439.103');
  assert.equal(propio.cantidad, 1, 'el código que pide uno solo no se suma con nadie');
  assert.equal(propio.desglose.length, 1, 'y su desglose tiene una sola parte');
  assert.equal(propio.desglose[0].expediente, b.id, 'que es el expediente que lo pidió');
});

test('RONDA-27 pieza 5 · sin ANEXO I de la SCo no se sale de ANALISIS_SCo, y el mensaje dice dónde se hace', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const b = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const r0 = await avanzar(ENTORNO.base, a.id, ANALISIS, 'abastecimiento');
  assert.equal(r0.status, 200, 'la SCo entra a ANALISIS_SCo');

  const r = await avanzar(ENTORNO.base, a.id, 'AUTORIZACION_SCo', 'abastecimiento');
  assert.equal(r.status, 409, 'sin ANEXO I de la SCo no se avanza: ' + JSON.stringify(r.body));
  assert.match(r.body.error, /falta el ANEXO I de la SCo/,
    'el mensaje dice qué falta, con la palabra de la ronda');
  assert.ok(r.body.error.indexOf(a.id) !== -1 && r.body.error.indexOf(b.id) !== -1,
    'y dice que se edita desde cualquiera de sus expedientes, nombrándolos');
  assert.equal(r.body.sco.numeroSCo, NUMERO, 'además manda de qué SCo es');
  assert.equal(r.body.sco.faltaAnexo1, true, 'y que lo que falta es su ANEXO I');

  for (const id of [a.id, b.id]) {
    assert.equal((await leer(ENTORNO.base, id)).expediente.estado.id, ANALISIS,
      id + ' sigue en ANALISIS_SCo: no se movió nadie');
  }
});

test('RONDA-27 pieza 5 · guardado desde un miembro, es el mismo ANEXO I para todos', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const b = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  await avanzar(ENTORNO.base, a.id, ANALISIS, 'abastecimiento');

  const version = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;
  const anexo1 = {
    objeto: 'Adquisición de resmas A4',
    justificacion: 'Reposición de insumos de oficina',
    requisitosMinimos: 'Resma A4 de 500 hojas'
  };
  // Se guarda desde el SEGUNDO miembro: el ANEXO I es de la SCo, así que da
  // igual cuál de los dos esté abierto.
  const g = await guardarAnexo1(ENTORNO.base, NUMERO, anexo1, version);
  assert.equal(g.status, 200, 'se guarda el ANEXO I de la SCo: ' + JSON.stringify(g.body));
  assert.equal(g.body.registro.version, version + 1, 'la versión del REGISTRO es la que sube');
  assert.deepEqual(g.body.registro.anexo1, anexo1, 'y queda en el registro de la SCo');
  assert.equal(g.body.renglones.length, 1, 'el guardado devuelve el consolidado');

  // Desde cualquier expediente se lee lo mismo, y con origen 'sco'.
  for (const id of [a.id, b.id]) {
    const leido = await leerSco(ENTORNO.base, NUMERO);
    assert.deepEqual(leido.body.anexo1, anexo1, 'desde ' + id + ' se ve el ANEXO I de la SCo');
    assert.equal(leido.body.anexo1Origen, 'sco', 'y sabe que es de la SCo, no del expediente');
    assert.equal(leido.body.anexo1PuntoDePartida, null, 'con origen de SCo no hay punto de partida');
  }

  // Ahora sí se sale de ANALISIS_SCo, y sale la SCo entera.
  const r = await avanzar(ENTORNO.base, b.id, 'AUTORIZACION_SCo', 'abastecimiento');
  assert.equal(r.status, 200, 'con el ANEXO I de la SCo guardado, la SCo avanza: ' + JSON.stringify(r.body));
  assert.equal((await leer(ENTORNO.base, a.id)).expediente.estado.id, 'AUTORIZACION_SCo',
    'y el otro miembro avanzó con ella');
});

test('RONDA-27 pieza 5 · lo que manda es la versión del registro: si otro lo guardó, 409 con su nombre', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const b = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);

  const versionInicial = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;

  // Un operador guarda con la versión que leyó.
  const primero = await guardarAnexo1(ENTORNO.base, NUMERO, { objeto: 'Borrador de A' },
    versionInicial, 'abastecimiento');
  assert.equal(primero.status, 200, 'el primero guarda');

  // El segundo tenía la misma versión en pantalla: su escritura está vieja.
  const segundo = await guardarAnexo1(ENTORNO.base, NUMERO, { objeto: 'Borrador de B' },
    versionInicial, 'abastecimiento_supervisor');
  assert.equal(segundo.status, 409, 'el segundo no pisa lo del primero: ' + JSON.stringify(segundo.body));
  assert.equal(segundo.body.conflicto, true, 'el 409 viene marcado como conflicto');
  assert.equal(segundo.body.versionRemota, versionInicial + 1,
    'y dice en qué versión quedó el registro');
  assert.equal(segundo.body.ultimoUsuario, 'juan.perez@faa.mil.ar',
    'y quién lo cambió, para distinguir "lo cambió otro" de "lo cambiaste vos"');

  const leido = await leerSco(ENTORNO.base, NUMERO);
  assert.equal(leido.body.anexo1.objeto, 'Borrador de A',
    'lo que quedó es lo del primero: el segundo no escribió nada');
  assert.equal(leido.body.registro.version, versionInicial + 1,
    'y la versión del registro no se movió por el intento fallido');

  // Con la versión al día, el segundo sí puede.
  const tercero = await guardarAnexo1(ENTORNO.base, NUMERO, { objeto: 'Borrador de B' },
    leido.body.registro.version, 'abastecimiento_supervisor');
  assert.equal(tercero.status, 200, 'con la versión al día se guarda');
  assert.equal(tercero.body.registro.anexo1.objeto, 'Borrador de B', 'y ahora sí es el suyo');
  assert.ok(a.id && b.id, 'los dos expedientes son los que se usan; el registro es el que decide');
});

test('RONDA-27 pieza 5 · con un solo miembro, su ANEXO I es el punto de partida; con varios, no se elige', async () => {
  // SCo de un solo expediente, con ANEXO I propio: sirve de punto de partida.
  const solo = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const conAnexo1 = await poner(ENTORNO.base, solo.id, solo.version, (exp) => {
    exp.anexo1 = { objeto: 'Análisis de la oficina que ya lo tenía' };
  });
  assert.equal(conAnexo1.status, 200, 'el expediente único guarda su ANEXO I propio');

  let leido = await leerSco(ENTORNO.base, NUMERO);
  assert.equal(leido.body.anexo1Origen, 'migracion',
    'la SCo no tiene ANEXO I todavía, así que el del expediente hace de punto de partida');
  assert.equal(leido.body.anexo1PuntoDePartida, solo.id, 'y dice de cuál expediente salió');
  assert.deepEqual(leido.body.anexos1Propios, [solo.id], 'con la lista de quienes lo tenían propio');
  assert.equal(leido.body.anexo1.objeto, 'Análisis de la oficina que ya lo tenía',
    'y se puede editar sobre lo que había');

  // Al guardar, deja de ser punto de partida: ahora es de la SCo.
  const g = await guardarAnexo1(ENTORNO.base, NUMERO,
    { objeto: 'Análisis de la SCo, ya consultado' }, leido.body.registro.version);
  assert.equal(g.status, 200, 'se guarda el ANEXO I de la SCo');
  leido = await leerSco(ENTORNO.base, NUMERO);
  assert.equal(leido.body.anexo1Origen, 'sco', 'después de guardar, es de la SCo');
  assert.equal(leido.body.anexo1PuntoDePartida, null, 'y no queda más como punto de partida');

  // SCo de dos, los dos con ANEXO I propio: no se elige uno detrás de otro.
  const dos = await miembro(ENTORNO.base, ENTORNO.datosDir, '15/2026', [COMPARTIDO]);
  const otro = await miembro(ENTORNO.base, ENTORNO.datosDir, '15/2026', [COMPARTIDO]);
  for (const m of [dos, otro]) {
    const r = await poner(ENTORNO.base, m.id, m.version, (exp) => {
      exp.anexo1 = { objeto: 'Análisis propio de ' + m.id };
    });
    assert.equal(r.status, 200, 'cada uno guarda su ANEXO I propio');
  }
  leido = await leerSco(ENTORNO.base, '15/2026');
  assert.equal(leido.body.anexo1, null,
    'con dos ANEXO I propios no se elige ninguno: la pantalla avisa y el informe lo decide');
  assert.equal(leido.body.anexo1Origen, 'vacio', 'el origen dice que está vacío');
  assert.deepEqual(leido.body.anexos1Propios.slice().sort(), [dos.id, otro.id].sort(),
    'pero se ven los dos, para que la decisión sea informada y no a ciegas');
});

test('RONDA-27 pieza 5 · guardar el ANEXO I se cruza contra el padrón y deja anotado quién lo guardó', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const version = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;

  // ADR-021: el rol no se lo elige el cliente. Un correo que no está en el
  // padrón no escribe, y un rol que no es el de ese correo tampoco.
  const desconocido = await ti.pedir(ENTORNO.base, 'PUT',
    '/api/sco/' + encodeURIComponent(NUMERO) + '/anexo1', {
      anexo1: { objeto: 'x' },
      versionEsperada: version,
      contexto: {
        timestamp: '2026-08-18T10:00:00.000Z',
        email: 'nadie@faa.mil.ar',
        rol: 'abastecimiento',
        equipo: 'PC-ATAQUE-01'
      }
    });
  assert.equal(desconocido.status, 403, 'un correo fuera del padrón es rechazado');
  assert.match(desconocido.body.error, /no est. en el padr.n/, 'y se lo dice');

  const rolPrestado = await ti.pedir(ENTORNO.base, 'PUT',
    '/api/sco/' + encodeURIComponent(NUMERO) + '/anexo1', {
      anexo1: { objeto: 'x' },
      versionEsperada: version,
      contexto: {
        timestamp: '2026-08-18T10:00:00.000Z',
        email: 'juan.perez@faa.mil.ar',
        rol: 'juridica',
        equipo: 'PC-ATAQUE-01'
      }
    });
  assert.equal(rolPrestado.status, 403, 'un rol que no es el del correo tampoco puede escribir');
  assert.match(rolPrestado.body.error, /no corresponde al correo/,
    'y el mensaje dice que el rol no corresponde, sin mencionar el id');

  const ok = await guardarAnexo1(ENTORNO.base, NUMERO, { objeto: 'Análisis guardado' }, version);
  assert.equal(ok.status, 200, 'con el rol que corresponde se guarda');

  const registro = ok.body.registro;
  const ultima = registro.auditoria[registro.auditoria.length - 1];
  assert.equal(ultima.accion, 'guardarAnexo1', 'la auditoría del REGISTRO lo anota');
  assert.equal(ultima.email, 'juan.perez@faa.mil.ar', 'con quién lo guardó');
  assert.equal(ultima.rol, 'abastecimiento', 'y con qué rol');
  assert.equal(registro.actualizadoPor, 'juan.perez@faa.mil.ar',
    'el registro recuerda quién escribió la última versión, como el expediente (ADR-042)');

  // El expediente NO lleva copia del ANEXO I: el documento es de la SCo, para
  // que dos requerimientos de la misma SCo no puedan tener dos ANEXO I.
  const expediente = enDisco(ENTORNO.datosDir, a.id);
  assert.equal(expediente.anexo1, undefined,
    'el ANEXO I de la SCo no se copia a los expedientes: vive en el registro');
  assert.ok(a.id, 'el expediente que se usó es ' + a.id);
});

test('RONDA-27 pieza 5 · el ANEXO I de la SCo se guarda contra la versión del registro, no la del expediente', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const registro = (await leerSco(ENTORNO.base, NUMERO)).body.registro;
  const versionExpediente = (await leer(ENTORNO.base, a.id)).version;
  assert.notEqual(registro.version, versionExpediente,
    'las dos versiones son distintas, así que mandar la del expediente se nota');

  const conLaDelExpediente = await guardarAnexo1(ENTORNO.base, NUMERO, { objeto: 'x' },
    versionExpediente);
  assert.equal(conLaDelExpediente.status, 409,
    'con la versión del expediente no se guarda: la que cuenta es la del registro');
  assert.equal(conLaDelExpediente.body.versionRemota, registro.version,
    'y el 409 dice la versión del registro, que es la que hay que volver a leer');
});

test('RONDA-27 pieza 5 · una SCo que no existe no tiene ANEXO I que editar', async () => {
  const r = await leerSco(ENTORNO.base, '99/2026');
  assert.equal(r.status, 404, 'no hay registro de esa SCo');
  const g = await guardarAnexo1(ENTORNO.base, '99/2026', { objeto: 'x' }, 1);
  assert.equal(g.status, 404, 'ni se puede guardar un ANEXO I de una SCo que no existe');
  assert.match(g.body.error, /no existe una SCo/, 'y lo dice');
});

// ---------------------------------------------------------------------------
// "Se guarda como entregable de la SCo": el documento va a la carpeta de la SCo
// ---------------------------------------------------------------------------

async function guardarDocumento(base, numero, nombre, contenido, versionEsperada, id, rol) {
  return ti.pedir(base, 'POST', '/api/sco/' + encodeURIComponent(numero) + '/entregables', {
    nombre: nombre,
    contenido: contenido,
    versionEsperada: versionEsperada,
    id: id === undefined ? null : id,
    contexto: ti.contexto(rol || 'abastecimiento')
  });
}

test('RONDA-27 pieza 5 · el documento del ANEXO I se guarda en la carpeta de la SCo, no en la del expediente', async () => {
  const a = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const b = await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const version = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;

  const g = await guardarDocumento(ENTORNO.base, NUMERO, 'anexo-1.html',
    '<html><body>ANEXO I de la SCo ' + NUMERO + '</body></html>', version, 'anexo-1');
  assert.equal(g.status, 201, 'se guarda el documento de la SCo: ' + JSON.stringify(g.body));
  assert.equal(g.body.ruta, 'entregables/anexo-1.html', 'con la ruta dentro de la SCo');
  assert.equal(g.body.version, version + 1, 'y sube la versión del REGISTRO');

  // El archivo está en la carpeta de la SCo, junto al registro.
  const carpeta = path.join(ENTORNO.datosDir, 'sco', '2026', '14_2026', 'entregables');
  const archivo = path.join(carpeta, 'anexo-1.html');
  assert.ok(fs.existsSync(archivo), 'el archivo existe en datos/sco/2026/14_2026/entregables');
  assert.ok(fs.readFileSync(archivo, 'utf8').includes('ANEXO I de la SCo ' + NUMERO),
    'con el contenido que se envió');

  // Y NO está en la carpeta de ninguno de los dos expedientes: el documento es
  // de la SCo entera, no de un requerimiento.
  for (const m of [a, b]) {
    const enExpediente = path.join(dirDe(ENTORNO.datosDir, m.id), 'entregables', 'anexo-1.html');
    assert.equal(fs.existsSync(enExpediente), false,
      m.id + ' NO tiene su propio anexo-1.html: el documento es de la SCo');
  }

  // Queda anotado en el registro, con quién lo guardó.
  const registro = (await leerSco(ENTORNO.base, NUMERO)).body.registro;
  assert.equal(registro.entregables.length, 1, 'el registro lista un entregable');
  assert.equal(registro.entregables[0].nombre, 'anexo-1.html', 'con su nombre');
  assert.equal(registro.entregables[0].id, 'anexo-1', 'y con el id del catálogo');
  assert.equal(registro.entregables[0].ruta, 'entregables/anexo-1.html', 'y su ruta');
  assert.equal(registro.entregables[0].email, 'juan.perez@faa.mil.ar', 'con quién lo guardó');
  const ultima = registro.auditoria[registro.auditoria.length - 1];
  assert.equal(ultima.accion, 'guardarEntregable', 'la auditoría lo anota');
  assert.equal(ultima.entregable, 'anexo-1.html', 'diciendo qué documento es');
  assert.equal(ultima.deLaSCo, true, 'y que es de la SCo, no del expediente');
});

test('RONDA-27 pieza 5 · el documento de la SCo se abre por su ruta y se vuelve a guardar en el lugar', async () => {
  await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  let version = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;

  const primero = await guardarDocumento(ENTORNO.base, NUMERO, 'anexo-1.html', '<p>primero</p>',
    version, 'anexo-1');
  assert.equal(primero.status, 201, 'se guarda la primera vez');

  // El mismo nombre dos veces NO deja dos entradas: se actualiza en el lugar.
  version = primero.body.version;
  const segundo = await guardarDocumento(ENTORNO.base, NUMERO, 'anexo-1.html', '<p>segundo</p>',
    version, 'anexo-1');
  assert.equal(segundo.status, 201, 'se vuelve a guardar');
  const registro = (await leerSco(ENTORNO.base, NUMERO)).body.registro;
  assert.equal(registro.entregables.length, 1,
    'sigue habiendo un solo entregable, no dos del mismo documento');
  assert.equal(registro.entregables[0].guardado, '2026-08-18T10:00:00.000Z',
    'y es el último que se guardó');

  // Y se lee por la ruta que lo guardó (ADR-016: el generado se abre después).
  // `pedir` deja en `raw` lo que no es JSON, que es justo el HTML del documento.
  const leido = await ti.pedir(ENTORNO.base, 'GET',
    '/api/sco/' + encodeURIComponent(NUMERO) + '/entregables/anexo-1.html');
  assert.equal(leido.status, 200, 'el documento se abre desde la SCo');
  assert.match(String(leido.raw), /<p>segundo<\/p>/, 'y es el último, no el primero');

  const inexistente = await ti.pedir(ENTORNO.base, 'GET',
    '/api/sco/' + encodeURIComponent(NUMERO) + '/entregables/planilla.html');
  assert.equal(inexistente.status, 404, 'un documento que no se guardó no aparece');
});

test('RONDA-27 pieza 5 · el documento de la SCo va contra la versión del registro y no acepta rutas', async () => {
  await miembro(ENTORNO.base, ENTORNO.datosDir, NUMERO, [COMPARTIDO]);
  const version = (await leerSco(ENTORNO.base, NUMERO)).body.registro.version;

  const viejo = await guardarDocumento(ENTORNO.base, NUMERO, 'anexo-1.html', '<p>x</p>',
    version - 1, 'anexo-1');
  assert.equal(viejo.status, 409, 'con la versión vieja no se guarda el documento');
  assert.equal(viejo.body.versionRemota, version, 'y el 409 dice la versión del registro');

  const ruta = await guardarDocumento(ENTORNO.base, NUMERO, '../datos.json', '{}', version);
  assert.equal(ruta.status, 400, 'un nombre con recorrido de rutas se rechaza');
  assert.match(ruta.body.error, /nombre del entregable no es v.lido/);

  const idFalso = await guardarDocumento(ENTORNO.base, NUMERO, 'otro.html', 'x', version, 'no-existe');
  assert.equal(idFalso.status, 400, 'un id que no está en el catálogo se rechaza');
  assert.match(idFalso.body.error, /no existe en el cat.logo/);

  const sinContexto = await ti.pedir(ENTORNO.base, 'POST',
    '/api/sco/' + encodeURIComponent(NUMERO) + '/entregables', {
      nombre: 'anexo-1.html',
      contenido: 'x',
      versionEsperada: version
    });
  assert.equal(sinContexto.status, 400, 'sin contexto no se guarda: el servidor no adivina quién es');

  const registro = (await leerSco(ENTORNO.base, NUMERO)).body.registro;
  assert.equal(registro.version, version, 'ninguno de los rechazos movió la versión del registro');
  assert.deepEqual(registro.entregables, [], 'ni dejó entregables a medio escribir');
});

// ---------------------------------------------------------------------------
// La plantilla del documento
// ---------------------------------------------------------------------------

// Un expediente con el registro de la SCo colgado en `datos.anexo1Sco`, que es
// lo que hace `views/anexo-uno.js` cuando llega el registro por la red.
function expedienteDeSco(numeroSCo, anexo1, renglones) {
  return {
    datos: {
      titulo: 'Adquisición de resmas A4',
      identificacion: { numero: '7' },
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', aclaracion: '' }],
      anexo1: { objeto: 'Análisis viejo, del expediente' },
      anexo1Sco: {
        numeroSCo: numeroSCo,
        anexo1: anexo1,
        renglones: renglones
      }
    }
  };
}

const CONSOLIDADO = [
  {
    codigo: '2.1.1-439.102',
    cantidad: 4,
    unidad: 'UN',
    desglose: [
      { expediente: '2026-001', cantidad: 2 },
      { expediente: '2026-007', cantidad: 2 }
    ]
  }
];

test('RONDA-27 pieza 5 · el documento impreso sale con un renglón sumado y su desglose', () => {
  const html = anexoUno.componer(expedienteDeSco('14/2026', { objeto: 'Análisis de la SCo' }, CONSOLIDADO));

  assert.ok(html.includes('14/2026'), 'el documento dice de qué SCo es');
  assert.ok(html.includes('Renglones de la SCo'), 'y trae la tabla de renglones de la SCo');
  assert.ok(html.includes('2.1.1-439.102'), 'con el código del catálogo');
  assert.ok(html.includes('2026-001: 2 · 2026-007: 2'),
    'y el desglose dice cuánto pidió cada expediente, que es lo que pedía la ronda');
  assert.ok(html.includes('Análisis de la SCo'), 'el objeto es el del ANEXO I de la SCo');
  assert.ok(!html.includes('Análisis viejo, del expediente'),
    'y no el del expediente que se está mirando: el documento es de la SCo');
});

test('RONDA-27 pieza 5 · sin SCo, el documento sigue siendo el del expediente, sin tabla de SCo', () => {
  const expediente = {
    datos: {
      titulo: 'Adquisición de resmas A4',
      identificacion: { numero: '7' },
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', aclaracion: 'Resma' }],
      anexo1: { objeto: 'Análisis del expediente' }
    }
  };
  const html = anexoUno.componer(expediente);
  assert.ok(html.includes('Análisis del expediente'), 'el objeto es el propio');
  assert.ok(!html.includes('Renglones de la SCo'),
    'y no aparece la tabla de la SCo: sin SCo el documento es el de siempre');
  assert.ok(!html.includes('Desglose por expediente'),
    'ni la columna de desglose, que sólo tiene sentido con varios requerimientos');
});

test('RONDA-27 pieza 5 · la tabla del documento escapa los textos, no los interpola', () => {
  // El payload va en el código y en la unidad, que la tabla también escapa con
  // el mismo `esc`: la celda de la descripción no se puede usar para esto porque
  // su texto es el del ítem del catálogo (ORDEN-RONDA-25 §5.2), no uno de prueba.
  const malicious = [{
    codigo: '<script>alert(1)</script>',
    unidad: 'UN & "A4"',
    cantidad: 1,
    desglose: [{ expediente: '2026-001', cantidad: 1 }]
  }];
  const html = anexoUno.componer(expedienteDeSco('14/2026', { objeto: 'x' }, malicious));
  assert.ok(!html.includes('<script>'), 'el texto del renglón no se vuelve una etiqueta');
  assert.ok(html.includes('&lt;script&gt;'), 'sino texto escapado');
  assert.ok(html.includes('UN &amp; &quot;A4&quot;'), 'con el ampersand y las comillas escapados también');
});

'use strict';

/*
 * respaldo.test.js
 * ORDEN-RONDA-08 §2.3: respaldo y restauración de la carpeta de datos.
 *
 *  - Ciclo completo: crearRespaldo copia la carpeta entera bajo
 *    <destino>/sgc-respaldo-<fecha>.<hora> y restaurarRespaldo la vuelca en
 *    otro destino con el mismo contenido.
 *  - Retención: podar conserva los N respaldos más nuevos y borra los viejos;
 *    con retener <= 0 no borra nada.
 *  - Escritura concurrente: dos procesos tools/respaldo.js simultáneos contra
 *    el mismo destino terminan bien, dejan dos respaldos completos, no dejan
 *    temporales y liberan el lock.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const util = require('node:util');

const RAIZ = path.join(__dirname, '..');

const ayudantes = require(path.join(RAIZ, 'tools', 'ayudantes-respaldo.js'));
const respaldo = require(path.join(RAIZ, 'tools', 'respaldo.js'));
const restaurar = require(path.join(RAIZ, 'tools', 'restaurar.js'));

const NODE = process.execPath;
const RESPALDO_CLI = path.join(RAIZ, 'tools', 'respaldo.js');
const execFileP = util.promisify(execFile);

function datosDePrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-datos-'));
  fs.mkdirSync(path.join(dir, '2026', '001_Expediente', 'hist'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'idx'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'contador.json'), '{"ultimo":1}');
  fs.writeFileSync(path.join(dir, 'idx', '2026-001.json'),
    '{"id":"2026-001","estado":"SOLICITUD_CONTRATACION"}');
  const conCadena = {
    id: '2026-001',
    version: 2,
    auditoria: [
      { accion: 'crear', hash: 'a'.repeat(64), hashPrevio: null },
      { accion: 'avanzar', hash: 'b'.repeat(64), hashPrevio: 'a'.repeat(64) }
    ]
  };
  fs.writeFileSync(path.join(dir, '2026', '001_Expediente', 'datos.json'),
    JSON.stringify(conCadena));
  fs.writeFileSync(path.join(dir, '2026', '001_Expediente', 'hist', 'v1.json'), '{"v":1}');
  return dir;
}

function listarBackups(destino) {
  return fs.readdirSync(destino, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('sgc-respaldo-'))
    .map((e) => e.name);
}

test('ciclo completo: respaldo copia todo y restaurar lo vuelca idéntico', () => {
  const datos = datosDePrueba();
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-destino-'));
  const destino2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-restaurado-'));

  const informe = respaldo.crear(datos, destino, 14);
  assert.ok(fs.existsSync(informe.ruta), 'el respaldo queda en disco');
  assert.ok(listarBackups(destino).length === 1, 'hay un solo respaldo');

  const origen = informe.ruta;
  assert.ok(fs.existsSync(path.join(origen, 'contador.json')), 'la raíz se respalda');
  assert.ok(fs.existsSync(path.join(origen, '2026', '001_Expediente', 'datos.json')),
    'la carpeta del expediente se respalda');

  restaurar.restaurar(origen, destino2);
  assert.equal(fs.readFileSync(path.join(destino2, 'contador.json'), 'utf8'),
    fs.readFileSync(path.join(datos, 'contador.json'), 'utf8'), 'contador idéntico');
  const restaurado = JSON.parse(fs.readFileSync(path.join(destino2, '2026', '001_Expediente', 'datos.json'), 'utf8'));
  const original = JSON.parse(fs.readFileSync(path.join(datos, '2026', '001_Expediente', 'datos.json'), 'utf8'));
  assert.deepEqual(restaurado, original, 'datos.json idéntico');
  assert.deepEqual(restaurado.auditoria, original.auditoria,
    'la cadena de auditoría vuelve íntegra tras restaurar');
  assert.equal(restaurado.auditoria[1].hashPrevio, restaurado.auditoria[0].hash,
    'el encadenado de hashes se conserva');

  fs.rmSync(datos, { recursive: true, force: true });
  fs.rmSync(destino, { recursive: true, force: true });
  fs.rmSync(destino2, { recursive: true, force: true });
});

test('la restauración valida el respaldo y aborta sin tocar el destino si está corrupto', () => {
  const datos = datosDePrueba();
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-corrupto-'));
  const destino2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-destino2-'));
  const informe = respaldo.crear(datos, destino, 14);

  // Faltan contador.json: se aborta y el destino queda vacío.
  fs.rmSync(path.join(informe.ruta, 'contador.json'));
  assert.throws(() => restaurar.restaurar(informe.ruta, destino2), /falta contador\.json/);
  assert.equal(fs.readdirSync(destino2).length, 0, 'el destino no se toca');

  // Falta idx/.
  fs.writeFileSync(path.join(informe.ruta, 'contador.json'), '{"ultimo":1}');
  fs.rmSync(path.join(informe.ruta, 'idx'), { recursive: true });
  assert.throws(() => restaurar.restaurar(informe.ruta, destino2), /falta la carpeta idx/);
  assert.equal(fs.readdirSync(destino2).length, 0, 'el destino no se toca');

  // Un JSON truncado no parsea: se aborta y el destino no se toca.
  fs.mkdirSync(path.join(informe.ruta, 'idx'));
  fs.writeFileSync(path.join(informe.ruta, '2026', '001_Expediente', 'datos.json'), '{"id":');
  assert.throws(() => restaurar.restaurar(informe.ruta, destino2), /no parsea/);
  assert.equal(fs.readdirSync(destino2).length, 0, 'el destino no se toca');

  fs.rmSync(datos, { recursive: true, force: true });
  fs.rmSync(destino, { recursive: true, force: true });
  fs.rmSync(destino2, { recursive: true, force: true });
});

test('la restauración lista los archivos del destino que no estaban en el respaldo', () => {
  const datos = datosDePrueba();
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-huerfanos-'));
  const destino2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-destino3-'));
  const informe = respaldo.crear(datos, destino, 14);

  // El destino tiene datos activos ajenos al respaldo: quedan mezclados.
  fs.mkdirSync(path.join(destino2, '2026', '999_Expediente'), { recursive: true });
  fs.writeFileSync(path.join(destino2, '2026', '999_Expediente', 'datos.json'), '{"id":"2026-999"}');
  fs.writeFileSync(path.join(destino2, 'notas.txt'), 'apunte del operador');

  const resultado = restaurar.restaurar(informe.ruta, destino2);
  const huerfanos = resultado.huerfanos.map((p) => p.split(path.sep).join('/'));
  assert.deepEqual(huerfanos,
    ['2026/999_Expediente/datos.json', 'notas.txt'],
    'los huérfanos son los archivos del destino que no trae el respaldo');
  assert.ok(fs.existsSync(path.join(destino2, '2026', '999_Expediente', 'datos.json')),
    'el huérfano sigue en el destino tras restaurar');
  assert.ok(fs.existsSync(path.join(destino2, 'notas.txt')), 'el huérfano suelto sigue');
  assert.ok(fs.existsSync(path.join(destino2, 'contador.json')), 'lo restaurado está');

  fs.rmSync(datos, { recursive: true, force: true });
  fs.rmSync(destino, { recursive: true, force: true });
  fs.rmSync(destino2, { recursive: true, force: true });
});

test('retención: podar conserva los N más nuevos y con 0 no borra nada', () => {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-poda-'));
  const nombres = [
    'sgc-respaldo-2026-08-19.000001',
    'sgc-respaldo-2026-08-19.000002',
    'sgc-respaldo-2026-08-19.000003'
  ];
  for (const nombre of nombres) {
    fs.mkdirSync(path.join(destino, nombre));
  }

  assert.deepEqual(ayudantes.listarRespaldos(destino), nombres.slice().reverse(),
    'la lista va del más nuevo al más viejo');
  assert.equal(ayudantes.esRespaldo('sgc-respaldo-2026-08-19.000002'), true);
  assert.equal(ayudantes.esRespaldo('otra-carpeta'), false);

  const retenidos = ayudantes.podar(destino, 2);
  assert.deepEqual(retenidos, ['sgc-respaldo-2026-08-19.000003', 'sgc-respaldo-2026-08-19.000002']);
  assert.ok(!fs.existsSync(path.join(destino, 'sgc-respaldo-2026-08-19.000001')),
    'el más viejo se borra');

  fs.mkdirSync(path.join(destino, 'sgc-respaldo-2026-08-19.000004'));
  ayudantes.podar(destino, 0);
  assert.equal(listarBackups(destino).length, 3, 'con 0 no se borra nada');

  fs.rmSync(destino, { recursive: true, force: true });
});

test('escritura concurrente: dos respaldos simultáneos no se pisan', async () => {
  const datos = datosDePrueba();
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-respaldo-concurrente-'));

  const [a, b] = await Promise.all([
    execFileP(NODE, [RESPALDO_CLI, '--datos', datos, '--destino', destino]),
    execFileP(NODE, [RESPALDO_CLI, '--datos', datos, '--destino', destino])
  ]);
  assert.equal(a.stderr, '');
  assert.equal(b.stderr, '');
  assert.ok(a.stdout.indexOf('Respaldo creado') !== -1);
  assert.ok(b.stdout.indexOf('Respaldo creado') !== -1);

  const backups = listarBackups(destino);
  assert.equal(backups.length, 2, 'los dos procesos dejan su respaldo');
  for (const nombre of backups) {
    assert.ok(fs.existsSync(path.join(destino, nombre, 'contador.json')),
      nombre + ' quedó completo');
  }
  assert.ok(!fs.readdirSync(destino).some((n) => n.startsWith('.tmp-respaldo-')),
    'no quedan temporales');
  assert.ok(!fs.existsSync(path.join(destino, '.respaldo.lock')), 'el lock queda liberado');

  fs.rmSync(datos, { recursive: true, force: true });
  fs.rmSync(destino, { recursive: true, force: true });
});
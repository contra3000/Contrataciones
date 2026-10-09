#!/usr/bin/env node
/*
 * empaquetar-generador.js
 * ORDEN-RONDA-28 §5 (ADR-044). Arma la carpeta que se copia a otra máquina y se
 * abre con doble clic: dist/SGC-Generador/.
 *
 * Por qué una herramienta y no "copiar la carpeta a mano": lo que se copia es
 * la aplicación con servidor menos todo lo que el generador no usa, y esa resta
 * tiene que ser exacta y repetible. Si alguien copia app/ tal cual, viaja
 * js/adapters/repo.http.js (que habla con /api/), js/app.js (el arranque del
 * servidor) y el catálogo en .json que en file:// no se puede leer. Este archivo
 * arma el paquete desde la lista que declara el propio generador.html, así que
 * no hay una lista aparte que se pueda quedar vieja.
 *
 * Lo que entra:
 *   - generador.html, tal cual;
 *   - cada <script src> y cada <link rel="stylesheet" href> que declara, con su
 *     carpeta (js/, css/, config/): el núcleo, los renders, las vistas y los
 *     tres módulos del generador;
 *   - el catálogo entero en .js (manifiesto, rubros, clases, cada clase en
 *     items/, y el índice de códigos), porque sobre file:// el catálogo se lee
 *     inyectando <script> (carga.js, ORDEN-RONDA-28 §1).
 *
 * Lo que NO entra, y por qué:
 *   - server/, tests/ y datos/: son de la aplicación con servidor y de las
 *     pruebas. En un paquete para el Jefe no tienen por qué estar, y un
 *     server/ adentro invite a arrancar algo que no hace falta.
 *   - los .json: en file:// Chrome no los puede leer, así que el build ya dejó
 *     el hermano .js de cada uno (ver tools/build-catalogo.js y
 *     tools/build-config.js). Copiarlos duplicaría el paquete sin que los use
 *     nadie: son la mitad del peso.
 *   - app/index.html y lo demás de app/ que generador.html no declara.
 *
 * El destino se limpia antes de escribir: un paquete viejo puede tener archivos
 * que esta versión ya no copia, y sobrarían. Por seguridad, si el destino ya
 * existe y no está vacío y NO parece un paquete generado (le falta
 * generador.html), la herramienta se niega a borrarlo salvo --forzar.
 *
 * El informe final dice cuántas archivos son y cuántos bytes pesan, que es lo
 * que va al INFORME-RONDA-28.md.
 *
 * ORDEN-RONDA-32 pieza 1c·d: el paquete dice de qué versión salió. Escribe en el
 * destino el `config/aplicacion.js` con `version` "r<NN>-<commit corto>"
 * (ejemplo "r32-1a2b3c4"), un VERSION.txt con la ronda, el commit, la fecha y la
 * versión del catálogo, y un LEEME.txt que es el de la prueba piloto, con la
 * versión. Así ningún JSON exportado se queda sin decir de qué paquete vino
 * (sello.versionGenerador).
 *
 * Uso:
 *   node tools/empaquetar-generador.js [--ronda <NN>] [--destino <carpeta>] [--json] [--forzar]
 *
 *   --ronda <NN>          la ronda del paquete ("r<NN>-<commit>"). Si no se pasa,
 *                         sale del último INFORME-RONDA-NN.md del repositorio.
 *   --destino <carpeta>   dónde armar el paquete (por defecto dist/SGC-Generador).
 *   --json                imprime el informe como una línea JSON, para tests.
 *   --forzar              borra un destinoOccupado aunque no parezca un paquete.
 *
 * Determinista: el mismo repo produce el mismo contenido byte a byte.
 * Sin dependencias: sólo la biblioteca estándar de Node.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const APP = path.join(RAIZ, 'app');

/*
 * Carpetas que no viajan. Se comparan por nombre de carpeta en cualquier
 * posición de la ruta, para que app/server/, server/ y tests/helpers/ queden
 * afuera los tres.
 */
const EXCLUIDOS = ['server', 'tests', 'datos'];

/* El archivo que tiene que estar en el destino para que la herramienta lo borre. */
const MARCA = 'generador.html';

function leerArgumentos(argv) {
  const opciones = { destino: null, json: false, forzar: false, ronda: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--destino') {
      opciones.destino = argv[i + 1];
      i++;
    } else if (argv[i] === '--json') {
      opciones.json = true;
    } else if (argv[i] === '--forzar') {
      opciones.forzar = true;
    } else if (argv[i] === '--ronda') {
      const valor = Number(argv[i + 1]);
      if (!Number.isInteger(valor) || valor < 1) {
        throw new Error('--ronda espera un número entero positivo, no "' + argv[i + 1] + '"');
      }
      opciones.ronda = valor;
      i++;
    }
  }
  return opciones;
}

/*
 * ORDEN-RONDA-32 pieza 1c: la versión del paquete, "r<NN>-<commit corto>".
 * La ronda sale del argumento --ronda, y si no se pasó, del último informe del
 * repositorio; el commit corto es el de HEAD (lo que se está empaquetando).
 */
function rondaDelRepositorio() {
  let mayor = 0;
  for (const entrada of fs.readdirSync(RAIZ)) {
    const m = /^INFORME-RONDA-(\d+)\.md$/.exec(entrada);
    if (m) {
      mayor = Math.max(mayor, Number(m[1]));
    }
  }
  return mayor > 0 ? mayor : null;
}

function commitCorto() {
  const res = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: RAIZ,
    encoding: 'utf8'
  });
  const salida = (res.status === 0 && res.stdout) ? res.stdout.trim() : '';
  return /^[0-9a-f]{7,}$/.test(salida) ? salida : '0000000';
}

function fechaHoy() {
  const ahora = new Date();
  const dia = String(ahora.getDate()).padStart(2, '0');
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  return dia + '/' + mes + '/' + ahora.getFullYear();
}

function versionDeCatalogo() {
  try {
    const manifiesto = JSON.parse(
      fs.readFileSync(path.join(APP, 'catalogo', 'manifiesto.json'), 'utf8'));
    if (manifiesto && typeof manifiesto.catalogoVersion === 'string') {
      return manifiesto.catalogoVersion;
    }
  } catch (err) {
    // se informa más abajo como "sin versión de catálogo"
  }
  return null;
}

function versionCompleta(ronda) {
  const commit = commitCorto();
  const numero = ronda || rondaDelRepositorio() || 0;
  return {
    ronda: numero,
    commit: commit,
    version: 'r' + numero + '-' + commit,
    fecha: fechaHoy(),
    catalogo: versionDeCatalogo()
  };
}

/*
 * carpetaExcluida(relativo)
 *
 * Dice por qué un archivo no entra al paquete, o null si entra. Los motivos
 * importan: un archivo que se pierde sin explicación es un bug que aparece
 * tres rondas después, con la pantalla en blanco y sin rastro.
 */
function carpetaExcluida(relativo) {
  const partes = relativo.split(/[\\/]+/);
  for (const parte of partes) {
    if (EXCLUIDOS.indexOf(parte) !== -1) {
      return 'la carpeta ' + parte + '/ no viaja al generador';
    }
  }
  return null;
}

/* Un .json no entra: sobre file:// el generador lee el hermano .js. */
function extensionExcluida(relativo) {
  if (/\.json$/i.test(relativo)) {
    return 'los .json no viajan: el generador los lee como .js';
  }
  return null;
}

function motivoExclusion(relativo) {
  return carpetaExcluida(relativo) || extensionExcluida(relativo);
}

/*
 * DeclaradoEnElGenerador()
 *
 * Lee app/generador.html y devuelve la lista de rutas que el documento pide:
 * los <script src> y los <link rel="stylesheet" href>. Es la lista real, no una
 * copia: si mañana se saca o se agrega un módulo, el paquete sigue al
 * documento y no hay nada que mantener a mano.
 */
function declaradoEnElGenerador(html) {
  const rutas = [];
  const vistos = Object.create(null);

  const agregar = (ruta) => {
    if (!ruta || /^(https?:)?\/\//.test(ruta) || ruta.charAt(0) === '/') {
      return;
    }
    if (vistos[ruta]) {
      return;
    }
    vistos[ruta] = true;
    rutas.push(ruta);
  };

  const patrones = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["']/gi
  ];
  for (const patron of patrones) {
    let m;
    while ((m = patron.exec(html)) !== null) {
      agregar(m[1]);
    }
  }
  return rutas;
}

/* Los .js del catálogo, en sus tres formas: manifiesto, rubros/clases e items/. */
function archivosDelCatalogo(catalogo) {
  const encontrados = [];
  const recorrer = (dir, prefijo) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = prefijo + entrada.name;
      if (entrada.isDirectory()) {
        recorrer(path.join(dir, entrada.name), ruta + '/');
      } else if (/\.js$/i.test(entrada.name)) {
        encontrados.push('catalogo/' + ruta);
      }
    }
  };
  recorrer(catalogo, '');
  encontrados.sort();
  return encontrados;
}

/*
 * plan(origen, destino)
 *
 * Todo lo que hay que hacer, sin tocar el disco: la lista de archivos a copiar
 * y la lista de los que se dejaron afuera con su motivo. Los tests usan esto
 * para revisar el paquete sin armarlo entero, y para comprobar que las
 * exclusiones existen (si se borran, el plan deja de filtrar y el test se pone
 * rojo).
 */
function plan(origen, destino) {
  const declarados = declaradoEnElGenerador(fs.readFileSync(path.join(origen, MARCA), 'utf8'));
  const catalogos = archivosDelCatalogo(path.join(origen, 'catalogo'));

  const copiar = [{ relativo: MARCA, desde: path.join(origen, MARCA) }];
  const fuera = [];

  for (const relativo of declarados.concat(catalogos)) {
    const motivo = motivoExclusion(relativo);
    if (motivo) {
      fuera.push({ relativo: relativo, motivo: motivo });
      continue;
    }
    const desde = path.join(origen, relativo);
    if (!fs.existsSync(desde)) {
      throw new Error('el generador declara ' + relativo + ' y no está en el repositorio');
    }
    copiar.push({ relativo: relativo, desde: desde });
  }

  return { destino: destino, copiar: copiar, fuera: fuera };
}

function leerLeeme(version, fecha) {
  // ORDEN-RONDA-32 pieza 1d: el LEEME.txt del paquete es el de la prueba piloto
  // (antes vivía aparte como LEEME-PILOTO.txt). Sólo cambia la línea de versión.
  return [
    'SGC · Generador de documentos · PRUEBA PILOTO',
    'Versión: ' + version + ' · ' + fecha,
    '',
    'QUÉ ES',
    '  Una herramienta para armar el requerimiento (Solicitud de Gastos), la',
    '  Especificación Técnica y su anexo, con los ítems del catálogo y los valores',
    '  de referencia. No necesita instalar nada, ni internet, ni servidor.',
    '',
    'CÓMO SE ABRE',
    '  1. Abrí la carpeta SGC-Generador y hacé doble clic en generador.html.',
    '     Se abre con Chrome (o Edge). Si se abre con otro programa:',
    '     clic derecho > Abrir con > Google Chrome.',
    '  2. Completá grado, nombre, apellido y número de control, y elegí "Usuario".',
    '     Abastecimiento y Contrataciones todavía no están habilitados.',
    '',
    'CÓMO SE TRABAJA',
    '  · Paso 1, Identificación · Paso 2, Renglones del catálogo y documentos de',
    '    referencia · Paso 3, Fundamentación · Paso 4, Revisión.',
    '  · Cada renglón necesita DOS valores de referencia de fuentes distintas',
    '    (presupuesto, u orden de compra / precio de plaza), o UN valor y un PDF de',
    '    justificación de por qué no hay otro.',
    '  · Los PDF se eligen desde tu PC: NO se suben a ningún lado. Se guarda el nombre,',
    '    el tamaño y una huella que permite comprobar que el adjunto es el mismo. Los',
    '    PDF se adjuntan como siempre, junto al requerimiento firmado.',
    '  · Si un paso queda marcado "falta", podés seguir, pero no vas a poder exportar',
    '    hasta completarlo.',
    '',
    // ORDEN-RONDA-33 pieza 2: el paquete explica cómo usar la plantilla con un
    // asistente de IA, que es como la va a llenar la persona.
    'LLENAR CON UN ASISTENTE DE IA',
    '  1. Bajá la plantilla con "Descargar plantilla vacía" (Paso 1).',
    '  2. En tu asistente (ChatGPT, Copilot, Claude…) adjuntá la plantilla y todos',
    '     tus papeles (Word, Excel, PDF, correos), desordenados, y pedile "Completá',
    '     esta plantilla siguiendo sus instrucciones".',
    '  3. Pegá lo que te devuelve con "Pegar texto" (o guardalo como .json y usá',
    '     "Importar").',
    '  4. Los renglones con un código válido entran listos. Los que no tienen código,',
    '     o tienen uno que no existe, entran "por buscar" (en rojo, con un botón',
    '     "Buscar"): elegí el ítem en el buscador y queda en ese mismo renglón.',
    '',
    'NO PIERDAS EL TRABAJO',
    '  · Lo que cargás vive en esta ventana. Si la cerrás sin guardar, se pierde.',
    '  · "Guardar avance" descarga un archivo .json en tu carpeta de Descargas, en',
    '    cualquier paso. Para seguir otro día: abrí generador.html > Paso 1 >',
    '    "Importar" > elegí ese archivo. Volvés al paso donde estabas.',
    '  · No edites el .json a mano: si se modifica fuera del generador, no se puede',
    '    volver a importar.',
    '',
    'AL TERMINAR',
    '  · "Imprimir los documentos" → guardá como PDF para el sistema de firmas.',
    '  · "Exportar para Abastecimiento" descarga el .json final. Durante la prueba',
    '    piloto, mandáselo a la División Contrataciones junto con tus comentarios.',
    '',
    'QUÉ NOS SIRVE QUE NOS CUENTES',
    '  Qué te trabó, qué no se entendía, qué faltó, y en qué paso. Si podés, mandá',
    '  también el .json del avance o el final.',
    '',
    'ESTA CARPETA ES DE SÓLO LECTURA. No guardes archivos adentro: todo lo que',
    'descargues va a tu carpeta de Descargas.',
    ''
  ].join('\r\n');
}

/*
 * listaFinal(origen)
 *
 * Todo lo que un paquete debe tener, y que no debe tener nunca. Se usa en dos
 * lugares: la herramienta, para dejar por escrito lo questata al armar el
 * paquete, y el test, que revisa el resultado de verdad.
 */
function problemasDePaquete(destino, declarados, cantidadCatalogo) {
  const problemas = [];
  const hay = (relativo) => fs.existsSync(path.join(destino, relativo));

  if (!hay(MARCA)) {
    problemas.push('no está ' + MARCA);
  }
  for (const relativo of declarados) {
    if (relativo !== MARCA && !hay(relativo)) {
      problemas.push('falta ' + relativo + ', que el generador declara');
    }
  }
  if (!hay('catalogo/codigos.js')) {
    problemas.push('falta catalogo/codigos.js, el índice de códigos');
  }
  if (!hay('VERSION.txt')) {
    problemas.push('falta VERSION.txt, la versión del paquete (ORDEN-RONDA-32)');
  }

  const contar = (extension) => {
    let total = 0;
    const recorrer = (dir) => {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entrada.isDirectory()) {
          recorrer(path.join(dir, entrada.name));
        } else if (extension.test(entrada.name)) {
          total++;
        }
      }
    };
    if (fs.existsSync(destino)) {
      recorrer(destino);
    }
    return total;
  };

  const js = contar(/\.js$/i);
  const json = contar(/\.json$/i);
  if (json > 0) {
    problemas.push(json + ' archivo(s) .json: en el generador no sirven y se pidió que no viajen');
  }
  if (cantidadCatalogo > 0 && js - declarados.filter((r) => /\.js$/i.test(r)).length !== cantidadCatalogo) {
    problemas.push('el catálogo quedó incompleto: hay ' +
      (js - declarados.filter((r) => /\.js$/i.test(r)).length) + ' .js de catálogo y son ' +
      cantidadCatalogo + ' los que hay que copiar');
  }
  return problemas;
}

function limpiar(destino, forzar) {
  if (!fs.existsSync(destino)) {
    return;
  }
  const entradas = fs.readdirSync(destino);
  if (entradas.length === 0) {
    return;
  }
  if (!forzar && !entradas.includes(MARCA)) {
    throw new Error('el destino ' + destino + ' ya existe, no está vacío y no parece un paquete ' +
      'generado (le falta ' + MARCA + '). Revisá la ruta o usá --forzar.');
  }
  fs.rmSync(destino, { recursive: true, force: true });
}

function enMegabytes(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function main() {
  let opciones;
  try {
    opciones = leerArgumentos(process.argv.slice(2));
  } catch (err) {
    console.error('empaquetar-generador: ' + err.message);
    process.exit(1);
    return;
  }
  const destino = opciones.destino ? path.resolve(opciones.destino) : path.join(RAIZ, 'dist', 'SGC-Generador');

  let trabajo;
  let declarados;
  let cantidadCatalogo;
  try {
    declarados = declaradoEnElGenerador(fs.readFileSync(path.join(APP, MARCA), 'utf8'));
    cantidadCatalogo = archivosDelCatalogo(path.join(APP, 'catalogo')).length;
    trabajo = plan(APP, destino);
  } catch (err) {
    console.error('empaquetar-generador: ' + err.message);
    process.exit(1);
    return;
  }

  try {
    limpiar(destino, opciones.forzar);
  } catch (err) {
    console.error('empaquetar-generador: ' + err.message);
    process.exit(1);
    return;
  }

  let bytes = 0;
  let version = versionCompleta(opciones.ronda);
  try {
    fs.mkdirSync(destino, { recursive: true });
    for (const item of trabajo.copiar) {
      const hacia = path.join(destino, item.relativo);
      fs.mkdirSync(path.dirname(hacia), { recursive: true });
      fs.copyFileSync(item.desde, hacia);
      bytes += fs.statSync(hacia).size;
    }
    /*
     * ORDEN-RONDA-32 pieza 1c: cada JSON exportado dice de qué paquete salió
     * (sello.versionGenerador lee config/aplicacion.js). La versión se escribe
     * en el config/aplicacion.js DEL PAQUETE, nunca en el del repositorio.
     */
    const configRuta = path.join(destino, 'config', 'aplicacion.js');
    const configAntes = fs.statSync(configRuta).size;
    const configEscrito = fs.readFileSync(configRuta, 'utf8')
      .replace(/("version"\s*:\s*")[^"]*(")/, '$1' + version.version + '$2');
    fs.writeFileSync(configRuta, configEscrito);
    // El bucle ya contó el config copiado (el del repositorio): suma el delta
    // de la versión escrita, no el archivo dos veces.
    bytes += fs.statSync(configRuta).size - configAntes;
    fs.writeFileSync(path.join(destino, 'LEEME.txt'),
      Buffer.from(leerLeeme(version.version, version.fecha), 'utf8'));
  } catch (err) {
    console.error('empaquetar-generador: no se pudo copiar: ' + err.message);
    process.exit(1);
    return;
  }

  try {
    fs.writeFileSync(path.join(destino, 'VERSION.txt'), Buffer.from([
      'SGC Generador · versión ' + version.version,
      'ronda: ' + version.ronda,
      'commit: ' + version.commit,
      'fecha: ' + version.fecha,
      'catalogo: ' + (version.catalogo || 'sin manifiesto'),
      ''
    ].join('\r\n'), 'utf8'));
  } catch (err) {
    console.error('empaquetar-generador: no se pudo escribir VERSION.txt: ' + err.message);
    process.exit(1);
    return;
  }

  bytes += fs.statSync(path.join(destino, 'LEEME.txt')).size;
  bytes += fs.statSync(path.join(destino, 'VERSION.txt')).size;

  const problemas = problemasDePaquete(destino, declarados, cantidadCatalogo);
  if (problemas.length > 0) {
    console.error('empaquetar-generador: el paquete quedó incompleto:');
    for (const problema of problemas) {
      console.error('  - ' + problema);
    }
    process.exit(1);
    return;
  }

  const informe = {
    destino: destino,
    version: version.version,
    ronda: version.ronda,
    commit: version.commit,
    versionCatalogo: version.catalogo,
    declarados: declarados.length,
    catalogo: cantidadCatalogo,
    archivos: trabajo.copiar.length + 2,
    bytes: bytes,
    mb: enMegabytes(bytes),
    excluidos: trabajo.fuera
  };

  if (opciones.json) {
    console.log(JSON.stringify(informe));
    return;
  }
  console.log('empaquetar-generador: ' + version.version + ' · ' + version.fecha +
    ' · catálogo ' + (version.catalogo || 'sin versión'));
  console.log('empaquetar-generador: ' + MARCA + ' + ' + declarados.length +
    ' archivo(s) declarados + ' + cantidadCatalogo + ' archivo(s) de catálogo en .js');
  console.log('empaquetar-generador: ' + informe.archivos + ' archivo(s), ' +
    informe.bytes + ' bytes (' + informe.mb + ' MB) en ' + destino);
  console.log('empaquetar-generador: sin ' + EXCLUIDOS.join('/') + ' y sin .json');
  console.log('empaquetar-generador: VERSION.txt y el LEEME.txt de la prueba piloto');
  console.log('empaquetar-generador: abrí ' + path.join(destino, MARCA) + ' con doble clic.');
}

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUIDOS,
  declaradoEnElGenerador,
  archivosDelCatalogo,
  carpetaExcluida,
  extensionExcluida,
  motivoExclusion,
  plan,
  problemasDePaquete,
  leerLeeme
};
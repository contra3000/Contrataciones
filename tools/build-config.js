#!/usr/bin/env node
/*
 * build-config.js
 * ORDEN-RONDA-28 §2 (ADR-044). Escribe, junto a cada archivo de configuración
 * que la aplicación lee en el navegador, un .js hermano con los mismos datos.
 *
 * Por qué: el generador (app/generador.html) se abre con doble clic, o sea
 * file://, y Chrome no permite hacer fetch sobre file://. Con servidor, la
 * configuración llega por fetch y nada cambia: por eso el .json se conserva y
 * sólo se agrega el hermano.
 *
 * El hermano llama a SGC.cargaConfig.recibir('<ruta lógica>', <datos>). El
 * módulo que la recibe es app/js/generador/config-carga.js.
 *
 * Sólo se envuelven los archivos que la aplicación pide en el navegador. Hoy es
 * uno solo:
 *
 *   config/aplicacion.json -> app/config/aplicacion.js
 *
 * No se envuelven palabras.json, plantillas-v1.json, servidor.json ni
 * usuarios.ejemplo.json: los lee el servidor (o, el padrón, la montura de tests
 * con require), nunca el generador.
 *
 * El texto va como literal JSON embebido, no como cadena: el archivo es JS
 * válido y no necesita JSON.parse ni eval.
 *
 * Uso:
 *   node tools/build-config.js [--entrada config] [--salida app/config] [--verificar]
 *
 * Con --verificar no escribe nada: compara lo que hay en la salida con lo que
 * debería haber y sale con código 1 si algo quedó desactualizado. Es lo que usa
 * el test para que la copia versionada no se separe del .json.
 *
 * Determinista: la misma entrada produce el mismo archivo byte a byte.
 * Sin dependencias: sólo la biblioteca estándar de Node.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

// Los archivos que la aplicación lee en el navegador. No es una lista de todo
// lo que hay en config/: es lo que de verdad viaja al cliente.
const ARCHIVOS = ['aplicacion.json'];

const NOMBRE_FUNCION = 'SGC.cargaConfig.recibir';

function leerArgumentos(argv) {
  const opciones = { entrada: null, salida: null, verificar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--entrada') {
      opciones.entrada = argv[i + 1];
      i++;
    } else if (argv[i] === '--salida') {
      opciones.salida = argv[i + 1];
      i++;
    } else if (argv[i] === '--verificar') {
      opciones.verificar = true;
    }
  }
  return opciones;
}

// El contenido del hermano .js para un archivo de configuración.
function envolver(contenidoJson, rutaLogica) {
  return NOMBRE_FUNCION + '(' + JSON.stringify(rutaLogica) + ',' + contenidoJson + ');\n';
}

// Calcula { rutaLogica, rutaDisco, rutaJs, texto } para cada archivo, sin
// tocar el disco: el verificador y el escritor comparten esta cuenta.
function plan(entrada, salida) {
  const salidas = [];
  for (const nombre of ARCHIVOS) {
    const origen = path.join(entrada, nombre);
    const crudo = fs.readFileSync(origen, 'utf8');
    // Se re-serializa el contenido parseado para que el .js sea idéntico a lo
    // que devolvería un fetch con su res.json(): mismos datos, sin depender de
    // cómo esté espaciado el archivo de entrada.
    const texto = JSON.stringify(JSON.parse(crudo));
    const rutaLogica = 'config/' + nombre;
    salidas.push({
      nombre: nombre,
      rutaLogica: rutaLogica,
      rutaJs: path.join(salida, nombre.replace(/\.json$/, '.js')),
      texto: envolver(texto, rutaLogica)
    });
  }
  return salidas;
}

function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  const entrada = opciones.entrada ? path.resolve(opciones.entrada) : path.join(RAIZ, 'config');
  const salida = opciones.salida ? path.resolve(opciones.salida) : path.join(RAIZ, 'app', 'config');

  if (!fs.existsSync(entrada)) {
    console.error('build-config: la carpeta de configuración no existe: ' + entrada);
    process.exit(1);
  }

  let salidas = null;
  try {
    salidas = plan(entrada, salida);
  } catch (err) {
    console.error('build-config: no se pudo leer la configuración: ' + err.message);
    process.exit(1);
  }

  if (opciones.verificar) {
    const desactualizados = [];
    for (const item of salidas) {
      const actual = fs.existsSync(item.rutaJs) ? fs.readFileSync(item.rutaJs, 'utf8') : null;
      if (actual !== item.texto) {
        desactualizados.push(item.rutaJs);
      }
    }
    if (desactualizados.length > 0) {
      console.error('build-config: hay ' + desactualizados.length +
        ' archivo(s) desactualizado(s). Corré: node tools/build-config.js');
      for (const ruta of desactualizados) {
        console.error('  ' + ruta);
      }
      process.exit(1);
    }
    console.log('build-config: OK - ' + salidas.length + ' archivo(s) al día.');
    return;
  }

  fs.mkdirSync(salida, { recursive: true });
  for (const item of salidas) {
    fs.writeFileSync(item.rutaJs, item.texto, 'utf8');
    console.log('build-config: ' + item.rutaLogica + ' -> ' + item.rutaJs);
  }
}

if (require.main === module) {
  main();
}

module.exports = { envolver, plan, ARCHIVOS };
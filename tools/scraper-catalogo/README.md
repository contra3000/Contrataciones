# Scraper del catálogo de ítems

Herramienta **offline**. No forma parte de la aplicación desplegada (ADR-018): vive en el repositorio, corre en una PC fuera de la intranet y su producto —`catalogo_incisos.json`— se traslada a mano a la red interna.

## Estado actual: ⚠️ INCOMPLETO

Lo único recuperado hasta ahora es `FRAGMENTO-extraccion-pagina.js`: el bloque interior `page.evaluate()` de un script Puppeteer/Playwright. **No se ejecuta por sí solo.**

### Lo que el fragmento sí nos dice

| Dato | Valor |
|---|---|
| Runtime | Node.js con Puppeteer o Playwright (usa `page.evaluate`) |
| Estructura del origen | Tabla HTML con clase `table-hover`, 5 columnas |
| Columnas | `codigo`, `rubro`, `clase`, `item`, `estado` |
| Filtro aplicado | `estado === 'Activo'` **y** `codigo` no vacío |
| Recorrido | Por páginas (la variable se llama `itemsPagina`) |

**Hallazgo relevante:** el filtro de `estado` está en el scraper, no en el origen. Eso explica por qué el campo vale `Activo` en los 159.366 registros. Confirma la enmienda de ADR-014.

### Lo que falta para tener un scraper ejecutable

1. **La URL del sitio de origen** y la ruta de navegación hasta la tabla.
2. **El arranque del navegador** (`puppeteer.launch` / `chromium.launch`) y sus opciones.
3. **El bucle de paginación**: cómo se pasa de una página a la siguiente y cómo se detecta el final. Es la parte que explica las 2 horas de corrida.
4. **La escritura del archivo de salida** y su formato.
5. Manejo de errores, reintentos y esperas.
6. `package.json` con la dependencia y su versión.

## Qué hace falta de tu parte

Buscá en la misma conversación el resto del script — en particular el bloque que contiene `launch(`, la URL, y el `while`/`for` de paginación. Con eso se reconstruye entero. Si sólo aparece esto, hay que rehacerlo, y para eso necesito la URL del sitio y una captura o el HTML de una página del listado.

## Trabajo pendiente una vez recuperado (ADR-018)

- [ ] Hacerlo **reanudable**: guardar la página alcanzada para poder retomar. Una corrida de 2 horas que falla al 80% sin poder continuar es una corrida que en la práctica no se hace todos los meses.
- [ ] **Reporte de diferencias** contra el catálogo vigente: ítems nuevos, ítems que desaparecieron del origen (candidatos a baja) y descripciones modificadas. Es el mecanismo por el cual el Jefe de Contrataciones "se entera" de las bajas.
- [ ] Documentar el procedimiento mensual completo: correr → revisar diferencias → trasladar el archivo → `build-catalogo` → publicar `catalogo/` con su `catalogoVersion`.
- [ ] Fijar la versión de la dependencia; el scraper es lo único del proyecto que tiene una.

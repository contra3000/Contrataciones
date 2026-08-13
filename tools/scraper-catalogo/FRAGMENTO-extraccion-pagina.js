/**
 * FRAGMENTO RECUPERADO — extracción de una página del catálogo de ítems
 * ---------------------------------------------------------------------
 * Origen : historial de conversación con un LLM, recuperado el 2026-08-13.
 * Estado : INCOMPLETO. Ver README.md en esta misma carpeta.
 *
 * Esto es únicamente el bloque interior `page.evaluate()` de un script
 * Puppeteer/Playwright. NO se ejecuta por sí solo: le falta el arranque del
 * navegador, la URL de origen, el bucle de paginación y la escritura del
 * archivo de salida.
 *
 * Se versiona tal cual, sin retoques, para no perder el único artefacto
 * disponible del scraper original (ADR-018). No modificar este archivo:
 * cuando aparezca el script completo, este fragmento se reemplaza.
 *
 * Dato verificado a partir de este fragmento: el filtro `estado === 'Activo'`
 * está en el scraper, no en el origen. Por eso el campo `estado` vale
 * 'Activo' en los 159.366 registros del JSON. Confirma la enmienda de ADR-014:
 * la columna es redundante por construcción y se descarta en el build.
 */

// Extraemos los datos de la página actual
        const itemsPagina = await page.evaluate(() => {
            const filas = document.querySelectorAll('table.table-hover tbody tr');
            const datos = [];

            filas.forEach(fila => {
                const columnas = fila.querySelectorAll('td');
                if (columnas.length >= 5) {
                    const codigo = columnas[0].innerText.trim();
                    const rubro = columnas[1].innerText.trim();
                    const clase = columnas[2].innerText.trim();
                    const item = columnas[3].innerText.trim();
                    const estado = columnas[4].innerText.trim();

                    // Mantenemos el filtro para guardar solo los activos, pero ahora guardamos todas las columnas
                    if (estado === 'Activo' && codigo !== '') {
                        datos.push({
                            codigo: codigo,
                            rubro: rubro,
                            clase: clase,
                            item: item,
                            estado: estado
                        });
                    }
                }
            });
            return datos;
        });

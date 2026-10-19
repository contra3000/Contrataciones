# ORDEN DE CIERRE — RONDA 39 · Terminar lo que quedó a medias

SGC · 2026-10-19 · ítem 32 de la cola (N1). Reglas: `CICLO_DE_TRABAJO.md`.

**Antes que nada, releé entera `ORDEN-RONDA-39.md`.** Tu sesión se cortó el 17/10 a la
noche y la ronda quedó así (auditoría 39 y medición del revisor):

| Qué | Estado |
|---|---|
| Commits `aec716a`, `3c82e82`, `d7863a6` | En GitHub, **con la suite en rojo**: 686 / 683 / 3 |
| `tests/ronda-39-p1.test.js` | **No compila.** En la línea 263 falta un pedazo: queda `20000, 'los documentos se compusieron');` suelto después de `const antes = …` |
| La normalización de códigos en el HEAD | No hace nada: el `replace` junta los puntos y ningún código se acomoda |
| `app/js/views/fasttrack.js`, `app/js/generador/intercambio.js`, `app/js/generador/documentos.js` | **Arreglados pero sin commitear** en `dev\` (17/10, 23:07-23:12). Con esos tres, `prueba-ronda-39.js` da **13/13** y las regresiones pasan enteras |
| `INFORME-RONDA-39.md` | No existe |

**Nada de esto se rehace de cero.** Hay que commitear lo que ya está bien, arreglar el test
roto y cerrar como siempre.

## Paso 1 · Mirar

```
git status --short
git diff --stat
```

- Tienen que aparecer **sólo** esos tres archivos (y lo que toques ahora).
- Si aparece otra cosa, **no la commitees**: la nombrás en el informe.

## Paso 2 · El test que no compila

En `tests/ronda-39-p1.test.js:262-263`, rehacé el bloque que quedó cortado.

- Según tu commit `d7863a6`, mide que después de imprimir los documentos se compusieron.
- **No cambies lo que el test pide**, sólo completalo para que compile.

## Paso 3 · Suite completa en verde, y un commit

```
node --test --test-timeout=120000 "tests/*.test.js"
```

- **Tiene que dar 0 fallas.** Si un test falla por los tres archivos sin commitear, el
  arreglo se hace ahí, no en el test.
- **Un solo commit:** `Ronda 39 · cierre: normalización de códigos, buscar conservado,
  cantidades OCA en el paso y test reparado`.
- **El cuerpo dice:**
  - que la sesión se cortó;
  - qué tenía cada archivo;
  - qué test lo prueba.
- → `git push`.

## Paso 4 · Cierre, siempre igual

1. **`INFORME-RONDA-39.md`**, con sus nueve secciones:
   - **§4 dice dónde se cortó la sesión** y que los tres commits anteriores quedaron en
     rojo;
   - todas las corridas copiadas del log, también la roja si la tenés.
2. Commit → `git push`.
3. **`git status --short` vacío.** Pegalo en tu mensaje final. Es la regla nueva: una ronda
   no se cierra con cambios sin commitear.
4. **Clon con la ruta absoluta**, en una carpeta **nueva**, porque `ciclo-39` ya tiene la
   primera auditoría y no se toca:

   ```
   git clone https://github.com/contra3000/Contrataciones.git C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39b
   ```
5. **Paquete:** `node tools/empaquetar-generador.js --ronda 39 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
6. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

**Después de esto, el revisor corre las pruebas sobre el HEAD.** Si el código es el mismo
que probó el Jefe (13/13), su prueba vale y la 39 queda cerrada.

# ORDEN DE CIERRE — RONDA 10

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Emitida: 2026-08-21

> **Esto no es una ronda nueva. No rehagas nada.**

---

## 0. Qué pasó

Hiciste la ronda 10 y **no la entregaste**. El trabajo está en tu carpeta, sin commitear, sin informe y sin push. Tu sesión se cortó a las 14:46 del 21 de agosto, después de la última escritura y antes del cierre.

El auditor, que trabaja sobre un clon del repositorio remoto, encontró que ahí no había nada y dictó **RECHAZADO**. Sobre el repositorio tiene razón: **trabajo que no está publicado no existe**, y eso ya nos costó una ADR entera que se perdió en un rebase.

Lo que sigue es cerrar lo que hiciste. **Antes de tocar una línea, mirá lo que ya está en tu árbol de trabajo:**

```powershell
git status --short
```

Vas a encontrar, con fecha del 21 de agosto: `app/js/core/anexo-eett.js`, `app/js/renders/anexo-eett.js`, `app/js/views/requerimiento-formulario.js`, `app/js/views/requerimiento-valores.js`, `tests/anexo-eett.test.js`, `tests/requerimiento-formulario.test.js`, `tests/requerimiento-servidor.test.js`, más los cambios en `config.js`, `validacion.js`, `servidor.js`, `expedientes.js`, `documento.js`, `requerimiento.js`, `resumen.js`, `expediente.js`, `fasttrack.js`, `pasos.js` y tres archivos de tests.

**Eso es tuyo y está bien.** Revisé tres puntos y los tres pasan:

- `MAX_ACLARACION` vive ahora en **un solo lugar**, `config.js:272`, en **256**, y los demás archivos la leen de ahí. Resolviste el número y la causa.
- Partir el límite en dos —`MAX_ACLARACION` 256 impreso y `MAX_ACLARACION_TOTAL` 2000 como tope duro de entrada— **no lo pedí y es mejor que lo que pedí**: mi orden decía "cuando el texto supera el límite entra al anexo" sin decir cuál era el techo del anexo. Documentalo en el informe, porque es una decisión de diseño y no un detalle.
- `servidor.js` ya carga `requerimiento.js` y `expedientes.js:356` llama a `validarRenglon`. Eso cierra el agujero más grave que había.

---

## 1. Lo que falta para cerrar

### 1.1 — La leyenda de ADR-023 está en un lugar de tres

Está en `renders/documento.js` (el pie de los entregables). **Falta** en `resumen.js` y en la vista del expediente. La orden pedía los tres:

> *Este sistema genera documentos, registra tiempos y sigue el estado del trámite. No autoriza, no imputa y no adjudica: esos actos se perfeccionan con la firma de la autoridad competente, fuera de este sistema.*

Aprovechá y verificá lo mismo para la leyenda de **ADR-016** (los instrumentos firmados residen fuera del sistema): hay indicios de que tampoco está en la vista del expediente. Comparten los tres lugares.

### 1.2 — Un cuerpo sobre 4 MB corta el socket en lugar de responder

`server/ayudantes.js:221-223` hace `req.destroy()` cuando se supera `LIMITE_CUERPO`. Es un rechazo, no una fuga, pero un cliente legítimo que se pasa **ve morir la conexión sin explicación**. Respondé `413` con un mensaje en castellano antes de cortar.

### 1.3 — Verificá contra el servidor, no contra la vista

Corré vos mismo, contra el servidor real, lo que la orden de auditoría §2.1 iba a probar. El servidor tiene que rechazar por su cuenta, sin ayuda de la pantalla:

```
PUT con base ausente                      -> debe rechazar
PUT con valor negativo                    -> debe rechazar
PUT con base 'total' y cantidad 0         -> debe rechazar
PUT con presupuestoId inexistente         -> debe rechazar
PUT con aclaración de 300 caracteres      -> debe rechazar
PUT con justificación de 50.000 caracteres-> debe rechazar
POST de creación con renglón inválido     -> debe rechazar
```

Sobre el código de la ronda 9 **los siete devolvían 200 o 201**. Ese era el defecto de severidad alta del ciclo, y es de la familia del defecto del ciclo 6: la regla vivía sólo del lado del cliente. Si tu trabajo ya lo cierra, mostralo en el informe con las respuestas a la vista.

### 1.4 — La suite

`node --test` desde la raíz, en verde, **de una sola pasada**, y `node tools/check-compat.js` con salida 0. Y ningún archivo sobre 400 líneas: agregaste cuatro archivos nuevos, verificalo.

---

## 2. El informe — `INFORME-RONDA-10.md`

Las nueve secciones de siempre. En la §2, tres cosas explícitas:

- **dónde quedó la única definición de `MAX_ACLARACION`** y por qué partiste el límite en dos;
- **qué contás como "carácter"** para la regla de desborde, y qué pasa con acentos y eñes. `String.length` cuenta unidades UTF-16: para acentos y eñes coincide con lo que ve el usuario, para emojis no. Decí qué criterio adoptaste y verificá que sea **el mismo** en el validador, en el contador visible y en la regla de desborde — hoy hay un `length` en cada uno;
- **qué reglas del requerimiento valida el servidor por su cuenta**, con las respuestas de §1.3.

En la §4, si algo de lo que hiciste no cerró o quedó a medias, decilo. La sección "Qué NO hice" de tu informe de la ronda 9 fue lo que abrió la orden de la ronda 10; no la pierdas ahora.

---

## 3. Cierre — y esta vez el cierre es el entregable

```
node --test                      # verde, una sola pasada
node tools/check-compat.js       # salida 0
git add -A
git commit -m "Ronda 10 - H11 pantalla de carga y H12 anexo de EETT"
git push
git log --oneline -1             # verificá que el commit está
git status --short               # tiene que volver vacío
```

**Un solo commit.** Y no des la ronda por terminada hasta que `git log` muestre tu commit y `git status` vuelva limpio. Un trabajo excelente sin publicar vale exactamente lo mismo que un trabajo que no se hizo.

---

## 4. Reglas de conducta

Las siete de `ORDEN-RONDA-01.md` §3. La documentación es de sólo lectura: **ADR-021 a ADR-028 y las órdenes las escribí yo, no las toques.**

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más. **No entres a `auditoria/` ni a ninguna carpeta fuera de tu repositorio**, aunque supongas que ahí está el informe del auditor.

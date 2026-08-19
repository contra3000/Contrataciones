# ORDEN DE AUDITORÍA — CICLO 08

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **Entregables de todas las fases, Archivo Histórico y respaldo**, según `ordenes/ORDEN-RONDA-08.md`
Emitida: 2026-08-19

---

## 0. Tu rol

Valen íntegramente `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1.

### Tu ciclo anterior

Cero hallazgos, y eso fue un buen resultado, no una auditoría floja. Trece escenarios laterales de ataque, 119 peticiones de matriz contra el servidor real, verificación de disco después de cada rechazo, y una sección de superficie de autorización que enumera todos los caminos posibles y demuestra que ninguno queda fuera del motor.

Verifiqué tu conclusión de forma independiente sobre los tres vectores principales y coincidimos.

Dos cosas para sostener: seguiste levantando observaciones que no son defectos —usuarios inactivos en el padrón, catálogo sin filtrado por sector— y eso es exactamente lo que corresponde: describen supuestos que conviene tener escritos antes de que alguien los descubra a los golpes. Y cuando el desarrollador implementó algo que no estaba en la orden (el cruce del rol contra el padrón), lo verificaste igual en vez de darlo por bueno.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los tres de siempre. Este ciclo agrega uno: **el desarrollador ahora hace `git push`**. Verificá que el commit del ciclo esté en `origin/main` y que no haya commits locales sin publicar.

---

## 2. El blanco principal: el respaldo

Es el 40% de esta auditoría, y va primero por una razón: **es lo único del ciclo que, si falla, no se puede arreglar después.** Con archivos planos como fuente de verdad, el respaldo *es* el plan de recuperación.

No te alcance con que el test del desarrollador esté en verde. Hacé el ciclo completo vos:

1. Levantá un servidor, creá varios expedientes, hacé avanzar algunos, devolvé alguno.
2. Respaldá.
3. **Destruí la carpeta de datos entera.**
4. Restaurá.
5. Verificá que todo volvió: cada `datos.json`, el `idx/` completo, el histórico, el archivo histórico si lo había, y **la cadena de auditoría íntegra en cada expediente**.

Después buscá dónde se rompe:

- Respaldar **mientras el servidor escribe**. Corré el respaldo en paralelo con veinte altas concurrentes y verificá que la copia resultante sea restaurable y consistente.
- Restaurar **sobre una carpeta que ya tiene datos**: ¿pisa, mezcla, avisa?
- Restaurar desde un respaldo **truncado o corrupto**: ¿falla limpio o deja la carpeta a medias?
- La retención: crear más respaldos que el límite, ¿borra los viejos y conserva los nuevos, o al revés?
- ¿El respaldo incluye el Archivo Histórico, o sólo los trámites activos? Si no lo incluye, el expediente perfeccionado —el que tiene valor legal— es el único que no se respalda.

### 2.2 — El Archivo Histórico

- Llevá un expediente hasta `PERFECCIONADA` y verificá: copia en `ArchivoHistorico/`, purgado del `idx/`, marcado como archivado, y original no borrado.
- `GET /api/archivo` tiene que armar el listado **leyendo el directorio**. Instrumentá o inspeccioná: si lee un índice, viola el §8.3.
- **El caso que rompe: interrumpí el archivado a mitad.** Matá el servidor entre la copia y la purga del índice, y entre la purga y el marcado. En cada punto, ¿el expediente queda recuperable? ¿Puede quedar fuera del índice **y** fuera del histórico al mismo tiempo? Ese es el escenario que pierde un expediente.
- ¿Se puede archivar un expediente que no está en `PERFECCIONADA`, pegándole directo a la API?
- ¿El expediente archivado sigue siendo legible por `GET /api/expedientes/:id`, o queda inaccesible?

### 2.3 — Las plantillas

- Las cuatro nuevas: documento completo, **aclaraciones impresas** en todas las que llevan tabla de renglones. Es la regla que viene desde el ciclo 4.
- Inyección en cada una: `<script>` e `<img onerror>` en título, fundamentación y aclaración.
- **¿Se compartió lo común o se copió?** Si el encabezado institucional aparece cinco veces con cinco variantes, es deuda que se paga en cada cambio futuro. Contá las repeticiones.
- Un documento generado con datos incompletos —sin renglones, sin fundamentación, sin operador— ¿rompe o degrada?
- `entregablesObligatorios`: ¿la validación los exige **en el servidor**, o sólo en la vista? Si sólo está en la vista, es el mismo defecto del ciclo 6 con otra ropa: pegale directo al extremo de avanzar sin haber generado el documento.

---

## 3. Regresiones

Las de siempre, obligatorias: concurrencia de `PUT`, numeración concurrente, recorrido de rutas, presupuesto del catálogo, alta completa, Fast-Track hostil, borrador inválido, recorrido de los 18 estados.

**Y la matriz de autorización del ciclo 7 completa**: es lo más valioso que se ganó y lo más caro de perder sin darse cuenta. Los 13 escenarios laterales y la matriz 18 × 7, de nuevo.

Conservá y volvé a correr tu batería `a1`–`a9`.

---

## 4. El reporte — `AUDITORIA-CICLO-08.md`

Misma estructura de secciones que el del ciclo 07, con la de superficie de autorización y la de riesgos declarados con tu opinión.

Agregá una sección propia:

```
## Recuperación ante desastre
El resultado literal de destruir la carpeta de datos y restaurarla: qué volvió,
qué no, y si la cadena de auditoría quedó íntegra. Si algo no volvió idéntico,
es un hallazgo crítico.
```

Cierre: un solo commit, `Auditoria ciclo 08`, sin push.

---

## 5. Qué se espera de vos

En los ciclos anteriores buscaste defectos de autorización y de entrada hostil. Este ciclo el blanco es distinto: **la pérdida de datos**.

Las dos operaciones nuevas —archivar y respaldar— mueven archivos. Las operaciones que mueven archivos fallan a la mitad, y cuando lo hacen dejan el sistema en un estado que nadie previó. El expediente que se archiva es además el que tiene valor legal y el que ya nadie mira.

La pregunta que guía esta auditoría: **¿existe alguna interrupción, en cualquier punto, que deje un expediente irrecuperable?**

Si la respuesta es no, y lo demostraste habiendo interrumpido en serio, ese es el resultado.

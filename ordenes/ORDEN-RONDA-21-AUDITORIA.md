# ORDEN DE AUDITORÍA — CICLO 21

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **el cierre de H23 y el sistema de estilos (H16)**, según `ordenes/ORDEN-RONDA-21.md`
Emitida: 2026-09-16

---

## 0. Tu rol · **y cambió, leé esto antes que nada**

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **38 ADRs**.

### Tu ciclo anterior · no terminaste, y la culpa fue mía

Te pedí recorrer el circuito completo como una persona. Escribiste un programa a medida de once pasos que maneja el navegador; tarda más de siete minutos por corrida, se rompe con cualquier cambio de pantalla —y esta ronda cambió cinco archivos de pantalla—, y se colgó cuando al reintentar se perdió la sesión y tu bloque esperaba el tablero en lugar del login.

Dos días, un reporte de 4,5 KB contra los 30 KB del ciclo anterior, y la verificación sin terminar.

**Eso no fue un error tuyo: fue una instrucción mal calculada de mi parte.** Te pedí que construyeras y mantuvieras un robot de navegador, que es caro, frágil, y que duplica peor lo que los tests del desarrollador ya hacen en segundos.

**Lo que sí hiciste bien y quiero que sigas haciendo:** pusiste **"COMPROBACIÓN NO COMPLETADA"** en el título en vez de disimular, dejaste anotado el punto seguro alcanzado, explicaste con precisión por qué falló tu propio reintento, y dejaste cuatro recomendaciones concretas. Declarar lo que no pudiste hacer vale más que un reporte completo que no se sostiene.

**Y una corrección de criterio, que es lo único que te marco.** Escribiste:

> *"El conflicto de versión es un control de concurrencia legítimo del SGC, no un defecto del servidor."*

Sobre el servidor, tenés razón. Sobre el sistema, no: había **una sola persona, en una sola pestaña, haciendo dos acciones seguidas**. Si guardar un documento impide avanzar el expediente, eso no es concurrencia — es una pantalla que se quedó con un dato viejo propio. Y el mensaje que ve el operador dice *"fue modificado por otro operador"*, mandándolo a buscar a alguien que no existe.

**La regla:** cuando el sistema le impide a una persona sola hacer dos cosas seguidas, la pregunta no es *"¿el servidor actuó bien?"* sino **"¿esto tiene sentido para quien está adelante de la pantalla?"**. Si no lo tiene, es un defecto, aunque cada componente por separado esté correcto.

### **Ya no manejás el navegador**

Es el cambio grande y es permanente. El reparto queda así:

| Quién | Qué |
|---|---|
| El desarrollador | Cubre los caminos de persona con tests sobre la montura real. Segundos, repetibles |
| **Vos** | **Leés el código, atacás la API, corrés la batería, y quitás las correcciones para ver si sus tests se ponen en rojo** |
| El Jefe de Contrataciones | El recorrido humano, con una guía corta |

No escribas programas que manejen el navegador. No arranques recorridos de once pasos. Si necesitás ver una pantalla, **leé el HTML y el JS** — que es lo que mejor hacés, y donde encontraste los doce identificadores desacoplados del ANEXO 1 sin ejecutar nada.

Las reglas de tiempo de `ORDEN-RONDA-20-AUDITORIA.md` §0 siguen vigentes íntegras.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los ocho de siempre, la **batería completa** con `MOTIVOS.md` al día, y el informe en la raíz.

---

## 2. Quitar la corrección · **el 40% de esta auditoría, y es tu trabajo principal ahora**

El desarrollador declara **9 de 9 caminos de persona** cubiertos. Verificá cada uno **así**:

1. Identificá **qué corrección** sostiene ese camino.
2. **Quitala** (una línea, un campo, un identificador).
3. Corré el test que dice cubrirlo.
4. **Tiene que ponerse en rojo.** Si pasa igual, ese camino **no está cubierto**, diga lo que diga el informe.
5. Restaurá y dejá constancia del diff vacío.

Es el método que usaste en el ciclo 19 con `app.js:112` y funcionó perfecto. Ahora es el centro de tu trabajo, no un extra.

**Y leé cómo arranca cada test.** Si llama a mano a una función de vista que la aplicación no llama sola, no cubre nada — ese barrido lo hiciste en el ciclo 19 y encontraste que el linaje era largo. Verificá que los marcados sigan marcados y que no hayan aparecido nuevos.

---

## 3. La lista de las versiones

La orden le pide al desarrollador **la lista completa de escrituras que devuelven una versión**, con lo que hace la vista con cada una: entregables, presupuestos, adjuntos, ANEXO 1, requerimiento, avance, devolución, archivado.

**Hacé tu propia lista leyendo el código, antes de leer la suya.** Después compará. Lo que esté en la tuya y no en la suya es el hallazgo.

Por cada escritura: **¿el servidor devuelve una versión nueva? ¿la vista la toma, o la usa para un cartel y la tira?** Es la quinta aparición de esa familia en este proyecto; quiero saber si quedan más.

---

## 4. El sistema de estilos · qué se audita y qué no

**No opines sobre gusto.** Se auditan cuatro cosas, todas verificables:

- **Una sola capa de variables.** Buscá todo color, tipografía y espaciado escrito a mano fuera del archivo de variables. La prueba concreta: **cambiá el valor del color primario y verificá que cambie toda la aplicación.** Si algo no cambia, está escrito a mano en otro lado. Listá cada caso.
- **Chrome 109** (ADR-011): sin anidamiento nativo, sin `text-wrap: balance`, y el guardián de compatibilidad extendido al CSS nuevo. Corrélo.
- **Ningún cambio de comportamiento.** Los 9 caminos en verde **y sin que se haya tocado ningún test por motivos de estilo**. Mirá el diff de `tests/`: si cambió un test, preguntate por qué, y si dependía de una clase o un color, **es un hallazgo del test, no del estilo**.
- **Los tres pedidos del Jefe de Contrataciones**: el padrón como tabla, los botones agrupados con la disposición respondiendo al ancho, y el botón de sugerencias que deja de ser un `?`. Los tres se verifican **leyendo el HTML y el CSS**, no manejando el navegador.

Y uno que sí requiere ejecutar, pero es barato: **generá un entregable y corré el generador real de la UOC sobre el mismo expediente.** Los dos documentos tienen que verse de la misma familia. Compará los dos archivos, no dos capturas.

---

## 5. Regresiones

Todo lo anterior, con la batería completa. Con atención especial a lo que cerró la ronda 20, porque esta toca cinco archivos de pantalla y el CSS entero:

- El presupuesto sube por la pantalla con un solo nombre de campo.
- El ANEXO 1 no esconde la aplicación, y lo que se escribe se guarda y se relee.
- Una vista que busca un nodo y no lo encuentra **falla de forma visible**.
- El operador llega al asistente; el borrador se guarda y sobrevive al reinicio.
- La clave provisoria en pantalla, en el alta, la importación y la reposición.
- El arranque honesto, la marca de administrador, el anti-encierro sobre el estado final.
- Bienes y servicios contra el generador real.

---

## 6. El reporte — `AUDITORIA-CICLO-21.md`

Misma estructura. Cuatro secciones propias:

```
## Las nueve correcciones quitadas
Camino por camino: qué quité, qué test corrí, rojo o verde.

## Mi lista de versiones contra la suya
Cada escritura: qué devuelve el servidor, qué hace la vista.

## El color primario
Lo cambié y esto no cambió con él.

## ¿Se puede instalar?
Tu recomendación, en una línea, con lo que la sostiene.
```

Cierre: un solo commit, `Auditoria ciclo 21`, sin push.

---

## 7. Qué se espera de vos

**Volver a lo que hacés mejor, que es leer y desconfiar.**

Tus mejores hallazgos de este proyecto salieron de leer: los doce identificadores desacoplados del ANEXO 1, la bandera `pliegoProbado` que el cliente elegía, el probador que fabricaba dos campos, el linaje de tests que armaban el estado a mano. Ninguno necesitó un navegador.

Los dos que sí necesitaron manejar el sistema —los presupuestos y el ANEXO 1 escondiendo la aplicación— ya están corregidos, y de ahora en adelante **esa parte la hace la persona que va a usarlo**.

La pregunta que guía esta auditoría: **¿cuál de los nueve caminos dice estar cubierto y no lo está?**

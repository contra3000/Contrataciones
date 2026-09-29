# ORDEN DE TRABAJO — RONDA 27

SGC · 2026-09-29 · hito **H26: la SCo junta requerimientos y corren juntos**
Reglas: `CICLO_DE_TRABAJO.md` (lista de control) · Decisión:
`ordenes/ADR-PROPUESTA-AGRUPAMIENTO.md`, **aceptada por el Jefe**.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **`server/candado.js` no va en ese commit**: es
la pieza 1.

**Vale** la §0 de `ORDEN-RONDA-01.md` y las reglas de tiempo de `ORDEN-RONDA-20.md`.
**Accesos:** `os.tmpdir()`, `127.0.0.1`, y crear `..\auditoria\ciclo-27` al cerrar.
**Cada pieza: tests en verde → `commit` y `push` en el momento. La suite, siempre con
`--test-timeout=120000`.**

---

### Pieza 1 · El candado no te bloquea a vos mismo · commit: `Ronda 27 · candado de la misma máquina`

**Dónde:** ya aplicado por el revisor en `server/candado.js`, sin commit. Revisalo con
`git diff`.

Para apagar, el Jefe cierra la ventana negra. En Windows eso **no corre el código de
salida** —lo midieron vos y el auditor— y el candado quedaba en la carpeta. Si volvía
a abrir antes de 2 minutos, lo bloqueaba *su propia PC*.

**Cambia:**

- un candado de **esta misma máquina** cuyo proceso **ya no existe**
  (`process.kill(pid, 0)` da `ESRCH`) se toma como abandonado en el acto;
- se escucha `SIGHUP`, que es el cierre de la ventana.

**Test:**

- candado de esta máquina con un pid muerto → arranca y avisa;
- de otra máquina → rechaza;
- de esta máquina con el pid vivo → rechaza.

Quitá `abandonadoEnEstaMaquina` → el primero da rojo.

### Pieza 2 · Un test roto falla, no cuelga · commit: `Ronda 27 · tests que no cuelgan`

**Dónde:** lo encontró el auditor del ciclo 26.

- `tests/ronda-26-c6.test.js:93` no cierra el servidor en `finally`.
- Sin su tope, `ronda-26-c3` espera al `python` para siempre.

**Cambia:**

- `try/finally` en **todo** test que levante un proceso. Buscalos con la búsqueda
  entera: `spawn`, `arrancar` y `levantar` en `tests/`, y ponelos en el informe;
- `--test-timeout=120000` en todos los comandos de `tests/LEEME.md`.

**Test:** quitá el `candado.tomar` (E3 del ciclo 26) y el tope del `python` (E3′) → los
dos tests dan **rojo en menos de 2 minutos**, sin colgar la corrida.

### Pieza 3 · La SCo existe como registro · commit: `Ronda 27 · registro de SCo`

**Dónde:** hoy la SCo es sólo `campos.numeroSCo` en cada expediente, y los "hermanos"
salen de barrer el índice (`sco-numero.js`, `repo.listarIndice`).

**Cambia:**

- **`datos/sco/<año>/<numeroSCo>.json`**, con `numeroSCo`, `expedientes: [ids]`,
  `entregables`, `version` y `auditoria`. El servidor lo crea o actualiza **cuando se
  guarda el número**.
- **Sumarse:** sólo a una SCo cuyos expedientes estén **todos** en
  `SOLICITUD_CONTRATACION`. Si no, 409 en castellano.
- **Salir:** cambiando el número, **mientras la SCo no avanzó**.
- Los hermanos se leen del registro, no del índice.
- Las escrituras del registro llevan `versionEsperada` y la guardia
  `autorizarRolDelEstado`.

**Test:**

- dos expedientes con el mismo número → un registro con los dos;
- cambiar el número → sale;
- sumarse a una SCo que ya avanzó → 409.

### Pieza 4 · La SCo se mueve en bloque · commit: `Ronda 27 · SCo en bloque`

**Dónde:** `server/expedientes.js:140` (`transicionPorMotor`) mueve **un** expediente.

**Cambia:** desde que un expediente tiene SCo, avanzar o devolver **cualquiera** de sus
miembros **mueve a todos**:

1. **Primero se valida todo, sin escribir nada:** `motor.avanzar` o `motor.devolver`
   sobre cada miembro, con su `validarParaAvanzar`, más los requisitos de la SCo
   (pieza 5). Si uno falla, **no se mueve ninguno**, y el mensaje dice cuál falla y
   por qué, con el texto de la ronda 26.
2. Después se escriben todos, bajo un candado del grupo. Si una escritura falla, se
   restauran las anteriores desde `hist/`: **todo o nada**.
3. Cada expediente registra el evento con `grupo: "SCo <número>"`.

**Devolución, decisión del Jefe:** vuelve **toda la SCo**. Si vuelve a
`ESPECIFICACIONES_TECNICAS`:

- **la SCo no se deshace**;
- cada generador corrige y avanza **el suyo**, porque Fase 1 es individual;
- la SCo **no sale de `SOLICITUD_CONTRATACION` hasta que estén todos de vuelta**, y el
  texto de "Avanzar" dice cuáles faltan.

**No cambies la matriz de 18 × 7.**

**Test:** con una SCo de 3 expedientes:

- avanzar uno → se mueven los tres;
- uno sin cumplir → no se mueve ninguno y se lo nombra;
- devolver a Fase 1 → vuelven los tres y la SCo sigue;
- una escritura que falla a la mitad (simulada) → quedan todos como estaban.

### Pieza 5 · Un ANEXO I por SCo, con los renglones sumados · commit: `Ronda 27 · ANEXO I por SCo`

**Dónde:** hoy el ANEXO 1 es por expediente. Los datos van en `anexo1.*` de cada uno
(`views/anexo-uno.js`) y el documento se arma en `renders/anexo-1.js:160`.

**Cambia:**

- **Los datos del ANEXO I viven en el registro de la SCo.** Se editan desde cualquier
  expediente miembro, con `versionEsperada`.
- **El documento consolida los renglones de todos los miembros.** El mismo código de
  catálogo va en **un solo renglón con la cantidad sumada**, y debajo el desglose por
  unidad solicitante: *"GOE: 10 · Grupo Base 7: 5"*.
- Se guarda como entregable **de la SCo**. `ANALISIS_SCo` exige el ANEXO I de la SCo,
  y se valida en la pieza 4.
- Los expedientes que ya tienen `anexo1.*` propio: se usa como punto de partida del de
  la SCo si la SCo tiene uno solo. **Si tiene varios, se decide en el informe.**

**Test:**

- dos requerimientos que piden el mismo código → un renglón sumado con el desglose;
- sin ANEXO I de la SCo → no se avanza de `ANALISIS_SCo`.

### Pieza 6 · El tablero muestra la SCo · commit: `Ronda 27 · tablero por SCo`

**Cambia:** desde que la SCo sale de `SOLICITUD_CONTRATACION`, el tablero muestra **una
tarjeta por SCo**, con sus requerimientos adentro. El expediente dice arriba *"Parte de
la SCo 123/2026, con 2026-003 y 2026-007"*.

**Test:** una SCo de 2 avanzada → una tarjeta con los 2; antes de avanzar → dos
tarjetas.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-27.md`**, con las nueve secciones, y además:
   - las piezas con su hash;
   - qué no entró y por qué;
   - los tests que levantan procesos (pieza 2);
   - qué se hizo con los `anexo1.*` viejos (pieza 5);
   - el ADR-043 asentado en `BITACORA_DECISIONES.md`, con el texto de
     `ordenes/ADR-PROPUESTA-AGRUPAMIENTO.md`.
2. Commit `Ronda 27 · informe` → `git push`.
3. `git clone https://github.com/contra3000/Contrataciones.git ..\auditoria\ciclo-27`.
   Si la carpeta existe, no se toca y se avisa.
4. `git -C ..\auditoria\ciclo-27 log --oneline -1` = `git log --oneline -1` en `dev\`.
   Las dos líneas van al final del informe, **ya con el commit final**.

## Tu prueba de 10 minutos · para el Jefe, al cerrar · **cubre también la ronda 26**

1. Cerrá la ventana negra y abrí `Iniciar SGC.bat` dos veces seguidas → **la primera
   arranca sin quejarse**. La segunda dice que la carpeta está en uso.
2. Creá **dos requerimientos nuevos** (generador), cada uno con dos presupuestos y dos
   valores por renglón, **y al menos un ítem igual en los dos**. Avanzalos.
3. Como abastecimiento, abrí uno → "Avanzar" está deshabilitado y dice **"Falta: número
   de SCo"**, y el panel "Datos" muestra el número de expediente sin guiones. Poneles
   **el mismo número de SCo** a los dos → avanzá uno → **se mueven los dos**.
4. Generá el ANEXO I → **el ítem repetido está en un solo renglón, sumado, con el
   desglose**. ¿Lo firmarías?
5. En el tablero → **una tarjeta para la SCo**.

## Pasa a la ronda 28

- **El proceso**: el mismo patrón en Confección de proyectos, identificado por el
  número de procedimiento de COMPR.AR, con el pliego consolidado.
- Después: la matriz de permisos, el entorno de prueba, "cantidad máxima = total",
  las ayudas de los campos (cuando el Jefe corrija el borrador), los topes de B2,
  `estado-ciclo` y el logo.

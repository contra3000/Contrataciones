# ADR-043 (propuesta) — Del requerimiento al trámite: agrupamiento por SCo y por proceso

SGC · 2026-09-29 · revisor · **Estado: propuesta.** Se asienta en `BITACORA_DECISIONES.md` cuando se implemente (ronda 27).

---

## Contexto

Hasta hoy **cada expediente es un requerimiento** y recorre solo los 18 estados. El Jefe de Contrataciones definió el 29/09 cómo es el circuito real:

1. **Fase 1:** cada requerimiento es individual. Lo arma su generador.
2. **SCo:** la Solicitud de Contratación se arma en **COMPR.AR**. Abastecimiento carga en la aplicación el **número de SCo**, que **puede juntar varios requerimientos**. Lo firmable es el **ANEXO I, uno por SCo**. *"Desde ahí en adelante quedan juntados los requerimientos que queden asociados en una misma SCo."*
3. **Proceso:** *"Cuando Contrataciones recibe dos SCo similares las puede juntar en un mismo proceso, y desde ahí en adelante corren juntas en ese proceso licitatorio."* Esto pasa en **Confección de proyectos** (paso 6).

Y tres reglas que dio el mismo día:

- **Devolución:** si hay que corregir un requerimiento de una SCo, **vuelve toda la SCo**.
- **Mismo ítem en dos requerimientos:** en el ANEXO I va **un solo renglón con la cantidad sumada**, y se sabe qué parte pidió cada unidad.
- **Proceso:** se arma en **Confección de proyectos**.

## Decisión

**El expediente sigue siendo la unidad que se guarda. Arriba de él aparecen dos agrupamientos que se mueven juntos.** No se cambia la matriz de 18 × 7: cambia **quién se mueve** cuando alguien aprieta "Avanzar".

### 1 · La SCo

- **Registro propio:** `datos/sco/<año>/<numeroSCo>.json`, con:
  - `numeroSCo` y `expedientes: [ids]`;
  - `entregables`, donde va el **ANEXO I de la SCo**;
  - `version` y `auditoria`.
- **Se forma en `SOLICITUD_CONTRATACION`.** Abastecimiento carga el mismo número en varios expedientes (ronda 26) y el servidor mantiene la lista.
  - Un requerimiento **sólo se suma** a una SCo que esté en ese estado.
  - Mientras la SCo no avanzó, **se puede sacar** un requerimiento cambiándole el número.
- **Desde que la SCo avanza, se mueve en bloque:**
  - avanzar o devolver cualquiera de sus expedientes **mueve a todos**, con escritura **todo o nada** bajo un mismo candado;
  - si uno no cumple, no se mueve ninguno, y el mensaje dice cuál y por qué;
  - cada expediente registra el evento con `grupo: "SCo <número>"`.
- **Devolución en bloque, también a Fase 1.** Si la SCo vuelve a Especificaciones Técnicas:
  - todos sus requerimientos vuelven, **la SCo no se deshace**, y cada generador corrige y avanza el suyo;
  - la SCo no puede salir de `SOLICITUD_CONTRATACION` **hasta que estén todos de vuelta** ahí.
- **ANEXO I por SCo:**
  - se genera con los renglones de todos sus requerimientos;
  - **el mismo código de catálogo es un solo renglón con la cantidad sumada**, y debajo, el desglose: *"GOE: 10 · Grupo Base 7: 5"*;
  - se guarda como entregable **de la SCo**, y `ANALISIS_SCo` exige **el ANEXO I de la SCo**.

### 2 · El proceso

- **Mismo patrón, un nivel más arriba:** `datos/procesos/<año>/<id>.json`, con `id`, `scos: [números]`, `entregables`, `version` y `auditoria`.
- **Se forma en `CONFECCION_PROYECTOS`.** Contrataciones asocia SCo que estén en ese estado.
- **Desde que el proceso avanza, se mueven en bloque todos los expedientes de todas sus SCo.**
- El pliego y el YAML se arman **por proceso**, con la misma regla de sumar renglones iguales.

### 3 · Lo que ve la gente

- **El tablero:**
  - hasta la SCo, una tarjeta por requerimiento;
  - desde la SCo, **una tarjeta por SCo**, con sus requerimientos adentro;
  - desde el proceso, **una tarjeta por proceso**.
- **El expediente** dice arriba *"Parte de la SCo 123/2026, con 2026-003 y 2026-007"* y después *"Parte del proceso …"*.
- **"Avanzar"** —con el aviso de la ronda 26— explica qué falta **en todo el grupo**.

## Por qué así y no de otra forma

- **No se convierte la SCo en un expediente nuevo.** Todo lo que ya existe se apoya en el expediente individual: la matriz, los permisos, las versiones, los eventos, los 9 caminos y 450 tests. Rehacerlo sería reescribir el sistema. Con el grupo arriba, **lo existente sigue valiendo** y sólo se agrega quién se mueve junto.
- **Todo o nada.** Un grupo a medio avanzar deja expedientes en estados distintos para el mismo trámite, y eso es peor que no avanzar.
- **El registro del grupo guarda lo que es del grupo**: el ANEXO I y el pliego. Así no hay que copiarlo en cada expediente y que después diverja.

## A confirmar por el Jefe

1. **¿Qué identifica al proceso?** Propuesta: el **número de procedimiento de COMPR.AR**, el mismo que va al pliego como `nro_procedimiento`.
2. **¿En el pliego también se suman los renglones iguales de distintas SCo?** Propuesta: sí, con la misma regla del ANEXO I.

## Rondas

- **26:** el número de SCo por expediente, y ver quién más está en la SCo.
- **27:** el registro de la SCo, el movimiento en bloque —avanzar y devolver—, el ANEXO I consolidado, `ANALISIS_SCo` exigiéndolo, y el tablero por SCo.
- **28:** el proceso, con el mismo patrón en Confección de proyectos, y el pliego consolidado.
- **Después:** la matriz de permisos, que ya incluye las operaciones de grupo.

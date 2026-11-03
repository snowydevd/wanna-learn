---
name: check
description: Revisa el código que escribió el usuario para el paso actual de la guía de want-to-learn y, si está bien, avanza al siguiente paso. Usar cuando el usuario escribe /check o dice que terminó un paso de la guía.
---

# Revisar el paso actual

1. Leé `.want-to-learn/guia.json`. Si no existe, decí que no hay una guía activa y que se empieza con `/want-to-learn <pedido>`.
2. Ubicá el paso `pasos[pasoActual]` y leé su archivo, objetivo y criterios de revisión. Si es `crear-archivo`, solo verificá que el archivo exista.
3. Leé el código que escribió el usuario. Si el proyecto tiene chequeos baratos y relevantes (typecheck, lint del archivo), podés correrlos para confirmar, pero no modifiques nada.
4. Evaluá contra los criterios del paso. Ser estricto con lo que rompe el comportamiento; flexible con el estilo. Si lo resolvió de otra forma que también funciona y respeta las convenciones del proyecto, **está bien**: decíselo y, si vale la pena, mencioná la alternativa como dato.

## Si está bien

- Decí qué hizo bien, concretamente (1 a 3 líneas).
- Si hay algo menor mejorable que no bloquea, mencionalo como sugerencia opcional.
- En `guia.json`: en el paso, `hecho: true` y `ultimaRevision` con el resultado; sumá 1 a `pasoActual` y poné `nivelPista: 0` en el siguiente. El JSON tiene que seguir siendo válido.
- Mostrá el siguiente paso con el formato de "Cómo mostrar un paso" del skill `want-to-learn`.
- Si era el último paso: felicitalo, resumí en 3 a 5 líneas qué aprendió (los conceptos que aparecieron) y sugerí cómo probar el cambio funcionando. Marcá la guía como terminada (`terminada: true`, `pasoActual` = cantidad de pasos) y guardá el resumen en `resumen`.

## Si hay que corregir

- Señalá cada problema con archivo y línea, y explicá **por qué** está mal (qué pasaría al correrlo).
- Decí qué tiene que cambiar en términos de comportamiento, sin escribir el código corregido.
- Si el error viene de no entender un concepto, explicá el concepto de nuevo de otra forma.
- Guardá el resultado en `ultimaRevision` del paso, sin avanzar `pasoActual`. Terminá con: "Corregilo y volvé a escribir `/check`."

## Reglas

- No edites archivos de código, aunque el arreglo sea de un carácter. Solo `.want-to-learn/guia.json`.
- No muestres la solución completa del paso.

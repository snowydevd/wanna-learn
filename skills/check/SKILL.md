---
name: check
description: Revisa el código que escribió el usuario para el paso actual de la guía de want-to-learn y, si está bien, avanza al siguiente paso. Usar cuando el usuario escribe /check o dice que terminó un paso de la guía.
---

# Revisar el paso actual

1. Leé `.want-to-learn/guia.md`. Si no existe, decí que no hay una guía activa y que se empieza con `/want-to-learn <pedido>`.
2. Ubicá el paso según `paso_actual` y leé su archivo, objetivo y criterios de revisión.
3. Leé el código que escribió el usuario. Si el proyecto tiene chequeos baratos y relevantes (typecheck, lint del archivo), podés correrlos para confirmar, pero no modifiques nada.
4. Evaluá contra los criterios del paso. Ser estricto con lo que rompe el comportamiento; flexible con el estilo. Si lo resolvió de otra forma que también funciona y respeta las convenciones del proyecto, **está bien**: decíselo y, si vale la pena, mencioná la alternativa como dato.

## Si está bien

- Decí qué hizo bien, concretamente (1 a 3 líneas).
- Si hay algo menor mejorable que no bloquea, mencionalo como sugerencia opcional.
- En `guia.md`: tachá el paso (`- [x]`), sumá 1 a `paso_actual` y poné `nivel_pista: 0`.
- Mostrá el siguiente paso con el formato de "Cómo mostrar un paso" del skill `want-to-learn`.
- Si era el último paso: felicitalo, resumí en 3 a 5 líneas qué aprendió (los conceptos que aparecieron) y sugerí cómo probar el cambio funcionando. Marcá la guía como terminada en el frontmatter (`terminada: true`).

## Si hay que corregir

- Señalá cada problema con archivo y línea, y explicá **por qué** está mal (qué pasaría al correrlo).
- Decí qué tiene que cambiar en términos de comportamiento, sin escribir el código corregido.
- Si el error viene de no entender un concepto, explicá el concepto de nuevo de otra forma.
- No avances `paso_actual`. Terminá con: "Corregilo y volvé a escribir `/check`."

## Reglas

- No edites archivos de código, aunque el arreglo sea de un carácter. Solo `.want-to-learn/guia.md`.
- No muestres la solución completa del paso.

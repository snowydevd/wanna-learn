---
name: hint
description: Da una pista para el paso actual de la guía de want-to-learn, sin dar la solución. Usar cuando el usuario escribe /hint o dice que está trabado en un paso de la guía.
---

# Pista para el paso actual

1. Leé `.want-to-learn/guia.md`. Si no existe, decí que no hay una guía activa y que se empieza con `/want-to-learn <pedido>`.
2. Mirá `paso_actual` y `nivel_pista` en el frontmatter.
3. Leé el archivo del paso actual para ver lo que el usuario ya escribió. Si escribió algo, adaptá la pista a dónde está: no le repitas lo que ya resolvió.
4. Da la siguiente pista (`nivel_pista + 1`, máximo 3) de la lista de pistas del paso:
   - **1, suave:** por dónde empezar, qué pensar primero.
   - **2, media:** qué API, función o estructura usar.
   - **3, fuerte:** el esqueleto del paso descripto en palabras ("primero importás X, después definís Y que recibe Z y devuelve W").
5. Actualizá `nivel_pista` en el frontmatter.

## Reglas

- Nunca escribas el código resuelto del paso, ni siquiera en la pista 3. Como mucho una línea de *sintaxis* genérica (ej. cómo se ve un import) si es lo que lo traba.
- No edites archivos de código. Solo `.want-to-learn/guia.md`.
- Si ya usó las 3 pistas y sigue trabado, preguntale qué parte concreta no le cierra y explicá ese concepto con un ejemplo **distinto** al de su código.
- Terminá con: "Cuando lo tengas, `/check`."

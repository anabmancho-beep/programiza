# Programiza

Aplicación web en español para equipos educativos de centros que atienden a personas con discapacidad física, psíquica o sensorial, o con trastornos que limitan su vida diaria. Permite crear programaciones anuales, mensuales, semanales y diarias personalizadas, hacer su seguimiento y preparar informes de evolución.

**Aplicación publicada:** https://programiza.lovable.app

> Es un prototipo del Big School Hackathon de Vibe Coding (edición 7). Solo contiene datos ficticios y no debe usarse con datos reales sin la revisión del delegado de protección de datos del centro.

## Qué hace

- Programaciones en cuatro niveles enlazados (anual, mensual, semanal y diaria), con plantillas y "Duplicar semana".
- Ficha de la persona con seudónimo, perfil funcional y consentimiento registrado.
- Sugerencias con IA como borrador, siempre revisadas y aprobadas por una persona.
- Seguimiento de resultados, gráficos de evolución, informes con IA y exportación a PDF.
- Biblioteca básica de 500 pictogramas (emojis Unicode) y pictogramas propios del centro.
- Lectura fácil, acceso de familias en solo lectura, registro de conductas y salud (solo profesionales).
- Vista "Hoy" para móvil con modo sin conexión.
- Varios centros con los datos siempre separados.

## Privacidad

Los datos de salud son categoría especial del RGPD (art. 9). La aplicación identifica a las personas con un código, aísla los datos por centro con seguridad por filas, bloquea el guardado de datos sin consentimiento otorgado y no envía datos identificativos a la IA.

## Tecnología

React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Start, Lovable Cloud (PostgreSQL con Supabase) y Lovable AI. Todo el código lo ha generado el agente de Lovable a partir de prompts.

## Cómo probarla

Abre la aplicación publicada, inicia sesión con el usuario de prueba indicado en la documentación técnica y pulsa "Cargar datos de ejemplo".

## Documentación

La documentación técnica y el historial de prompts están en la carpeta de entrega del hackatón.

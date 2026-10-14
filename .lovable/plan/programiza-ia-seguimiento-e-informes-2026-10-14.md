# Programiza: IA, seguimiento e informes

Todo lo nuevo se suma a lo que ya existe. No se cambia el funcionamiento actual: los objetivos en texto libre siguen ahí y las fichas, programaciones, banco y registro de accesos se mantienen igual.

## 1. Objetivos medibles
- Cada programación tiene una lista de objetivos estructurados con estos campos: descripción concreta, área, indicador (cómo se mide), criterio de logro (por ejemplo «8 de 10 sesiones») y fecha límite.
- Un objetivo mensual puede colgar de uno anual, y así hacia abajo, igual que las programaciones.
- Cada actividad puede vincularse a un objetivo. Así el seguimiento sabe a qué objetivo cuenta.
- Los objetivos que ya existen en texto libre se muestran como hasta ahora. Habrá un botón «Convertir en objetivos medibles».

## 2. Sugerir con IA (en cada programación)
- El botón «Sugerir con IA» abre una ventana con la propuesta: objetivos medibles, actividades con pasos, nivel de apoyo, duración y ritmo (sesiones por semana).
- Todo entra como **Borrador**, con la marca visible «Generado con IA».
- Cada elemento tiene los botones «Aprobar», «Editar» y «Descartar». Al aprobar se guarda quién lo aprobó y cuándo.
- Los borradores no salen en agendas, PDF ni informes hasta que se aprueban.
- Si el perfil requiere criterio clínico, la IA lo indica y remite al profesional. Nunca diagnostica ni recomienda tratamientos.

### Qué se envía a la IA (lo elige el servidor, no el navegador)
- Se envía solo:
  - el tipo principal de discapacidad o trastorno;
  - el rango de edad;
  - el nivel de autonomía de cada área (higiene, alimentación, etc.);
  - el nivel de la programación (anual, mensual…);
  - el área si se elige una.
- **No se envía nunca**:
  - el seudónimo o código;
  - el nombre del centro;
  - el diagnóstico;
  - los textos libres (apoyos, comunicación, gustos, sensibilidades, rutinas, observaciones);
  - fechas exactas, nombres de usuarios ni identificadores internos.
- El servidor construye ese envío partiendo de cero, con solo los campos permitidos. No acepta nada que mande el navegador.

## 3. Seguimiento
- En cada actividad aprobada hay un botón «Registrar resultado» con:
  - fecha;
  - resultado: lograda, lograda con apoyo, no lograda o no realizada;
  - nivel de apoyo usado;
  - observaciones, con el aviso de no escribir nombres.
- La ficha de la persona tiene una pestaña nueva, **Evolución**:
  - gráfico de evolución por objetivo (porcentaje de logro a lo largo del tiempo);
  - gráfico por área;
  - comparación entre dos meses que tú eliges;
  - lista de los últimos registros.
- Abrir la evolución y registrar resultados quedan en el registro de accesos.

## 4. Informes de evolución
- En la ficha de la persona: «Nuevo informe», donde se elige el periodo (desde y hasta).
- El servidor calcula las cifras reales: número de registros, porcentaje por resultado, por objetivo y por área.
- La IA solo redacta el texto a partir de esas cifras. Se le pide que no invente datos, y si faltan lo dice: «No hay registros de seguimiento para…».
- **Las observaciones no se envían a la IA.** Son texto libre y pueden contener datos identificativos, así que el informe solo usa los resultados con su categoría y fecha.
- El informe se guarda como **Borrador IA**. El educador lo revisa, puede editarlo y lo aprueba; se guarda quién y cuándo.
- Las tablas de cifras del informe salen de la base de datos, no de la IA.

## 5. Exportar a PDF
- Botón «Descargar PDF» en:
  - la agenda diaria (secuencia de pasos);
  - la agenda semanal (cuadrícula de días y franjas);
  - los informes aprobados.
- Cada página lleva este pie: «Documento confidencial. Contiene datos de salud. Uso exclusivo del centro.», con la fecha y el número de página.
- El PDF identifica a la persona solo por su código; nunca aparece el diagnóstico en las agendas.
- Cada descarga queda en el registro de accesos.

## 6. Seguridad y registro
- Las tablas nuevas tienen la misma separación por centro, solo para el equipo del centro, y sin recursión entre permisos.
- El registro de accesos guarda acciones nuevas: «sugerencia IA», «seguimiento», «informe» y «exportar PDF».
- La página de Privacidad y datos se amplía con una sección «Uso de IA» que explica exactamente qué se envía y qué no.

## Qué probar a mano (al terminar)
1. En una programación de P-014, pulsa «Sugerir con IA». Comprueba que llegan borradores con la marca «Generado con IA» y apruébalos.
2. Registra varios resultados en actividades de semanas distintas y mira la pestaña Evolución.
3. Genera un informe de un mes sin datos: debe decir que faltan datos. Después, uno con datos.
4. Descarga en PDF la agenda del martes, la semana y el informe, y revisa el pie.
5. En Centro y equipo, mira que aparecen las acciones nuevas en el registro de accesos.

## Detalles técnicos
- **Base de datos (añadidos):**
  - `plan_objectives`: plan, objetivo superior, área, descripción, indicador, criterio, fecha límite, `ai_generated`, `status` (borrador/aprobado), `approved_by`, `approved_at`.
  - `plan_activities`: nuevos campos `objective_id`, `ai_generated`, `status`, `approved_by`, `approved_at`. Las actividades que ya existen quedan como aprobadas.
  - `activity_results`: actividad, fecha, resultado (enum), apoyo usado, observaciones, autor.
  - `reports`: persona, periodo, cifras en jsonb, texto, `ai_generated`, `status`, aprobación.
  - RLS con `current_center_id()` e `is_staff()`, GRANT a `authenticated`, y triggers para que `center_id` coincida con su programación o persona.
  - Ampliar `log_access` con las acciones nuevas.
  - Una función segura `approve_item(tipo, id)` que pone `approved_by = auth.uid()` y `approved_at = now()`, para que no se pueda falsear la autoría.
- **Servidor:** dos `createServerFn` con `requireSupabaseAuth`, `suggestPlan(planId, area?)` y `draftReport(personId, from, to)`. Leen con el cliente del usuario (con RLS), construyen el envío con una lista blanca de campos y llaman a Lovable AI con salida estructurada (esquema JSON). Errores 402/429 mostrados en español.
- **Modelo:** el de por defecto de Lovable AI, con razonamiento bajo. Un aviso del sistema prohíbe diagnosticar, recomendar tratamientos o inventar datos.
- **Gráficos:** recharts (ya incluido en el proyecto).
- **PDF:** `jspdf` y `jspdf-autotable`, generados en el navegador a partir de datos ya aprobados.

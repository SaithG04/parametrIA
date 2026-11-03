export const TERMS_VERSION = "2026-11-02-v1";
export const PRIVACY_VERSION = "2026-11-02-v1";
export const PRIVACY_CONTACT = "isai.quiroga.2004@gmail.com";
export const DATA_RETENTION = {
  sourceDocumentDays: 30,
  evaluationReportMonths: 12,
} as const;

export const TERMS_OF_SERVICE = `# Términos de uso de ParametrIA

**Versión ${TERMS_VERSION} · Vigentes desde el 2 de noviembre de 2026**  
**Operador:** SaithG04, Perú.

## 1. Para qué sirve el servicio

ParametrIA ayuda a organizar cursos, recibir trabajos y preparar informes de evaluación con apoyo de inteligencia artificial. El informe es una herramienta de consulta: no reemplaza la lectura del docente, su criterio profesional ni la decisión académica de la institución.

## 2. Cuentas y uso responsable

Las cuentas son habilitadas por el administrador del sistema. Cada persona debe mantener sus credenciales en reserva, usar solo su cuenta y comunicar cualquier acceso que no reconozca. No se debe intentar acceder a aulas, documentos o datos que no correspondan a la propia función.

## 3. Trabajos y evaluación con IA

Al enviar un documento, el estudiante declara que está autorizado a compartirlo para la evaluación académica. El documento y las instrucciones de evaluación se procesan con el proveedor y el modelo configurados por el docente. Ese proveedor recibe el contenido necesario para generar la respuesta y aplica sus propias condiciones y prácticas de datos.

Una respuesta automática puede contener errores, omisiones o interpretaciones discutibles. El docente debe revisar el informe antes de usarlo para calificar, orientar o tomar decisiones sobre un estudiante. ParametrIA no determina por sí sola una nota, una sanción ni la existencia de plagio.

## 4. Credenciales de proveedores

El docente es responsable de usar una credencial autorizada por el proveedor de IA y de revisar sus límites, costos y condiciones. ParametrIA cifra las credenciales guardadas en el sistema y las utiliza para solicitar el servicio configurado. Las claves personales ingresadas para continuar una evaluación se mantienen cifradas mientras se procesa el trabajo y se eliminan del registro de esa tarea al completarse o fallar.

El cifrado reduce el riesgo, pero ningún servicio conectado a Internet puede garantizar que una credencial esté libre de todo riesgo. Protege tus dispositivos y avísanos si sospechas que una clave fue expuesta.

## 5. Disponibilidad y cambios

El servicio puede recibir mantenimiento, cambios o interrupciones. Procuraremos informar cambios relevantes en la plataforma. Una nueva versión de estos términos se presentará para aceptación antes de continuar usando la cuenta.

## 6. Contacto y ley aplicable

Para consultas sobre estas condiciones, escribe a ${PRIVACY_CONTACT}. El servicio es operado desde Perú y se sujeta a la legislación peruana aplicable.`;

export const PRIVACY_POLICY = `# Política de privacidad de ParametrIA

**Versión ${PRIVACY_VERSION} · Vigente desde el 2 de noviembre de 2026**  
**Responsable del servicio:** SaithG04, Perú.  
**Contacto para privacidad:** ${PRIVACY_CONTACT}.

## Información que tratamos

La plataforma procesa datos de cuenta (nombre, correo, rol e institución), membresías de cursos y aulas, documentos académicos enviados, rúbricas, informes generados, configuración de evaluación y credenciales de proveedores de IA. También registra datos técnicos necesarios para la seguridad y operación, como dirección IP, ruta solicitada, resultado y duración de las solicitudes.

## Para qué la usamos

Usamos esta información para autenticar cuentas, organizar el trabajo académico, procesar evaluaciones, mostrar informes a estudiantes y docentes autorizados, mantener la seguridad y atender solicitudes de soporte.

## Procesamiento por proveedores externos

Cuando se solicita una evaluación, el documento y las instrucciones pertinentes se envían al proveedor de IA seleccionado por el docente. El proveedor procesa esos datos de acuerdo con sus propias condiciones y políticas. Antes de usar la plataforma, el docente debe revisar que el proveedor y el tipo de información compartida sean apropiados para su curso e institución. No afirmamos que todos los proveedores tengan las mismas prácticas de retención o entrenamiento.

Los documentos y datos técnicos también pueden ser tratados por los servicios de infraestructura, almacenamiento y correo necesarios para operar ParametrIA.

## Credenciales de IA

Las claves guardadas por docentes se cifran con AES-256-GCM antes de almacenarse. Las claves BYOK se cifran durante el procesamiento en cola y se borran del registro de la tarea cuando esta termina o falla. Las claves del docente permanecen hasta que este las elimine o se cierre la cuenta. El acceso al servidor y a su clave maestra de cifrado sigue siendo un riesgo que el operador debe proteger.

## Plazos de conservación

- El documento original se elimina automáticamente 30 días después de que su evaluación quede completada o fallida.
- El informe y los datos de la evaluación se eliminan automáticamente a los 12 meses de su creación.
- Los datos de cuenta y las credenciales se conservan mientras la cuenta esté activa. Para solicitar acceso, corrección o eliminación, escribe al contacto de privacidad; algunas copias podrán conservarse cuando una obligación legal lo requiera.
- Los registros técnicos se conservan de forma limitada para operar y proteger el servicio.

## Cookies

ParametrIA usa una cookie técnica, HttpOnly y Secure en producción, necesaria para mantener la sesión iniciada. No usamos cookies de publicidad ni de analítica. El aviso de cookies solo guarda en este navegador que ya fue mostrado; esa preferencia no habilita seguimiento.

## Tus solicitudes

Puedes escribir a ${PRIVACY_CONTACT} para consultar qué información se trata o solicitar su corrección o eliminación. Incluye el correo de tu cuenta y una descripción de la solicitud; no envíes contraseñas ni claves de API.`;

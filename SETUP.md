# Puesta en marcha — Espacio equipo Rumeur

La web (https://alexrumeur.github.io/radar-rumeur/) es pública, pero **no contiene ningún dato interno**:
el Radar sigue abierto y las pestañas Assistant, Projets, Admin y Office solo funcionan tras iniciar sesión con una cuenta **@rumeur.paris**.
Cada petición pasa por un backend Google Apps Script que vuelve a verificar la cuenta antes de leer o escribir nada en Drive, Sheets o Gmail.

```
github.io (index.html + team.js)  ──login Google @rumeur.paris──►  Apps Script (backend/Code.gs)
                                                                    ├─ Drive « RUMEUR — AI BACK OFFICE »
                                                                    ├─ Sheets (registros, compras, cumpleaños, PO, facturas, entregas)
                                                                    ├─ Gmail de ai@rumeur.paris (borradores, búsquedas)
                                                                    └─ API de Claude (chat + acciones)
```

Tiempo estimado: 30–40 minutos, una sola vez.

## 1. Cuenta que ejecuta el backend

Usa **ai@rumeur.paris**: es la cuenta que ya está en copia de los mails de clientes y la que usan las tareas automáticas de PO y entregas.
Comprueba que ai@ tiene acceso de **editor** a:

- la carpeta « RUMEUR — AI BACK OFFICE » (hoy pertenece a alma@ → Compartir → ai@rumeur.paris, Editor)
- « Suivi livraisons clients », « Suivi PO clients », « Récap factures fournisseurs » y la carpeta « Factures fournisseurs »

## 2. ID de cliente Google (para el botón « Iniciar sesión con Google »)

1. https://console.cloud.google.com → crea un proyecto « Rumeur Espace équipe » (con ai@ o con la cuenta admin de Workspace).
2. **APIs y servicios → Pantalla de consentimiento OAuth** → tipo **Interno** (solo cuentas rumeur.paris) → nombre « Rumeur », email de soporte → guardar.
3. **Credenciales → Crear credenciales → ID de cliente OAuth** → tipo **Aplicación web**.
   - Orígenes de JavaScript autorizados: `https://alexrumeur.github.io`
   - No hace falta URI de redirección.
4. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

## 3. Clave de API de Claude

1. https://console.anthropic.com con una cuenta de la empresa → Billing: añade un método de pago y un límite mensual (p. ej. 50 €).
2. **API keys → Create key** → nómbrala « rumeur-espace-equipe » y cópiala.

Coste orientativo: unos céntimos por petición sencilla, 0,10–0,30 € por un brief completo con creación de carpeta.

## 4. Backend Apps Script

1. Conectado como **ai@rumeur.paris**, abre https://script.new → renombra el proyecto « Rumeur — backend espace équipe ».
2. Borra el contenido de `Code.gs` y pega el de [`backend/Code.gs`](backend/Code.gs).
3. **Configuración del proyecto** (rueda dentada) → marca « Mostrar el archivo de manifiesto appsscript.json » → vuelve al editor y pega el contenido de [`backend/appsscript.json`](backend/appsscript.json).
4. **Configuración del proyecto → Propiedades del script** → añade:

   | Propiedad | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | la clave del paso 3 |
   | `GOOGLE_CLIENT_ID` | el ID de cliente del paso 2 |
   | `ALLOWED_DOMAIN` | `rumeur.paris` |
   | `MODEL` | `claude-sonnet-5-5` (o `claude-opus-5-5` para más calidad, más caro) |
   | `DIGEST_MODE` | `draft` durante la primera semana (crea borradores en ai@ para revisar), luego `send` |
   | `RUMEUR_INFOS` | `{"RUMEUR_FORME_SOCIALE":"SAS","RUMEUR_CAPITAL":"…","RUMEUR_RCS_VILLE":"Paris","RUMEUR_SIREN":"…","RUMEUR_ADRESSE":"…","RUMEUR_SIGNATAIRE":"…","RUMEUR_SIGNATAIRE_QUALITE":"Président"}` |

5. En el editor, elige la función **`testerAcces`** → **Ejecutar** → autoriza los permisos (Drive, Docs, Sheets, Gmail). El registro debe listar todas las hojas sin error.
6. Elige **`installerRappels`** → **Ejecutar**: instala el digest del lunes (8:40) y el aviso diario de cumpleaños (9:05).
7. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo (ai@rumeur.paris)**
   - Quién tiene acceso: **Cualquier usuario** (la seguridad la hace la verificación del login dentro del código; sin esto, el navegador no puede llamar al backend desde github.io)
   - Copia la **URL de la aplicación web** (termina en `/exec`).

> Cada vez que se modifique `Code.gs`: **Implementar → Gestionar implementaciones → editar → Versión: nueva**, para conservar la misma URL.

## 5. Conectar la web

Edita [`config.js`](config.js) en GitHub (o pásame los dos valores y lo hago yo):

```js
API_URL: "https://script.google.com/macros/s/……/exec",
GOOGLE_CLIENT_ID: "……apps.googleusercontent.com",
```

GitHub Pages se actualiza en 1–2 minutos. Ninguno de los dos valores es secreto: la clave de Claude solo vive en Apps Script.

## 6. Rellenar los datos de base

- **Annuaire équipe & anniversaires**: una línea por persona (email @rumeur.paris, cumpleaños JJ/MM, preferencias). Sin esto no hay digest ni avisos.
- **Achats bureau**: proveedor, enlace y cantidad habitual de cada artículo.
- **Modelos NDA / contrato** (carpeta 01 · ADMIN → Modèles): validarlos con el abogado o sustituirlos por los vuestros manteniendo los campos `{{…}}`.

## 7. Probar la beta

1. Abre la web → pestaña **Assistant** → conéctate con tu cuenta @rumeur.paris.
2. « Qu'est-ce qui arrive cette semaine ? » → debe leer todas las hojas.
3. Pega unas notas de call → revisa la ficha → « oui, crée le projet » → comprueba la carpeta en Drive.
4. « Prépare un NDA pour … » → comprueba el Doc y el PDF en 01 · ADMIN → NDA prestataires.
5. Pestaña **Office** → « Il en manque » en el café → la hoja Achats debe marcar « oui ».

Las ideas y fallos del equipo se recogen en Office → « Une idée pour l'assistant ? » (hoja « Boîte à idées skills & journal assistant »).

## Seguridad

- Login Google limitado a `rumeur.paris`, verificado **en el servidor** (firma, audiencia, dominio, caducidad) en cada llamada.
- La web pública no contiene datos internos; el historial del chat se guarda solo en la pestaña del navegador (sessionStorage).
- El asistente crea **borradores** de mail; solo envía directamente a direcciones @rumeur.paris y tras confirmación. Nunca comparte archivos fuera del dominio.
- Las hojas alimentadas por las tareas automáticas (Livraisons, Suivi PO, Factures) son de solo lectura para el asistente.
- Firmas (Yousign), pagos y pedidos los hace siempre una persona.

## Nota para la actualización semanal del Radar

El Radar sigue en `index.html` (los datos en la línea `rows=[…]`). La tarea que lo actualiza cada lunes debe **sustituir solo esa línea y el `<title>`**, sin regenerar el archivo entero, o se perderían las pestañas del espacio equipo. El código del espacio equipo está aparte, en `team.js`, `team.css` y `config.js`.

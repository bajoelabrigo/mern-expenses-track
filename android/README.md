# App Android (Trusted Web Activity)

El APK abre la PWA publicada (`https://controldegastosiglesia.netlify.app`) a
pantalla completa. **Los cambios de la app web llegan solos al APK** con cada
despliegue de Netlify: solo hace falta un APK nuevo si cambia algo de Android
(nombre, icono, colores, paquete, atajos).

Proyecto generado con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
(`@bubblewrap/core`) a partir de `twa-manifest.json`.

## Datos fijos

| | |
|---|---|
| Paquete | `com.controldegastos.app` (no se puede cambiar si se publica en Play) |
| Versión actual | 1.3.0 (versionCode 4), icono nuevo y avisos de la web como notificaciones de la app |
| Clave de firma | `C:\Users\bajoe\android-keys\control-gastos.keystore`, alias `controldegastos` |
| Contraseña | en `C:\Users\bajoe\android-keys\LEEME-clave-apk.txt` |
| Huella SHA-256 | `F4:F5:EC:B4:76:EB:78:0F:39:4D:5F:66:EA:F4:95:11:46:BD:DA:2B:41:7D:FA:48:38:AE:E9:C8:7D:DE:51:40` |

**La clave y su contraseña no están en el repositorio (es público).** Sin ellas
no se pueden publicar actualizaciones de la app: guarda una copia de seguridad.

La huella está publicada en `frontend/public/.well-known/assetlinks.json`. Si
no coincide con la clave que firma el APK, Android abre la app con una barra
de dirección arriba (como un navegador).

## Compilar una versión nueva

Requisitos: JDK 17 y el SDK de Android (`android/local.properties` con
`sdk.dir=C:/Users/bajoe/AppData/Local/Android/Sdk`, con barras normales).

1. Sube `appVersionCode` (entero, +1) y `appVersionName` en
   `twa-manifest.json` y en `app/build.gradle`. Los colores de las barras de
   Android también están en los dos archivos.
   Si cambió el icono (el maestro es `frontend/scripts/icono-fuente.png`):
   `node frontend/scripts/generar-iconos.mjs` regenera los de la web y los de
   `app/src/main/res` con los tamaños de cada densidad.
2. Compila:
   ```bash
   ./gradlew assembleRelease
   ```
3. Alinea y firma (build-tools 36):
   ```bash
   BT=$ANDROID_HOME/build-tools/36.0.0
   OUT=app/build/outputs/apk/release
   $BT/zipalign -f -p 4 $OUT/app-release-unsigned.apk $OUT/aligned.apk
   # La contraseña se pasa por variable de entorno para que no quede en el
   # historial ni en la lista de procesos:
   #   export APK_PASS='(la de LEEME-clave-apk.txt)'
   $BT/apksigner sign --ks C:/Users/bajoe/android-keys/control-gastos.keystore \
     --ks-key-alias controldegastos --ks-pass env:APK_PASS --key-pass env:APK_PASS \
     --out $OUT/control-de-gastos-X.Y.Z.apk $OUT/aligned.apk
   $BT/apksigner verify --print-certs $OUT/control-de-gastos-X.Y.Z.apk
   ```
   La huella que imprime `verify` debe ser la de arriba.

4. Publica el archivo en la web, que es de donde lo bajan las iglesias:
   ```bash
   cp app/build/outputs/apk/release/control-de-gastos-X.Y.Z.apk \
      ../frontend/public/descargas/
   git rm ../frontend/public/descargas/control-de-gastos-<versión vieja>.apk
   ```
   y actualiza `version`, `file`, `size` y `date` en
   `frontend/src/lib/appRelease.js`: es lo único que lee la página `/descargas`.
   El APK sí va al repositorio (no lo cubre el `.gitignore` de esta carpeta),
   para que Netlify lo despliegue con el sitio.

## Avisos de la app

`enableNotifications: true` (en `twa-manifest.json` y en `app/build.gradle`)
activa la **delegación de notificaciones**: los avisos de la web se muestran con
la identidad de la app —su icono y su nombre— en vez de los de Chrome. El
`DelegationService` que genera Bubblewrap ya viene en el manifiesto y se
enciende con esa bandera. Necesita el permiso `POST_NOTIFICATIONS` (Android 13
en adelante), declarado en `AndroidManifest.xml`; si la persona no lo concede,
Chrome muestra el aviso por su cuenta, así que no se pierde ninguno.

Los avisos en sí los manda el servidor (ver `VAPID_*` en el README): el APK solo
cambia **cómo se ven**, no hace falta un APK nuevo cada vez que se añade un tipo
de aviso.

## Instalar

Lo normal es bajarlo de la página `/descargas` del sitio. También se puede
pasar el `.apk` al teléfono (WhatsApp, Drive, cable) y abrirlo. Android pedirá
permitir "instalar apps de origen desconocido" para esa app la primera vez.

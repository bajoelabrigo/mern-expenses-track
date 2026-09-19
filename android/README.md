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
   `twa-manifest.json` y en `app/build.gradle`.
2. Compila:
   ```bash
   ./gradlew assembleRelease
   ```
3. Alinea y firma (build-tools 35):
   ```bash
   BT=$ANDROID_HOME/build-tools/35.0.0
   OUT=app/build/outputs/apk/release
   $BT/zipalign -f -p 4 $OUT/app-release-unsigned.apk $OUT/aligned.apk
   $BT/apksigner sign --ks C:/Users/bajoe/android-keys/control-gastos.keystore \
     --ks-key-alias controldegastos --out $OUT/control-de-gastos-X.Y.Z.apk $OUT/aligned.apk
   $BT/apksigner verify --print-certs $OUT/control-de-gastos-X.Y.Z.apk
   ```
   `apksigner` pide la contraseña; la huella que imprime `verify` debe ser la de
   arriba.

## Instalar

Pasa el `.apk` al teléfono (WhatsApp, Drive, cable) y ábrelo. Android pedirá
permitir "instalar apps de origen desconocido" para esa app la primera vez.

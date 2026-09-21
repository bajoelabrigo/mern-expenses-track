# Capturas de la ayuda

Las nueve capturas de `/ayuda` (`frontend/public/ayuda/*.png`) son pantallas de
verdad, no maquetas: si la app cambia, se vuelven a hacer. Esto es cómo.

## Reglas

- **Datos inventados, siempre.** Se hacen contra el entorno de ejemplo
  (`npm run dev:memoria` + `npm run datos-ejemplo`), nunca contra la iglesia
  real: la página es pública y el enlace se reenvía por WhatsApp. La iglesia del
  demo se renombra a «Iglesia Ejemplo» para que se note que son ejemplos.
- **En móvil y en oscuro** (390 × 844). En móvil porque es donde las van a leer,
  y en oscuro porque es como abre la app.
- **Contra la app compilada**, no contra el servidor de desarrollo: en
  desarrollo sale el botón de las devtools de React Query en la esquina, y eso
  no está en la app de nadie.

## Cómo

```bash
# 1. API con base en memoria y datos de ejemplo
npm run dev:memoria                 # en una terminal
npm run datos-ejemplo               # en otra

# 2. La app compilada, apuntando a esa API (el servidor de desarrollo no sirve:
#    sale el botón de las devtools)
cd frontend
VITE_API_URL=http://localhost:8000/api/v1 npm run build
npx vite preview --port 4173

# 3. Entrar como la tesorera y elegir el espacio de la iglesia
#    tesorera@demo.test / Demo12345
#    (al entrar cae en «Mis finanzas»: hay que cambiar de espacio arriba)
```

Luego, con la ventana del navegador en 390 × 844:

| Archivo | Qué se captura |
|---|---|
| `ayuda-1-entrar` | La pantalla de entrar, vacía |
| `ayuda-2-inicio` | El Inicio del mes, sin la guía de primeros pasos (se oculta antes) |
| `ayuda-3-categorias` | Categorías **con** el aviso «Faltan categorías de iglesia» (antes de tocar «Agregarlas») |
| `ayuda-4-registrar` | Registrar: Ingreso, categoría Ofrendas, S/ 485.50 |
| `ayuda-5-gasto` | Registrar: Gasto, categoría Servicios, S/ 185.30, con nota |
| `ayuda-6-conteo` | La hoja del conteo con billetes puestos y la suma |
| `ayuda-7-movimientos` | La lista de movimientos, con el buscador y los filtros |
| `ayuda-8-anulado` | Un movimiento ya anulado, con su aviso y el motivo |
| `ayuda-9-personas` | Personas, con lo recibido y lo pagado en el año |

Al final hay que comprimirlas: sin paleta, las nueve pesan unos 470 KB; con
paleta (256 colores y tramado) quedan en 165 KB y se leen igual. Y no entran en
el service worker (`globIgnores` en `vite.config.js`): son para leer una vez, no
para llevarlas siempre en el teléfono.

## Si cambia una pantalla

No hace falta rehacerlas todas: se rehace la que cambió, se comprime y se
sobrescribe el archivo con el mismo nombre. `src/lib/ayuda.js` las referencia por
nombre, y una prueba (`src/test/ayuda.test.jsx`) comprueba que cada archivo
existe y que cada captura dice qué se ve.

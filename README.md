# Aula al día

Seguimiento diario de cursos con inicio de sesión y registros privados en Supabase.

## Publicación

GitHub Pages publica desde la rama main y la carpeta raíz. Configura Settings > Pages > Deploy from a branch > main > /(root).

## Cuenta y conexión

La conexión pública está en config.js. El almacenamiento se crea ejecutando supabase-setup.sql en SQL Editor de Supabase. Los registros solo son accesibles para su propietario gracias a las reglas de seguridad por usuario.

En Supabase > Authentication > URL Configuration, configura Site URL y las direcciones de redirección permitidas con https://francoiro.github.io/auladia/.

En la aplicación pulsa Crear una cuenta, confirma tu correo si se solicita e inicia sesión. Esta cuenta es distinta de la cuenta de administración del panel Supabase.

## Guardado

Espera a ver Guardado en la nube antes de cerrar. Sin conexión, los cambios quedan pendientes en el navegador; puedes reintentar al recuperar Internet. Se evita sobrescribir registros cuando otro dispositivo guardó una versión más reciente. Usa un solo dispositivo para editar a la vez.

Descargar respaldo exporta todos tus cursos y clases como JSON. Importar respaldo agrega cursos como copias cuando ya existen. Conserva una copia periódica fuera del dispositivo.

## Archivos editables

index.html: página principal. style.css: diseño. app.js: seguimiento diario. cloud.js: cuenta, guardado y respaldos. config.js: conexión pública. No incluyas claves secretas ni contraseñas en el repositorio.

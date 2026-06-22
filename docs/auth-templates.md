# Plantillas de email — Activa SST

Configurar en **Lovable Cloud → Auth → Email Templates**. Existen tres plantillas relevantes; solo se usan dos.

---

## 1. Invite User (USADA)

**Cuándo se envía:** alta de prevencionista (bootstrap) o trabajador (importWorkers / resendInvite / admin.reinvitar). Es el primer y único enlace para activar la cuenta y crear contraseña.

**Subject:**
```
Has sido invitado a Activa SST
```

**Body (HTML):**
```html
<h2>¡Bienvenido a Activa SST!</h2>
<p>Hola,</p>
<p>Tu prevencionista te ha invitado a usar Activa SST, la plataforma para realizar pausas activas de forma guiada.</p>
<p>Haz clic en el botón para <strong>activar tu cuenta y crear tu contraseña</strong>. Este enlace es de un solo uso.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#0F766E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Activar mi cuenta</a></p>
<p style="color:#666;font-size:12px;margin-top:24px">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>{{ .ConfirmationURL }}</p>
<p style="color:#666;font-size:12px">Si no esperabas esta invitación, ignora este correo.</p>
```

---

## 2. Reset Password (USADA)

**Cuándo se envía:** desde `/recuperar-password` cuando el usuario olvidó su contraseña. NO es para primera activación.

**Subject:**
```
Restablece tu contraseña - Activa SST
```

**Body (HTML):**
```html
<h2>Restablece tu contraseña</h2>
<p>Hola,</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Activa SST.</p>
<p>Haz clic en el botón para crear una nueva contraseña. El enlace es válido por 1 hora.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#0F766E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Cambiar contraseña</a></p>
<p style="color:#666;font-size:12px;margin-top:24px">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>{{ .ConfirmationURL }}</p>
<p style="color:#666;font-size:12px">Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá funcionando.</p>
```

---

## 3. Magic Link (NO USADA)

**Acción:** dejar la plantilla por defecto. La app no envía magic links de login (solo invitaciones). Si Supabase no permite deshabilitarla por completo, basta con no llamar a `signInWithOtp` desde la app.

---

## Configuración de URLs (Auth → URL Configuration)

- **Site URL:** `https://cloud-huddle-up.lovable.app`
- **Redirect URLs (whitelist):**
  - `https://cloud-huddle-up.lovable.app/magic-link`
  - `https://cloud-huddle-up.lovable.app/restablecer-password`
  - `https://*.lovable.app/magic-link`
  - `https://*.lovable.app/restablecer-password`
  - `http://localhost:8080/magic-link`
  - `http://localhost:8080/restablecer-password`

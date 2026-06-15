# SPEC — Invitación de usuarios por cliente (email link)

> Estado: **definición lista para desarrollar**. Escrito 2026-06-15.
> Conecta "crear cliente" con "dar acceso a usuarios" — el flujo tipo Dorothy.

## Overview

Hoy crear un **cliente** (org) y crear un **usuario** son dos cosas sueltas, y **no
hay envío de email real** (`/api/mfa-email` es un stub; `/api/create-user` setea la
contraseña a mano). Este feature conecta todo: desde el **detalle del cliente** se
**invita usuarios por email**; reciben un **link**, ponen su propia contraseña, y
quedan atados a ese cliente con un rol.

## Decisiones cerradas

- **Email = Resend** vía **SMTP de Supabase** (no se llama a Resend desde el código:
  Supabase manda el correo usando el SMTP configurado).
- **Mecanismo = `supabase.auth.admin.inviteUserByEmail`** (nativo de Supabase).
- La invitación vive **dentro del cliente** (`/admin/clients/[id]`, sección **Team**
  que ya existe). Supersede la creación con contraseña manual de `/users` (esta queda
  como fallback de admin).

## Setup de email (paso de configuración, lo hace Sergio — ~15 min)

1. Crear cuenta en **resend.com** (free tier ~3.000/mes).
2. **Verificar el dominio `kad.london`** en Resend (añadir registros DNS SPF/DKIM).
3. Generar **API key** + datos SMTP de Resend.
4. **Supabase → Project Settings → Authentication → SMTP Settings:** activar "Custom
   SMTP" con host/usuario/clave de Resend, sender `no-reply@kad.london`.
5. **Supabase → Authentication → URL Configuration → Redirect URLs:** añadir
   `https://groundwork.kad.london/accept-invite` y `http://localhost:3000/accept-invite`.
6. **Supabase → Authentication → Email Templates → "Invite user":** brandear con
   Groundwork y el botón al link de invitación.

> Sin esto, `inviteUserByEmail` no entrega el correo (el default de Supabase tiene
> límite ~3-4/hora, solo para pruebas).

## User Stories

- **US1 — Invitar:** Como admin, desde un cliente quiero invitar a un usuario por email
  con un rol, para que acceda solo a ese cliente.
  - AC: ingreso email + rol → recibe un email con link → aparece en Team como "Invitado".
- **US2 — Aceptar:** Como invitado, al abrir el link quiero **poner mi contraseña** y
  entrar.
  - AC: link válido → pantalla para fijar contraseña → entro a Groundwork ya con acceso.
- **US3 — Estado:** Como admin quiero ver quién aceptó y quién sigue pendiente, y poder
  **reenviar** o **revocar** la invitación.
- **US4 — Email ya existe:** Si el email ya tiene cuenta, en vez de error se le **da
  acceso a este cliente** (o se reenvía invitación).

## Flujo

1. Admin abre cliente → **Team** → "Invitar usuario" (email + rol).
2. `POST /api/invite-user { email, role, organization_id }`:
   - `inviteUserByEmail(email, { redirectTo: APP_URL + "/accept-invite",
     data: { organization_id, role } })` → crea el usuario (sin password) y **manda el
     email** (vía SMTP de Resend).
   - Escribe `organization_members` (organization_id, user_id, email, role, invited_by)
     y `user_roles` (rol legacy mapeado) — el usuario ya existe, solo falta que active.
   - Si el email ya existía → no recrear; añadir/asegurar la membresía y (opcional)
     reenviar invitación.
3. Llega el email (Resend) → click → **`/accept-invite`**:
   - Establece sesión desde el token del link (`verifyOtp({ token_hash, type: "invite" })`
     o `detectSessionInUrl`).
   - Usuario fija contraseña (`updateUser({ password })`).
   - Redirige a `/projects`. Ya tiene acceso (la membresía existe).

## API / Interface Contract

### `POST /api/invite-user`  *(service-role; auth: solo platform_admin u org_admin de esa org)*
```jsonc
// req
{ "email": "x@cliente.com", "role": "analyst", "organization_id": "uuid" }
// res OK
{ "success": true, "user_id": "uuid", "status": "invited" }
// res ya existe
{ "success": true, "user_id": "uuid", "status": "already_member" | "reinvited" }
// res error
{ "error": "..." }
```
- Roles válidos (CHECK de `organization_members`): `org_admin` | `analyst` | `viewer`.
  (`platform_admin` solo para la org plataforma de K&D.)

### `POST /api/resend-invite` y `POST /api/revoke-invite` *(opcionales)*
- Resend: `generateLink({ type: "invite", email })` o re-`inviteUserByEmail`.
- Revoke: borrar `organization_members` (+ `user_roles`) y, si nunca activó, borrar el
  auth user.

## Data Model

`organization_members` **ya existe** con: organization_id, user_id, email, role,
**invited_by**, created_at. Sugerencia:
- Añadir `status text DEFAULT 'active' CHECK (status IN ('invited','active'))` para
  mostrar pendientes — o **derivarlo** del auth user (`email_confirmed_at` /
  `last_sign_in_at` nulos = pendiente) y evitar migración. *(Decisión abierta.)*

## UX/UI

- En la sección **Team** del detalle del cliente: botón **"+ Invitar usuario"** →
  form (email + select de rol).
- Lista de miembros con badge: **Activo** / **Invitado (pendiente)** + acciones
  **Reenviar** / **Revocar**.
- Página **`/accept-invite`**: branding Groundwork, campo contraseña + confirmar,
  estados de error (link expirado/usado), y éxito → entra.
- Quitar/atenuar el flujo de contraseña manual en `/users` (dejarlo como opción avanzada).

## Technical Notes

- **No hay `RESEND_API_KEY` en el código** — Supabase manda vía su SMTP. El app solo
  llama `inviteUserByEmail`. Más simple y seguro.
- **Sesión en `/accept-invite`:** preferir el flujo moderno `token_hash` +
  `verifyOtp({ type: "invite" })`; alternativa `detectSessionInUrl: true`.
- **Expiración** del link de invitación: configurable en Supabase (default ~24h);
  por eso el botón Reenviar.
- **Seguridad:** re-activar auth en `/api/invite-user` (solo admins). Service-role solo
  server-side. Resolver el hueco general de auth abierto en las rutas admin.

## Product Context & Integration Map

- **Upstream:** SMTP de Resend en Supabase + redirect URL configurados; un cliente (org)
  ya creado (form Add Client, ya arreglado).
- **Downstream:** la membresía en `organization_members` → `role-context` (resuelve
  acceso, lee org_members primero) → habilita módulos según rol. Conecta con la sección
  **Team** que ya existe en el detalle del cliente.
- **Supersede** la creación manual con contraseña de `/users`/`create-user` (mantener
  como fallback). Unifica sobre el sistema **nuevo** (organizations + organization_members),
  reduciendo la deuda del doble sistema de roles.

## Open Questions

1. `status` como columna nueva vs **derivar** pendiente del auth user. (Recomiendo
   derivar para MVP, sin migración.)
2. ¿Puede un **org_admin del cliente** invitar a su propio equipo, o solo K&D
   (platform_admin)? — recomiendo permitir ambos.
3. Rol por defecto en el form de invitación — recomiendo `analyst`.
4. ¿Mantener `/users` (cross-org) además del invite por cliente? — sí, para K&D.

## Build Order

1. **Setup email** (Resend + Supabase SMTP + redirect URL + template). *(Bloqueante.)*
2. **`/accept-invite`** (fijar contraseña desde el token).
3. **`/api/invite-user`** (inviteUserByEmail + memberships + manejo "ya existe" + auth).
4. **UI en Team** del detalle del cliente (form invitar + lista con estado).
5. **Reenviar / Revocar** + badges de pendiente.
6. **Prueba end-to-end** con un email real (invitar → recibir → fijar contraseña → entra
   con acceso al cliente correcto).

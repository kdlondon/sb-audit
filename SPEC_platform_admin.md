# SPEC — Platform Admin, roles & permisos

> Estado: **definición para revisar antes de desarrollar**. Escrito 2026-06-16.
> Resuelve el enredo de usuarios/roles/clientes. Reemplaza la nav/admin actual por
> un modelo de 2 módulos + un sistema de roles de 2 niveles.

## Overview

**Platform Admin** (solo @kad.london) se divide en **dos módulos**:
1. **K&D Team** — gestionar a los usuarios de Knots & Dots (nosotros).
2. **Client Management** — gestionar clientes y los usuarios de cada cliente.

Y se define un **sistema de roles de 2 niveles**: roles de K&D (sobre la plataforma)
y roles de cliente (sobre los proyectos de un cliente).

## Sistema de roles (el corazón del spec)

### Nivel K&D (miembros de la organización "Knots & Dots", type=platform)
| Rol | Platform Admin | Alcance | Mapea a |
|---|---|---|---|
| **K&D Superadmin** | ✅ | TODOS los clientes y proyectos | `platform_admin` |
| **K&D Analyst** | ❌ | solo los **clientes asignados** y sus proyectos | `analyst` (plataforma) + asignaciones |

- Al elegir rol **Analyst** en el form de K&D Team → se despliega la **lista de clientes
  actuales con checkboxes** para asignar cuáles ve.

### Nivel Cliente (miembros de una organización type=client)
| Rol | Alcance | Acceso a módulos | Mapea a |
|---|---|---|---|
| **Client Superadmin** | todo su cliente | todos los módulos; (futuro: gestiona su equipo) | `org_admin` |
| **Client Analyst** | proyectos asignados | **todos** los módulos de esos proyectos | `analyst` |
| **Client Viewer** | proyectos asignados | **solo Report y Showcase** | `viewer` |

> Hay que **actualizar `canAccess`** en `lib/role-context.js`: hoy `viewer` = `["showcase"]`;
> debe ser `["reports","showcase"]`.

### Home page por rol
- **K&D Superadmin / Analyst:** listado **categorizado de clientes** y debajo los clientes
  y sus proyectos. (Analyst: solo los clientes asignados.)
- **Usuarios de cliente:** los proyectos de su cliente (la home actual `/dashboard`).

## Módulo 1 — K&D Team (NUEVO)

- Crear / editar / eliminar perfiles de K&D.
- Form: email, password (temporal), rol (Superadmin | Analyst).
  - Si **Analyst** → aparece lista de clientes con checkboxes para asignar.
- Lista de miembros K&D con su rol + acciones editar / eliminar.
- Ruta sugerida: `/admin/team` (reemplaza el viejo `/users` para K&D).

## Módulo 2 — Client Management (existe, se completa)

- Crear clientes (como hoy, ya arreglado el bug de fechas).
- **Dentro de cada cliente:** crear usuarios con acceso a todos los proyectos de **ese**
  cliente. Rol por usuario: Superadmin | Analyst | Viewer.
- **Editar y eliminar** usuarios del cliente (hoy NO se puede — bug a resolver).
- (Ya hecho: si el cliente no tiene org, se crea al vuelo al añadir el primer usuario.)

## Bugs a resolver (parte de este alcance)

1. **🔴 Identidad de sesión (crítico):** tras loguear con un usuario nuevo, User profile y
   el menú siguen mostrando el usuario anterior. Hipótesis: caché en localStorage
   (`gw-active-org`, `gw-active-brand`, `sb-project-*`) y/o `role-context` no refresca la
   sesión al cambiar de usuario. **Investigar primero.** Fix probable: limpiar localStorage
   en login/logout y derivar SIEMPRE `userEmail` de la sesión fresca.
2. **Cambiar contraseña con validación del actual:** el form de User profile debe pedir
   **contraseña actual + nueva**. Verificar la actual re-autenticando
   (`signInWithPassword({ email, password: actual })`); si falla → "contraseña actual
   incorrecta"; si pasa → `updateUser({ password: nueva })`.
3. **Editar / eliminar usuarios dentro de un cliente:** en el detalle del cliente, cada
   usuario con acciones de cambiar rol y eliminar (reusar `/api/delete-user`).

## Data Model

- **`organization_members`** (existe): `organization_id`, `user_id`, `email`,
  `role ∈ {platform_admin, org_admin, analyst, viewer}`, `invited_by`. Es la fuente de
  verdad de roles. (Hay deuda: legacy `user_roles` en paralelo — unificar.)
- **Asignación de proyectos** (analyst/viewer): `project_access` (existe).
- **NUEVO — K&D Analyst → clientes asignados:** una de dos vías *(decisión abierta)*:
  - (a) tabla nueva `kd_client_assignments(user_id, organization_id)`, o
  - (b) darle al K&D Analyst membresía `analyst` en cada org-cliente asignada.
  - Recomiendo **(a)** por separación limpia (no ensucia el Team del cliente).
- **Clientes sin org:** Scotiabank y otros tienen `clients.organization_id = NULL`.
  Hay que **backfillear** una organización por cliente (o crearla al vuelo, ya se hace al
  añadir usuario). Idealmente: todo cliente nace con su org.

## UX/UI

- Platform Admin con 2 pestañas/botones: **K&D Team** | **Client Management**.
- Form de rol con revelado condicional (Analyst → checkboxes de clientes).
- Home categorizada de clientes para usuarios K&D.
- Botones monocromos (ya aplicado).

## Product Context & Integration Map

- **role-context** (`useRole`) ya expone `isPlatformAdmin`, `isOrgAdmin`, `orgRole`,
  `activeOrg`, `memberships`, `switchOrg`. La home y los guards leen de aquí.
- **canAccess / canEdit** definen el acceso por módulo → actualizar `viewer` y validar
  analyst/superadmin.
- **AuthGuard / ProjectGuard / BrandGuard** filtran el acceso a páginas/proyectos.
- Conecta con el rediseño de onboarding ([[project_onboarding_redesign]]) y el modelo
  cliente↔proyecto (ver Open Questions).

## Open Questions

1. **K&D Analyst → asignación de clientes:** ¿tabla `kd_client_assignments` (recomendado)
   o membresía analyst en cada org?
2. **Status y Tiers** del cliente (pendiente de tu definición — hoy
   status: lead/active/trial/paused/churned; tiers: starter/standard/premium/enterprise).
   ¿Cuáles quieres?
3. **Modelo cliente↔proyecto:** hoy un "proyecto/brand" no está ligado a su cliente (org)
   de forma fiable (muchos `organization_id` nulos). Para que el header muestre "Scotiabank"
   y la home K&D agrupe por cliente, **cada proyecto debe conocer su cliente**. ¿Hacemos un
   backfill (ligar proyectos/brands existentes a su cliente) en esta fase?
4. ¿`/users` (Team genérico actual) se elimina y se parte en K&D Team + usuarios-por-cliente?

## Build Order

1. **🔴 Fix bug de identidad de sesión** (bloqueante — sin esto no se puede probar nada).
2. **canAccess:** viewer = reports + showcase; validar matriz de roles.
3. **User profile:** validación de contraseña actual.
4. **Client Management:** editar/eliminar usuarios dentro del cliente + selector de rol
   (Superadmin/Analyst/Viewer) + asignación de proyectos.
5. **K&D Team** (Módulo 1): CRUD de usuarios K&D + rol Superadmin/Analyst + checkboxes de
   clientes (con `kd_client_assignments`).
6. **Home categorizada** por cliente para usuarios K&D (Superadmin: todos; Analyst: asignados).
7. **Backfill cliente↔proyecto** + que el header muestre el cliente real.
8. Verificar matriz de permisos extremo a extremo con un usuario de cada rol.

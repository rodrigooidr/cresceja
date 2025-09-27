# Regenerating Tokens and Restoring Global Roles

This guide documents the exact steps to re-enable privileged access when a
user token is missing global roles (for example, the `SuperAdmin` role). The
process ensures the backend grants the correct permissions and the frontend
receives an updated token payload.

## 1. Confirm the User ID

Run the following SQL statement against the Postgres database to confirm the
user's identifier.

```sql
SELECT id, email
FROM public.users
WHERE email = 'rodrigooidr@hotmail.com';
```

Keep the returned `id` handy for the next steps.

## 2. Guarantee the `SuperAdmin` Global Role

Insert (or re-insert) the `SuperAdmin` role for the user. The statement below is
idempotent thanks to the `ON CONFLICT` clause.

```sql
INSERT INTO public.user_global_roles (user_id, role)
SELECT u.id, 'SuperAdmin'
FROM public.users AS u
WHERE u.email = 'rodrigooidr@hotmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

Confirm the role assignment:

```sql
SELECT *
FROM public.user_global_roles
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'rodrigooidr@hotmail.com'
);
```

If `SuperAdmin` is present in the results, the backend can now issue tokens with
the proper global permissions.

## 3. Force the Frontend to Issue a New Token

1. Sign out of the application.
2. Clear both `localStorage` and `sessionStorage`. (Alternatively, click the
   **Sair** button if available.)
3. Sign back in using the same credentials.

After logging in, confirm the payload stored in the browser:

```javascript
JSON.parse(
  atob((localStorage.getItem('token') || sessionStorage.getItem('token'))
    .split('.')[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/'))
);
```

You should now see a `role` field (e.g. `OrgOwner`) and a `roles` array that
includes `"SuperAdmin"`.

## 4. Validate Admin API Responses

Open the **Planos** and **Organizações** pages and, in the browser DevTools
network tab, confirm the following requests succeed with HTTP 200 responses:

- `GET http://localhost:4000/api/admin/plans`
- `GET http://localhost:4000/api/admin/orgs?status=active`

If you receive `403` responses, the token still lacks the required roles—repeat
Step 3 to refresh it. If the `plans` endpoint returns `404`, verify that you are
running the backend version that mounts `adminPlansRouter` under
`/api/admin/plans`.

Following these steps should fully restore access for the affected user.


import { db, json, methodNotAllowed, serverError } from './_lib/db.js';
import { authErrorStatus, clearSessionCookie, createSession, destroySession, hashPassword, normalizeEmail, requireAuth, sessionCookie, verifyPassword } from './_lib/auth.js';

const publicRoles = new Set(['scout', 'player', 'club', 'academy']);

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  return request.json();
}

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      try {
        const session = await requireAuth(request);
        const payload = { session: { user: session.user, workspace: session.workspace } };
        return response?.status ? response.status(200).json(payload) : json(payload);
      } catch (error) {
        const status = authErrorStatus(error);
        if (status === 401) return response?.status ? response.status(200).json({ session: null }) : json({ session: null });
        throw error;
      }
    }

    if (request.method !== 'POST') return methodNotAllowed('GET or POST');
    const body = await bodyOf(request);
    const action = String(body?.action || '').toLowerCase();
    const sql = db();

    if (action === 'signup') {
      const email = normalizeEmail(body.email);
      const password = body.password;
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
        return json({ error: 'Full name must be between 2 and 120 characters.' }, 400);
      }
      if (!publicRoles.has(body.role)) return json({ error: 'Select a valid account type.' }, 400);

      const passwordHash = await hashPassword(password);
      const existing = await sql`select id from app_users where lower(email) = ${email} limit 1`;
      if (existing.length) return json({ error: 'An account with that email already exists.' }, 409);

      const [user] = await sql`
        insert into app_users (email, full_name, role, password_hash)
        values (${email}, ${body.name.trim()}, ${body.role}, ${passwordHash})
        returning id, email, full_name, role
      `;
      const workspaceName = `${body.name.trim()}'s Scout Workspace`;
      const [workspace] = await sql`
        insert into workspaces (name, owner_user_id)
        values (${workspaceName}, ${user.id}::uuid)
        returning id, name
      `;
      await sql`
        insert into workspace_members (workspace_id, user_id, role)
        values (${workspace.id}, ${user.id}::uuid, 'owner')
      `;
      const token = await createSession(user.id);
      const payload = {
        session: {
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
          workspace: { id: workspace.id, name: workspace.name, role: 'owner' },
        },
      };
      const result = response?.status ? response.status(201).json(payload) : json(payload, 201);
      result.headers.set('Set-Cookie', sessionCookie(token));
      return result;
    }

    if (action === 'signin') {
      const email = normalizeEmail(body.email);
      if (typeof body.password !== 'string') return json({ error: 'Password is required.' }, 400);
      const [user] = await sql`
        select id, email, full_name, role, password_hash
        from app_users
        where lower(email) = ${email}
        limit 1
      `;
      if (!user || !(await verifyPassword(body.password, user.password_hash))) {
        return json({ error: 'Invalid email or password.' }, 401);
      }
      const [workspace] = await sql`
        select w.id, w.name, wm.role
        from workspace_members wm
        join workspaces w on w.id = wm.workspace_id
        where wm.user_id = ${user.id}::uuid
        order by wm.created_at asc
        limit 1
      `;
      if (!workspace) return json({ error: 'Your account has no active workspace.' }, 403);
      const token = await createSession(user.id);
      const payload = {
        session: {
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
          workspace: { id: workspace.id, name: workspace.name, role: workspace.role },
        },
      };
      const result = response?.status ? response.status(200).json(payload) : json(payload);
      result.headers.set('Set-Cookie', sessionCookie(token));
      return result;
    }

    if (action === 'signout') {
      await destroySession(request);
      const result = response?.status ? response.status(200).json({ ok: true }) : json({ ok: true });
      result.headers.set('Set-Cookie', clearSessionCookie());
      return result;
    }

    return json({ error: 'Supported actions are signup, signin and signout.' }, 400);
  } catch (error) {
    const status = authErrorStatus(error);
    const result = status >= 400 && status < 600 ? json({ error: error instanceof Error ? error.message : 'Authentication failed.' }, status) : serverError(error);
    if (response?.status) return response.status(status >= 400 && status < 600 ? status : 500).json(await result.json());
    return result;
  }
}

import { db, json, methodNotAllowed, serverError } from './_lib/db.js';
import { authErrorStatus, clearSessionCookie, createSession, destroySession, hashPassword, normalizeEmail, requireAuth, sessionCookie, verifyPassword } from './_lib/auth.js';

const publicRoles = new Set(['scout', 'player', 'club', 'academy']);

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  return request.json();
}

function send(response, status, payload, cookie) {
  if (response?.status) {
    if (cookie) response.setHeader('Set-Cookie', cookie);
    return response.status(status).json(payload);
  }
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(payload), { status, headers });
}

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      try {
        const session = await requireAuth(request);
        return send(response, 200, { session: { user: session.user, workspace: session.workspace } });
      } catch (error) {
        const status = authErrorStatus(error);
        if (status === 401) return send(response, 200, { session: null });
        throw error;
      }
    }

    if (request.method !== 'POST') return methodNotAllowed('GET or POST');
    const body = await bodyOf(request);
    const action = String(body?.action || '').toLowerCase();
    const sql = db();

    if (action === 'signup') {
      const email = normalizeEmail(body.email);
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
        return send(response, 400, { error: 'Full name must be between 2 and 120 characters.' });
      }
      if (!publicRoles.has(body.role)) return send(response, 400, { error: 'Select a valid account type.' });

      const passwordHash = await hashPassword(body.password);
      const existing = await sql`select id from app_users where lower(email) = ${email} limit 1`;
      if (existing.length) return send(response, 409, { error: 'An account with that email already exists.' });

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
      return send(response, 201, {
        session: {
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
          workspace: { id: workspace.id, name: workspace.name, role: 'owner' },
        },
      }, sessionCookie(token));
    }

    if (action === 'signin') {
      const email = normalizeEmail(body.email);
      if (typeof body.password !== 'string') return send(response, 400, { error: 'Password is required.' });
      const [user] = await sql`
        select id, email, full_name, role, password_hash
        from app_users
        where lower(email) = ${email}
        limit 1
      `;
      if (!user || !(await verifyPassword(body.password, user.password_hash))) {
        return send(response, 401, { error: 'Invalid email or password.' });
      }
      const [workspace] = await sql`
        select w.id, w.name, wm.role
        from workspace_members wm
        join workspaces w on w.id = wm.workspace_id
        where wm.user_id = ${user.id}::uuid
        order by wm.created_at asc
        limit 1
      `;
      if (!workspace) return send(response, 403, { error: 'Your account has no active workspace.' });
      const token = await createSession(user.id);
      return send(response, 200, {
        session: {
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
          workspace: { id: workspace.id, name: workspace.name, role: workspace.role },
        },
      }, sessionCookie(token));
    }

    if (action === 'signout') {
      await destroySession(request);
      return send(response, 200, { ok: true }, clearSessionCookie());
    }

    return send(response, 400, { error: 'Supported actions are signup, signin and signout.' });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status >= 400 && status < 600 && status !== 500) return send(response, status, { error: error instanceof Error ? error.message : 'Authentication failed.' });
    if (response?.status) return response.status(500).json({ error: 'Authentication service error.' });
    return serverError(error);
  }
}

// authService.js — Authentication & session for Shatir.
// Uses a custom `users` table with bcrypt (crypt) password hashing.
// New registrations default to is_active = FALSE pending admin approval.

import { hasNeon, query, rpc } from './neonClient';
import { storage } from './storage';

/**
 * loginUser — authenticates by email + password.
 * Returns { user } on success, or { error, pending } on failure.
 *   - pending: true when credentials are correct but account is awaiting activation.
 */
export async function loginUser(email, password) {
  try {
    let user;
    if (hasNeon) {
      // First check credentials regardless of active state (to detect pending accounts).
      const rows = await query(
        `SELECT id, full_name, email, role, is_active, created_at
         FROM users
         WHERE email = $1 AND password_hash = crypt($2, password_hash)`,
        [email.trim(), password]
      );
      user = rows[0];
    } else {
      const res = await rpc('check_user_credentials', { p_email: email.trim(), p_password: password });
      user = Array.isArray(res) ? res[0] : res;
    }

    if (!user) {
      return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    if (!user.is_active) {
      return {
        error: 'حسابك بانتظار تفعيل المدير. يرجى المحاولة لاحقاً.',
        pending: true,
      };
    }

    const session = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    };
    await storage.saveSession(session);
    return { user: session };
  } catch (e) {
    return { error: 'تعذّر تسجيل الدخول: ' + (e.message || 'خطأ غير معروف') };
  }
}

/**
 * registerUser — creates a new account (is_active = FALSE).
 * Returns { user } on success or { error } on failure.
 */
export async function registerUser({ full_name, email, password }) {
  try {
    if (!full_name?.trim() || !email?.trim() || !password) {
      return { error: 'جميع الحقول مطلوبة' };
    }
    if (password.length < 6) {
      return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }

    let user;
    if (hasNeon) {
      const rows = await query(
        `INSERT INTO users (full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, crypt($3, gen_salt('bf')), 'user', FALSE)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, full_name, email, role, is_active, created_at`,
        [full_name.trim(), email.trim(), password]
      );
      user = rows[0];
    } else {
      const res = await rpc('register_new_user', {
        p_full_name: full_name.trim(),
        p_email: email.trim(),
        p_password: password,
      });
      user = Array.isArray(res) ? res[0] : res;
    }

    if (!user) {
      return { error: 'هذا البريد الإلكتروني مسجّل بالفعل' };
    }
    return { user };
  } catch (e) {
    return { error: 'تعذّر إنشاء الحساب: ' + (e.message || 'خطأ غير معروف') };
  }
}

export async function loadSession() {
  return storage.loadSession();
}

export async function signOut() {
  await storage.clearSession();
}

export function isAdmin(user) {
  return user?.role === 'admin' || user?.email === 'admin@shatir.com';
}

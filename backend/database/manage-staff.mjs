// Grants, revokes or lists staff access to the admin page.
//
// Usage (from the backend folder):
//   npm run staff:add -- owner@example.com                   new login: prints a generated password
//   npm run staff:add -- owner@example.com --reset-password  existing login: sets a new password
//   npm run staff:remove -- owner@example.com
//   npm run staff:list
//
// Set STAFF_PASSWORD (12+ characters) to choose the password instead of
// generating one. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
      'Copy .env.local.example to .env.local (in backend/) and fill both in first.'
  );
  process.exit(1);
}

const MIN_PASSWORD_LENGTH = 12;
const USAGE = 'Usage: npm run staff:add -- <email> [--reset-password] | staff:remove -- <email> | staff:list';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

function choosePassword() {
  const fromEnv = process.env.STAFF_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`STAFF_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return { password: fromEnv, generated: false };
  }
  return { password: crypto.randomBytes(18).toString('base64url'), generated: true };
}

async function addStaff(email, resetPassword) {
  let user = await findUserByEmail(email);
  let generatedPassword = null;

  if (!user) {
    const { password, generated } = choosePassword();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`Failed to create a login for ${email}: ${error.message}`);
    user = data.user;
    if (generated) generatedPassword = password;
    console.log(`Created a login for ${email}.`);
  } else if (resetPassword) {
    const { password, generated } = choosePassword();
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error(`Failed to reset the password for ${email}: ${error.message}`);
    if (generated) generatedPassword = password;
    console.log(`Reset the password for ${email}.`);
  }

  const { error } = await supabase.from('staff').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to grant staff access: ${error.message}`);

  console.log(`${email} has staff access.`);
  if (generatedPassword) {
    console.log(`Password (shown only once - share it privately): ${generatedPassword}`);
  }
}

async function removeStaff(email) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No login found for ${email}.`);

  const { error } = await supabase.from('staff').delete().eq('user_id', user.id);
  if (error) throw new Error(`Failed to remove staff access: ${error.message}`);

  console.log(`${email} no longer has staff access (the login still exists but can't use the admin page).`);
}

async function listStaff() {
  const { data, error } = await supabase.from('staff').select('user_id, created_at').order('created_at');
  if (error) throw new Error(`Failed to load staff: ${error.message}`);
  if (data.length === 0) {
    console.log('No staff yet. Add someone with: npm run staff:add -- <email>');
    return;
  }

  for (const row of data) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.user_id);
    const label = userError ? `${row.user_id} (login not found)` : userData.user.email;
    console.log(`${label}  - staff since ${new Date(row.created_at).toLocaleDateString()}`);
  }
}

async function main() {
  const [command, rawEmail, ...flags] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const needsEmail = command === 'add' || command === 'remove';

  if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) {
    throw new Error(`A valid email address is required.\n${USAGE}`);
  }

  if (command === 'add') await addStaff(email, flags.includes('--reset-password'));
  else if (command === 'remove') await removeStaff(email);
  else if (command === 'list') await listStaff();
  else throw new Error(USAGE);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

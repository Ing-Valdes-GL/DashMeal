import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { sendOtp, verifyOtp } from "../../utils/otp.js";
import { AppError } from "../../middleware/errorHandler.js";
import type {
  RegisterUserInput,
  LoginUserInput,
  LoginAdminInput,
  VerifyOtpInput,
  ResetPasswordInput,
  AuthTokens,
} from "@dash-meal/shared";

export async function registerUser(input: RegisterUserInput) {
  const { name, phone, password } = input;

  // Vérifier si le numéro existe déjà
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phone)
    .single();

  if (existing) {
    throw new AppError(409, "PHONE_ALREADY_EXISTS", "Ce numéro est déjà utilisé");
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabase
    .from("users")
    .insert({ name, phone, password_hash, is_verified: false })
    .select("id, name, phone, is_verified")
    .single();

  if (error || !user) {
    throw new AppError(500, "CREATE_USER_ERROR", "Échec de la création du compte");
  }

  await sendOtp(phone);

  return { message: "Compte créé. Un code OTP a été envoyé.", user_id: user.id };
}

export async function verifyUserPhone(input: VerifyOtpInput) {
  const { phone, code } = input;

  const isValid = await verifyOtp(phone, code);
  if (!isValid) {
    throw new AppError(400, "INVALID_OTP", "Code OTP invalide ou expiré");
  }

  const { data: user } = await supabase
    .from("users")
    .update({ is_verified: true })
    .eq("phone", phone)
    .select("id, name, phone, is_verified")
    .single();

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable");
  }

  const tokens = buildUserTokens(user);
  return { user, tokens };
}

export async function loginUser(input: LoginUserInput): Promise<{ user: object; tokens: AuthTokens }> {
  const { phone, password } = input;

  const { data: user } = await supabase
    .from("users")
    .select("id, name, phone, password_hash, is_verified")
    .eq("phone", phone)
    .single();

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  if (!user.is_verified) {
    throw new AppError(403, "PHONE_NOT_VERIFIED", "Numéro de téléphone non vérifié");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  const { password_hash: _, ...safeUser } = user;
  const tokens = buildUserTokens(user);
  return { user: safeUser, tokens };
}

export async function loginAdmin(input: LoginAdminInput): Promise<{ admin: object; tokens: AuthTokens }> {
  const { identifier, password } = input;

  const isEmail = identifier.includes("@");
  const query = supabase
    .from("admins")
    .select("id, username, email, phone, brand_id, role, is_active, password_hash");

  const { data: admin } = await (isEmail
    ? query.eq("email", identifier)
    : query.eq("phone", identifier)
  ).single();

  if (!admin) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  if (!admin.is_active) {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "Ce compte a été suspendu");
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  const { password_hash: _, ...safeAdmin } = admin;
  const tokens = buildAdminTokens(admin);
  return { admin: safeAdmin, tokens };
}

export async function loginSuperAdmin(input: LoginAdminInput): Promise<{ admin: object; tokens: AuthTokens }> {
  const { identifier, password } = input;

  const isEmail = identifier.includes("@");
  const query = supabase
    .from("super_admins")
    .select("id, email, phone, password_hash");

  const { data: superAdmin } = await (isEmail
    ? query.eq("email", identifier)
    : query.eq("phone", identifier)
  ).single();

  if (!superAdmin) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  const valid = await bcrypt.compare(password, superAdmin.password_hash);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Identifiants incorrects");
  }

  const { password_hash: _, ...safeSuperAdmin } = superAdmin;
  const tokens = buildSuperAdminTokens(superAdmin);
  return { admin: safeSuperAdmin, tokens };
}

export async function registerSuperAdmin(input: {
  email: string;
  phone: string;
  password: string;
}): Promise<{ admin: object; tokens: AuthTokens }> {
  const { email, phone, password } = input;

  const { data: existing, error: existingError } = await supabase
    .from("super_admins")
    .select("id")
    .or(`email.eq.${email},phone.eq.${phone}`)
    .maybeSingle();

  if (existingError) {
    throw new AppError(500, "SUPERADMIN_LOOKUP_ERROR", "Erreur de vérification superadmin");
  }

  if (existing) {
    throw new AppError(409, "SUPERADMIN_ALREADY_EXISTS", "Email ou numéro déjà utilisé");
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: created, error } = await supabase
    .from("super_admins")
    .insert({ email, phone, password_hash })
    .select("id, email, phone, password_hash")
    .single();

  if (error || !created) {
    throw new AppError(500, "CREATE_SUPERADMIN_ERROR", "Echec de création du compte superadmin");
  }

  const { password_hash: _, ...safeSuperAdmin } = created;
  const tokens = buildSuperAdminTokens(created);
  return { admin: safeSuperAdmin, tokens };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload: { id: string; role: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalide");
  }

  // Vérifier que le compte existe toujours
  let user;
  if (payload.role === "user") {
    const { data } = await supabase
      .from("users")
      .select("id, name, phone, is_verified")
      .eq("id", payload.id)
      .single();
    user = data;
  } else if (payload.role === "superadmin") {
    const { data } = await supabase
      .from("super_admins")
      .select("id, email, phone")
      .eq("id", payload.id)
      .single();
    user = data ? { ...data, role: "superadmin" } : null;
  } else {
    const { data } = await supabase
      .from("admins")
      .select("id, email, phone, brand_id, role, is_active")
      .eq("id", payload.id)
      .single();
    user = data;
  }

  if (!user) {
    throw new AppError(401, "USER_NOT_FOUND", "Compte introuvable");
  }

  return buildTokensFromRole(user, payload.role);
}

export async function requestPasswordReset(phone: string) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phone)
    .single();

  // Ne pas révéler si le numéro existe ou non
  if (user) {
    await sendOtp(phone);
  }
  return { message: "Si ce numéro est enregistré, un code OTP a été envoyé" };
}

export async function resetPassword(input: ResetPasswordInput) {
  const { phone, code, new_password } = input;

  const isValid = await verifyOtp(phone, code);
  if (!isValid) {
    throw new AppError(400, "INVALID_OTP", "Code OTP invalide ou expiré");
  }

  const password_hash = await bcrypt.hash(new_password, 12);
  const { error } = await supabase
    .from("users")
    .update({ password_hash })
    .eq("phone", phone);

  if (error) {
    throw new AppError(500, "RESET_PASSWORD_ERROR", "Échec de la réinitialisation");
  }

  return { message: "Mot de passe mis à jour avec succès" };
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

function buildUserTokens(user: { id: string; name?: string; phone: string }): AuthTokens {
  const payload = { id: user.id, role: "user", name: user.name, phone: user.phone };
  return {
    access_token: signAccessToken(payload),
    refresh_token: signRefreshToken({ id: user.id, role: "user" }),
    expires_in: 15 * 60,
  };
}

function buildAdminTokens(admin: { id: string; username?: string; email: string; phone: string; brand_id: string; role: string }): AuthTokens {
  const payload = { id: admin.id, role: admin.role, email: admin.email, phone: admin.phone, brand_id: admin.brand_id };
  return {
    access_token: signAccessToken(payload),
    refresh_token: signRefreshToken({ id: admin.id, role: admin.role }),
    expires_in: 15 * 60,
  };
}

function buildSuperAdminTokens(admin: { id: string; email: string; phone: string }): AuthTokens {
  const payload = { id: admin.id, role: "superadmin", email: admin.email, phone: admin.phone };
  return {
    access_token: signAccessToken(payload),
    refresh_token: signRefreshToken({ id: admin.id, role: "superadmin" }),
    expires_in: 15 * 60,
  };
}

function buildTokensFromRole(user: Record<string, unknown>, role: string): AuthTokens {
  const payload = { id: user.id as string, role, ...user };
  return {
    access_token: signAccessToken(payload as Parameters<typeof signAccessToken>[0]),
    refresh_token: signRefreshToken({ id: user.id as string, role }),
    expires_in: 15 * 60,
  };
}

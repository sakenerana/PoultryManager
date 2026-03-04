import supabase from "../utils/supabase";
import type { CreateUserInput, Role, UpdateUserInput, UserAccount } from "../type/user.types";

const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";

type UserRow = {
  id: string | number;
  full_name: string | null;
  role: string | null;
  building_id: number | null;
  status: string | null;
  user_uuid: string | null;
  created_at: string;
};

function normalizeRole(role?: string): Role {
  if (role === "Admin" || role === "Supervisor") return role;
  return "Staff";
}

function mapRowToUser(row: UserRow): UserAccount {
  return {
    id: String(row.id),
    fullName: row.full_name ?? "",
    buildingId: row.building_id ?? null,
    role: normalizeRole(row.role ?? undefined),
    status: row.status === "Inactive" ? "Inactive" : "Active",
    userUuid: row.user_uuid ?? "",
    createdAt: row.created_at,
  };
}

export async function loadUsers(): Promise<UserAccount[]> {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as UserRow[]).map(mapRowToUser);
}

export async function addUser(input: CreateUserInput): Promise<UserAccount> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        role: input.role,
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user?.id) {
    throw new Error("Unable to create authentication user.");
  }

  const payload = {
    full_name: input.fullName.trim(),
    building_id: input.role === "Staff" ? (input.buildingId ?? null) : null,
    role: input.role,
    status: input.status,
    user_uuid: authData.user.id,
  };
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return { ...mapRowToUser(data as UserRow), email: input.email.trim() };
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserAccount> {
  const payload: Record<string, string | number | null> = {};
  if (typeof input.fullName === "string") payload.full_name = input.fullName.trim();
  if (typeof input.role === "string") payload.role = input.role;
  if (typeof input.status === "string") payload.status = input.status;
  if ("buildingId" in input) payload.building_id = input.buildingId ?? null;

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update(payload)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRowToUser(data as UserRow);
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from(USERS_TABLE)
    .delete()
    .eq("id", userId);
  if (error) throw error;
}

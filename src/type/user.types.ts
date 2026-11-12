export type Role = "Admin" | "Supervisor" | "Staff" | "Viewer";

export function toRole(value: unknown): Role | null {
  return value === "Admin" || value === "Supervisor" || value === "Staff" || value === "Viewer" ? value : null;
}
export type Status = "Active" | "Inactive";

export type UserAccount = {
  id: string;
  fullName: string;
  email?: string;
  buildingId: number | null;
  role: Role;
  status: Status;
  userUuid: string;
  createdAt: string;
};

export type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  buildingId?: number | null;
  role: Role;
  status: Status;
};

export type UpdateUserInput = Partial<Pick<UserAccount, "fullName" | "buildingId" | "role" | "status">>;

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_NAME = 120;
const MAX_EMP_ID = 64;
const MAX_DEPT = 120;
const MAX_MOBILE = 32;

export async function updateMyProfileAction(input: {
  displayName: string;
  employeeId: string;
  department: string;
  mobile: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in.");

  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Name is required.");

  const employeeId = input.employeeId.trim().slice(0, MAX_EMP_ID);
  const department = input.department.trim().slice(0, MAX_DEPT);
  const mobile = input.mobile.trim().slice(0, MAX_MOBILE);

  if (displayName.length > MAX_NAME) throw new Error("Name is too long.");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      employee_id: employeeId || null,
      department: department || null,
      mobile: mobile || null,
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  revalidatePath("/settings/team");
}

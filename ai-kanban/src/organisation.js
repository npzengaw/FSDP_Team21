// src/organisation.js
import { supabase } from "./supabaseClient";

/**
 * Assumed tables (edit to match your schema):
 * - organisations: { id, name, created_by, created_at }
 * - organisation_members: { id, organisation_id, user_id, role, created_at }
 *
 * If your table/column names differ, change them here.
 */

export async function getMyOrganisations(userId) {
  if (!userId) return [];

  // Organisations where user is a member
  const { data: memberRows, error: memErr } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId);

  if (memErr) throw memErr;

  const orgIds = (memberRows || []).map((r) => r.organisation_id).filter(Boolean);
  if (orgIds.length === 0) return [];

  const { data: orgs, error: orgErr } = await supabase
    .from("organisations")
    .select("*")
    .in("id", orgIds)
    .order("created_at", { ascending: false });

  if (orgErr) throw orgErr;
  return orgs || [];
}

export async function getMembers(organisationId) {
  if (!organisationId) return [];

  // Join members -> profiles (assuming profiles.id = user_id)
  const { data, error } = await supabase
    .from("organisation_members")
    .select(
      `
      id,
      role,
      created_at,
      user_id,
      profiles:profiles (
        id,
        username,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createOrganisation({ name, userId }) {
  if (!name?.trim()) throw new Error("Organisation name is required");
  if (!userId) throw new Error("User not logged in");

  // 1) create org
  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert([{ name: name.trim(), created_by: userId }])
    .select("*")
    .single();

  if (orgErr) throw orgErr;

  // 2) add creator as admin
  const { error: memErr } = await supabase.from("organisation_members").insert([
    {
      organisation_id: org.id,
      user_id: userId,
      role: "admin",
    },
  ]);

  if (memErr) throw memErr;

  return org;
}

export async function joinOrganisation({ organisationId, userId }) {
  if (!organisationId) throw new Error("Organisation ID is required");
  if (!userId) throw new Error("User not logged in");

  // avoid duplicates
  const { data: existing, error: exErr } = await supabase
    .from("organisation_members")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (exErr) throw exErr;
  if (existing?.id) return { joined: false, reason: "already_member" };

  const { error } = await supabase.from("organisation_members").insert([
    { organisation_id: organisationId, user_id: userId, role: "member" },
  ]);

  if (error) throw error;
  return { joined: true };
}

export async function leaveOrganisation({ organisationId, userId }) {
  if (!organisationId) throw new Error("Organisation ID is required");
  if (!userId) throw new Error("User not logged in");

  const { error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("user_id", userId);

  if (error) throw error;
  return { left: true };
}

export async function deleteOrganisation({ organisationId }) {
  if (!organisationId) throw new Error("Organisation ID is required");

  // delete members first (if you don't have ON DELETE CASCADE)
  const { error: memErr } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", organisationId);

  if (memErr) throw memErr;

  const { error: orgErr } = await supabase
    .from("organisations")
    .delete()
    .eq("id", organisationId);

  if (orgErr) throw orgErr;
  return { deleted: true };
}

// Keep default export too (so old imports won't break)
export default {
  getMyOrganisations,
  getMembers,
  createOrganisation,
  joinOrganisation,
  leaveOrganisation,
  deleteOrganisation,
};

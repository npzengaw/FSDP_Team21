import { supabase } from "./supabaseClient.js";

// 🧮 Helper to generate a random 6-character alphanumeric PIN
function generateRandomPin(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pin = "";
  for (let i = 0; i < length; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

// 🏗️ Create a new organisation
export async function createOrganisation(name, owner_id) {
  if (!name || !owner_id) {
    return { error: { message: "Organisation name and owner ID are required." } };
  }

  const pin = generateRandomPin();

  const payload = {
    name: name.trim(),
    pin,
    owner_id,
  };

  const { data, error } = await supabase
    .from("organisations")
    .insert([payload])
    .select()
    .maybeSingle();

  return { data, error };
}

// 👥 Join an organisation using name + PIN
export async function joinOrganisation(name, pin, user_id) {
  if (!name || !pin || !user_id) {
    return { error: { message: "Organisation name, PIN, and user ID are required." } };
  }

  const trimmedName = name.trim();
  const trimmedPin = pin.trim();

  // Find organisation
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id, owner_id, name")
    .eq("name", trimmedName)
    .eq("pin", trimmedPin)
    .maybeSingle();

  if (orgError) return { error: { message: orgError.message } };
  if (!org) return { error: { message: "Invalid organisation name or PIN." } };

  // Check existing membership
  const { data: existingMember } = await supabase
    .from("organisation_members")
    .select("*")
    .eq("organisation_id", org.id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existingMember) return { error: { message: "Already a member." } };

  // Skip if owner
  if (user_id === org.owner_id) return { error: { message: "Owner is already part of org." } };

  const { data, error } = await supabase
    .from("organisation_members")
    .insert([{ organisation_id: org.id, user_id, role: "developer", owner_id: org.owner_id }])
    .select()
    .maybeSingle();

  return { data, error };
}

// 🧠 Get all organisations for a user
export async function getMyOrganisations(user_id) {
  if (!user_id) return { error: { message: "Missing user ID" } };

  const { data: owned, error: ownedError } = await supabase
    .from("organisations")
    .select("*")
    .eq("owner_id", user_id);
  if (ownedError) return { error: ownedError };

  const { data: memberRows, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user_id);
  if (memberError) return { error: memberError };

  const memberOrgIds = memberRows?.map(m => m.organisation_id) || [];
  let joined = [];

  if (memberOrgIds.length > 0) {
    const { data: joinedData, error: joinedError } = await supabase
      .from("organisations")
      .select("*")
      .in("id", memberOrgIds);
    if (joinedError) return { error: joinedError };

    joined = joinedData.filter(org => !owned.some(o => o.id === org.id));
  }

  return { data: [...owned, ...joined], error: null };
}

// 👀 Get members of an organisation with profile info (exclude owner)
export async function getMembers(orgId) {
  if (!orgId) return { error: { message: "Org ID required." } };

  const { data: members, error } = await supabase
    .from("organisation_members")
    .select("*")
    .eq("organisation_id", orgId);

  if (!members) return { data: [], error };

  const memberProfiles = await Promise.all(
    members
      .filter(m => m.user_id !== m.owner_id)
      .map(async (m) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url, avatar_color")
          .eq("id", m.user_id)
          .maybeSingle();
        return { ...m, ...profile };
      })
  );

  return { data: memberProfiles, error: null };
}

// ❌ Kick a member (owner only)
export async function kickMember(orgId, memberId, currentUserId) {
  if (!orgId || !memberId || !currentUserId)
    return { error: { message: "Org ID, member ID, and current user ID required." } };

  const { data: org } = await supabase
    .from("organisations")
    .select("owner_id")
    .eq("id", orgId)
    .maybeSingle();

  if (!org || org.owner_id !== currentUserId)
    return { error: { message: "Only the owner can kick members." } };

  const { data, error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", orgId)
    .eq("user_id", memberId);

  return { data, error };
}

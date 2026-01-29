// src/organisation.js
import { supabase } from "./supabaseClient";

/* =========================
   helpers
========================= */
function makePin(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function normName(s) {
  return (s || "").trim();
}

/* =========================
   GET: my organisations
   - SAFE (no embeds)
========================= */
export async function getMyOrganisations(userId) {
  try {
    // 1) orgs I own
    const ownedRes = await supabase
      .from("organisations")
      .select("*")
      .eq("owner_id", userId);

    if (ownedRes.error) throw ownedRes.error;

    // 2) orgs I'm a member of
    const memRes = await supabase
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", userId);

    if (memRes.error) throw memRes.error;

    const memberOrgIds = (memRes.data || []).map((r) => r.organisation_id);

    let memberOrgs = [];
    if (memberOrgIds.length > 0) {
      const orgRes = await supabase
        .from("organisations")
        .select("*")
        .in("id", memberOrgIds);

      if (orgRes.error) throw orgRes.error;
      memberOrgs = orgRes.data || [];
    }

    // 3) merge + dedupe
    const map = new Map();
    for (const o of [...(ownedRes.data || []), ...memberOrgs]) {
      map.set(o.id, o);
    }

    const merged = Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    return { data: merged, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   GET: members of an org
========================= */
export async function getMembers(orgId) {
  try {
    const res = await supabase
      .from("organisation_members")
      .select("user_id, role, profiles:profiles(id, username)")
      .eq("organisation_id", orgId);

    if (res.error) throw res.error;

    const cleaned = (res.data || []).map((r) => ({
      user_id: r.user_id,
      role: r.role,
      username: r.profiles?.username || "",
    }));

    return { data: cleaned, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   CREATE org
   IMPORTANT: your organisation_members table has owner_id (NOT NULL)
========================= */
export async function createOrganisation(name, ownerId) {
  try {
    const orgName = normName(name);
    if (!orgName) throw new Error("Workspace name is required.");

    const pin = makePin(6);

    const orgRes = await supabase
      .from("organisations")
      .insert([{ name: orgName, owner_id: ownerId, pin }])
      .select("*")
      .single();

    if (orgRes.error) throw orgRes.error;

    // ✅ insert membership with owner_id filled
    const memRes = await supabase.from("organisation_members").insert([
      {
        organisation_id: orgRes.data.id,
        user_id: ownerId,
        owner_id: ownerId,
        role: "owner",
      },
    ]);

    if (memRes.error) throw memRes.error;

    return { data: orgRes.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   JOIN org by (name + pin)
   IMPORTANT: owner_id NOT NULL in organisation_members
========================= */
export async function joinOrganisation(name, pin, userId) {
  try {
    const orgName = normName(name);
    const orgPin = normName(pin);

    if (!orgName || !orgPin) throw new Error("Workspace name and PIN are required.");

    const orgRes = await supabase
      .from("organisations")
      .select("*")
      .eq("name", orgName)
      .eq("pin", orgPin)
      .single();

    if (orgRes.error) throw orgRes.error;

    const memRes = await supabase.from("organisation_members").insert([
      {
        organisation_id: orgRes.data.id,
        user_id: userId,
        owner_id: orgRes.data.owner_id, // ✅ required
        role: "developer", // keep your existing roles style
      },
    ]);

    if (memRes.error) throw memRes.error;

    return { data: orgRes.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   LEAVE org
========================= */
export async function leaveOrganisation(orgId, userId) {
  try {
    const res = await supabase
      .from("organisation_members")
      .delete()
      .eq("organisation_id", orgId)
      .eq("user_id", userId);

    if (res.error) throw res.error;

    return { data: true, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   DELETE org (owner only)
========================= */
export async function deleteOrganisation(orgId, userId) {
  try {
    const orgRes = await supabase
      .from("organisations")
      .select("id, owner_id")
      .eq("id", orgId)
      .single();

    if (orgRes.error) throw orgRes.error;
    if (orgRes.data.owner_id !== userId) {
      throw new Error("Only the owner can delete this workspace.");
    }

    const memDel = await supabase
      .from("organisation_members")
      .delete()
      .eq("organisation_id", orgId);

    if (memDel.error) throw memDel.error;

    const orgDel = await supabase.from("organisations").delete().eq("id", orgId);
    if (orgDel.error) throw orgDel.error;

    return { data: true, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

import { supabase } from './supabaseClient.js';

// ------------------
// 1️⃣ Sign up user
// ------------------
export async function signUpUser(email, password) {
  if (!email || !password) {
    return { data: null, error: { message: "Email and password are required." } };
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  return { data, error };
}

// ------------------
// 2️⃣ Create profile (after first login)
// ------------------
export async function createProfile(username, description) {
  const user = await getCurrentUser();
  if (!user) return { data: null, error: { message: "No authenticated user." } };

  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        id: user.id,
        username,
        description,
        avatar_url: null,
        avatar_color: getRandomColor(),
      },
    ])
    .select()
    .maybeSingle();

  return { data, error };
}

// ------------------
// 3️⃣ Sign in user
// ------------------
export async function signIn(email, password) {
  if (!email || !password) return { data: null, error: { message: "Email and password required." } };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ------------------
// 4️⃣ Sign out
// ------------------
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}

// ------------------
// 5️⃣ Get current user
// ------------------
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ------------------
// 6️⃣ Get current user's profile
// ------------------
export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return profile;
}

// ------------------
// 7️⃣ Utility: random hex color for avatar
// ------------------
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

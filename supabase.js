
// Supabase client via CDN
const { createClient } = supabase;

const SUPABASE_URL = "https://hlleyvltrlopiagyrvbr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGV5dmx0cmxvcGlhZ3lydmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjE3NTksImV4cCI6MjA4MDQzNzc1OX0.L_8J118cgDWAgxe4B7t6RxU3gjEXzKWDvj53cIMFX7k";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Supabase ENV tidak ditemukan");
}



export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

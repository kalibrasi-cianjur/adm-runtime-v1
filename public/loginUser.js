const { data: authData } = await supabase.auth.signInWithPassword({
  email: username + "@example.com",
  password
});

const { data: userData } = await supabase.from('users')
    .select('*')
    .eq('auth_id', authData.user.id)
    .single();

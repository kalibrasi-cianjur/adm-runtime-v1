const { data: authData } = await supabase.auth.signUp({
  email: username + "@example.com",
  password
});

await supabase.from('users').insert([{
  auth_id: authData.user.id,
  username,
  role: 'user'
}]);

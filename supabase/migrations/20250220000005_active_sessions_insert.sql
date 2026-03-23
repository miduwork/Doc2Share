-- Allow authenticated users to insert their own active_sessions row (single-session enforcement on login)
CREATE POLICY "Users can insert own active_sessions"
  ON active_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

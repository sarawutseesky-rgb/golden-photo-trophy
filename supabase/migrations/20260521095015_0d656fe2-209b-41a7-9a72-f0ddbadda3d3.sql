-- Drop the old policy that allowed anyone (including anonymous) to read chat messages
DROP POLICY IF EXISTS "chat_messages_select_all" ON public.chat_messages;

-- Only authenticated users can read chat messages
CREATE POLICY "chat_messages_select_authenticated"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);

-- Ensure the insert policy is explicit about authentication
-- (already effectively requires auth because auth.uid() must match user_id)
DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure delete policy remains: own messages or admin only
DROP POLICY IF EXISTS "chat_messages_delete_own_or_admin" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own_or_admin"
ON public.chat_messages
FOR DELETE
TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));
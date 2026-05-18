CREATE POLICY "votes_delete_own"
ON public.votes
FOR DELETE
USING (auth.uid() = voter_id);
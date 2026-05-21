
-- Recreate daily upload cap trigger function with limit = 1
CREATE OR REPLACE FUNCTION public.enforce_daily_upload_cap()
RETURNS TRIGGER AS $$
DECLARE
    daily_limit INT := 1;
    today_count INT;
BEGIN
    SELECT COUNT(*) INTO today_count
    FROM public.photos
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('day', now());

    IF today_count >= daily_limit THEN
        RAISE EXCEPTION 'คุณอัปโหลดครบ 1 รูปสำหรับวันนี้แล้ว พรุ่งนี้ค่อยมาอัปต่อนะ';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

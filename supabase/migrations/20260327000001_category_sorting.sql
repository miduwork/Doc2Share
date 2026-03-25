-- Add position column for manual/logical sorting of categories
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

-- Update existing Grades to have numeric positions
UPDATE public.categories SET position = 1 WHERE name = 'Lớp 1' AND type = 'grade';
UPDATE public.categories SET position = 2 WHERE name = 'Lớp 2' AND type = 'grade';
UPDATE public.categories SET position = 3 WHERE name = 'Lớp 3' AND type = 'grade';
UPDATE public.categories SET position = 4 WHERE name = 'Lớp 4' AND type = 'grade';
UPDATE public.categories SET position = 5 WHERE name = 'Lớp 5' AND type = 'grade';
UPDATE public.categories SET position = 6 WHERE name = 'Lớp 6' AND type = 'grade';
UPDATE public.categories SET position = 7 WHERE name = 'Lớp 7' AND type = 'grade';
UPDATE public.categories SET position = 8 WHERE name = 'Lớp 8' AND type = 'grade';
UPDATE public.categories SET position = 9 WHERE name = 'Lớp 9' AND type = 'grade';
UPDATE public.categories SET position = 10 WHERE name = 'Lớp 10' AND type = 'grade';
UPDATE public.categories SET position = 11 WHERE name = 'Lớp 11' AND type = 'grade';
UPDATE public.categories SET position = 12 WHERE name = 'Lớp 12' AND type = 'grade';

-- Update Subjects and Exams with incremental positions based on current ID to maintain current order but allow future overrides
DO $$
DECLARE
    r RECORD;
    pos INT;
BEGIN
    pos := 100; -- Start subjects/exams at 100 to leave space for grades
    FOR r IN (SELECT id FROM public.categories WHERE type IN ('subject', 'exam') ORDER BY type, id) LOOP
        UPDATE public.categories SET position = pos WHERE id = r.id;
        pos := pos + 1;
    END LOOP;
END $$;

-- Disable the two division accounts without deleting staff rows or historical attribution.
-- Verify these exact staff identities first; expected affected rows: two.
UPDATE staff_users
SET active = 0
WHERE active = 1
  AND (
    (name = 'Tri Lutfia Yusuf' AND role = 'technology')
    OR (name = 'Reva Febrianti' AND role = 'marketing')
  );

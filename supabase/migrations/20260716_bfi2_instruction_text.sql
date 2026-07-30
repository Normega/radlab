-- Update the BFI-2 instruction wording from "Please write a number next to
-- each statement" to "Please select a number" (the platform uses a
-- clickable scale, not free-text entry) for both BFI-2 variants.

UPDATE questionnaires
SET definition = jsonb_set(
  definition,
  '{instructions}',
  to_jsonb(
    replace(
      definition->>'instructions',
      'Please write a number next to each statement to indicate',
      'Please select a number to indicate'
    )
  )
),
updated_at = now()
WHERE slug IN ('bfi-2-xs', 'bfi-2-s');

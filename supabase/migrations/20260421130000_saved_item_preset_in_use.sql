-- Detect whether a saved item preset is referenced on any document line (JSON item_preset_id).
-- Runs after packing_lists.packages exists.

create or replace function public.saved_item_preset_is_in_use(p_organization_id uuid, p_preset_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.quotations q
      where q.organization_id = p_organization_id
        and jsonb_typeof(q.lines) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(q.lines) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    )
    or exists (
      select 1
      from public.packing_lists pl
      where pl.organization_id = p_organization_id
        and jsonb_typeof(pl.packages) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(pl.packages) pkg
          cross join lateral jsonb_array_elements(coalesce(pkg->'lines', '[]'::jsonb)) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    )
    or exists (
      select 1
      from public.delivery_challans dc
      where dc.organization_id = p_organization_id
        and jsonb_typeof(dc.line_items) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(dc.line_items) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    ),
    false
  );
$$;

grant execute on function public.saved_item_preset_is_in_use(uuid, uuid) to authenticated;

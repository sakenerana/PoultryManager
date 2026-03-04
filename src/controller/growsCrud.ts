import supabase from "../utils/supabase";
import type {
  CreateGrowPayload,
  CrudResult,
  GrowRow,
  GrowWithRelations,
  ListGrowsFilters,
  LoadRow,
  LoadTransactionInsertDto,
  LoadTransactionRow,
  UpdateGrowPayload,
} from "../type/grows.type";

const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const LOAD_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TABLE ?? "Load";
const LOAD_TRANSACTIONS_TABLE =
  import.meta.env.VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE ?? "LoadTransactions";

const RPC_CREATE_GROW = import.meta.env.VITE_SUPABASE_RPC_CREATE_GROW ?? "rpc_create_grow_bundle";
const RPC_UPDATE_GROW = import.meta.env.VITE_SUPABASE_RPC_UPDATE_GROW ?? "rpc_update_grow_bundle";
const RPC_DELETE_GROW = import.meta.env.VITE_SUPABASE_RPC_DELETE_GROW ?? "rpc_delete_grow_bundle";

type SelectGrowRow = GrowRow & {
  Load?: Array<LoadRow & { LoadTransactions?: LoadTransactionRow[] }>;
};

function toErrorMessage(error: unknown, context: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return `${context}: ${error.message}`;
  }
  return `${context}: Unknown error`;
}

function normalizeGrowWithRelations(row: SelectGrowRow): GrowWithRelations {
  const loadRow = Array.isArray(row.Load) && row.Load.length > 0 ? row.Load[0] : null;

  return {
    id: row.id,
    created_at: row.created_at,
    building_id: row.building_id,
    total_animals: row.total_animals,
    status: row.status,
    is_harvested: row.is_harvested,
    load: loadRow
      ? {
          id: loadRow.id,
          created_at: loadRow.created_at,
          grow_id: loadRow.grow_id,
          truck_plate_no: loadRow.truck_plate_no,
          status: loadRow.status,
          load_transactions: Array.isArray(loadRow.LoadTransactions) ? loadRow.LoadTransactions : [],
        }
      : null,
  };
}

/**
 * Recommended SQL RPC (transactional, atomic)
 *
 * Run in Supabase SQL editor (adjust schema names if needed).
 *
 * -----------------------------------------------------------
 * create or replace function public.rpc_create_grow_bundle(p_payload jsonb)
 * returns jsonb
 * language plpgsql
 * security definer
 * set search_path = public
 * as $$
 * declare
 *   v_grow_id bigint;
 *   v_load_id bigint;
 *   v_tx jsonb;
 *   v_result jsonb;
 * begin
 *   insert into public."Grows" (building_id, total_animals, status, is_harvested)
 *   values (
 *     (p_payload->'grow'->>'building_id')::bigint,
 *     (p_payload->'grow'->>'total_animals')::bigint,
 *     p_payload->'grow'->>'status',
 *     (p_payload->'grow'->>'is_harvested')::boolean
 *   )
 *   returning id into v_grow_id;
 *
 *   insert into public."Load" (grow_id, truck_plate_no, status)
 *   values (
 *     v_grow_id,
 *     p_payload->'load'->>'truck_plate_no',
 *     p_payload->'load'->>'status'
 *   )
 *   returning id into v_load_id;
 *
 *   for v_tx in select * from jsonb_array_elements(coalesce(p_payload->'load_transactions', '[]'::jsonb))
 *   loop
 *     insert into public."LoadTransactions" (load_id, animal_count)
 *     values (v_load_id, (v_tx->>'animal_count')::bigint);
 *   end loop;
 *
 *   select jsonb_build_object(
 *     'id', g.id,
 *     'created_at', g.created_at,
 *     'building_id', g.building_id,
 *     'total_animals', g.total_animals,
 *     'status', g.status,
 *     'is_harvested', g.is_harvested,
 *     'load', (
 *       select jsonb_build_object(
 *         'id', l.id,
 *         'created_at', l.created_at,
 *         'grow_id', l.grow_id,
 *         'truck_plate_no', l.truck_plate_no,
 *         'status', l.status,
 *         'load_transactions', coalesce(
 *           (select jsonb_agg(jsonb_build_object(
 *             'id', lt.id,
 *             'created_at', lt.created_at,
 *             'load_id', lt.load_id,
 *             'animal_count', lt.animal_count
 *           )) from public."LoadTransactions" lt where lt.load_id = l.id),
 *           '[]'::jsonb
 *         )
 *       )
 *       from public."Load" l
 *       where l.id = v_load_id
 *     )
 *   )
 *   into v_result
 *   from public."Grows" g
 *   where g.id = v_grow_id;
 *
 *   return v_result;
 * end;
 * $$;
 * -----------------------------------------------------------
 *
 * Add similar RPCs for update/delete:
 * - rpc_update_grow_bundle(p_grow_id bigint, p_payload jsonb)
 * - rpc_delete_grow_bundle(p_grow_id bigint)
 */

export async function createGrow(payload: CreateGrowPayload): Promise<CrudResult<GrowWithRelations>> {
  try {
    const { data, error } = await supabase.rpc(RPC_CREATE_GROW, {
      p_payload: payload,
    });

    if (error) {
      return { data: null, error: toErrorMessage(error, "Failed to create grow using transactional RPC") };
    }

    return { data: data as GrowWithRelations, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Unexpected createGrow failure") };
  }
}

export async function updateGrow(
  id: number,
  payload: UpdateGrowPayload
): Promise<CrudResult<GrowWithRelations>> {
  try {
    const { data, error } = await supabase.rpc(RPC_UPDATE_GROW, {
      p_grow_id: id,
      p_payload: payload,
    });

    if (error) {
      return { data: null, error: toErrorMessage(error, "Failed to update grow using transactional RPC") };
    }

    return { data: data as GrowWithRelations, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Unexpected updateGrow failure") };
  }
}

export async function getGrowById(id: number): Promise<CrudResult<GrowWithRelations>> {
  try {
    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select(
        `
          id,
          created_at,
          building_id,
          total_animals,
          status,
          is_harvested,
          Load (
            id,
            created_at,
            grow_id,
            truck_plate_no,
            status,
            LoadTransactions (
              id,
              created_at,
              load_id,
              animal_count
            )
          )
        `
      )
      .eq("id", id)
      .single();

    if (error) {
      return { data: null, error: toErrorMessage(error, `Failed to get grow by id=${id}`) };
    }

    return { data: normalizeGrowWithRelations(data as SelectGrowRow), error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Unexpected getGrowById failure") };
  }
}

export async function listGrows(filters?: ListGrowsFilters): Promise<CrudResult<GrowWithRelations[]>> {
  try {
    let query = supabase
      .from(GROWS_TABLE)
      .select(
        `
          id,
          created_at,
          building_id,
          total_animals,
          status,
          is_harvested,
          Load (
            id,
            created_at,
            grow_id,
            truck_plate_no,
            status,
            LoadTransactions (
              id,
              created_at,
              load_id,
              animal_count
            )
          )
        `
      )
      .order("created_at", { ascending: filters?.ascending ?? false });

    if (typeof filters?.building_id === "number") query = query.eq("building_id", filters.building_id);
    if (typeof filters?.status === "string") query = query.eq("status", filters.status);
    if (typeof filters?.is_harvested === "boolean") query = query.eq("is_harvested", filters.is_harvested);
    if (typeof filters?.created_from === "string") query = query.gte("created_at", filters.created_from);
    if (typeof filters?.created_to === "string") query = query.lte("created_at", filters.created_to);
    if (typeof filters?.limit === "number") query = query.limit(filters.limit);
    if (typeof filters?.offset === "number" && typeof filters?.limit === "number") {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: toErrorMessage(error, "Failed to list grows") };
    }

    const rows = (data as SelectGrowRow[]).map(normalizeGrowWithRelations);
    return { data: rows, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Unexpected listGrows failure") };
  }
}

export async function deleteGrow(id: number): Promise<CrudResult<{ id: number }>> {
  try {
    const { error } = await supabase.rpc(RPC_DELETE_GROW, { p_grow_id: id });
    if (error) {
      return { data: null, error: toErrorMessage(error, "Failed to delete grow using transactional RPC") };
    }
    return { data: { id }, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Unexpected deleteGrow failure") };
  }
}

// ----------------------------------------------------------------------------
// NOT RECOMMENDED fallback approach (non-transactional from client)
// ----------------------------------------------------------------------------
// Use only when RPC is not available. This can leave partial writes if network
// failures happen between steps.

async function createGrowNonTransactional_NOT_RECOMMENDED(
  payload: CreateGrowPayload
): Promise<CrudResult<GrowWithRelations>> {
  let createdGrowId: number | null = null;
  let createdLoadId: number | null = null;
  try {
    const growInsert = await supabase
      .from(GROWS_TABLE)
      .insert([payload.grow])
      .select("*")
      .single();
    if (growInsert.error) {
      return { data: null, error: toErrorMessage(growInsert.error, "Fallback create: failed inserting Grows") };
    }
    createdGrowId = (growInsert.data as GrowRow).id;

    const loadInsert = await supabase
      .from(LOAD_TABLE)
      .insert([{ ...payload.load, grow_id: createdGrowId }])
      .select("*")
      .single();
    if (loadInsert.error) {
      await supabase.from(GROWS_TABLE).delete().eq("id", createdGrowId);
      return { data: null, error: toErrorMessage(loadInsert.error, "Fallback create: failed inserting Load") };
    }
    createdLoadId = (loadInsert.data as LoadRow).id;

    const txRows: LoadTransactionInsertDto[] = payload.load_transactions.map((tx) => ({
      animal_count: tx.animal_count ?? null,
    }));
    const txInsert = await supabase
      .from(LOAD_TRANSACTIONS_TABLE)
      .insert(txRows.map((row) => ({ ...row, load_id: createdLoadId })));
    if (txInsert.error) {
      await supabase.from(LOAD_TRANSACTIONS_TABLE).delete().eq("load_id", createdLoadId);
      await supabase.from(LOAD_TABLE).delete().eq("id", createdLoadId);
      await supabase.from(GROWS_TABLE).delete().eq("id", createdGrowId);
      return {
        data: null,
        error: toErrorMessage(txInsert.error, "Fallback create: failed inserting LoadTransactions"),
      };
    }

    return getGrowById(createdGrowId);
  } catch (error) {
    // best-effort cleanup
    if (createdLoadId !== null) await supabase.from(LOAD_TRANSACTIONS_TABLE).delete().eq("load_id", createdLoadId);
    if (createdLoadId !== null) await supabase.from(LOAD_TABLE).delete().eq("id", createdLoadId);
    if (createdGrowId !== null) await supabase.from(GROWS_TABLE).delete().eq("id", createdGrowId);
    return { data: null, error: toErrorMessage(error, "Fallback create: unexpected failure") };
  }
}

export const __NOT_RECOMMENDED_FALLBACK__ = {
  createGrowNonTransactional: createGrowNonTransactional_NOT_RECOMMENDED,
};


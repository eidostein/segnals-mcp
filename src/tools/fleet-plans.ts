/**
 * Fleet plans (SPEC 453 §3.5, §3.8, §3.9) — the write path of a master key.
 *
 * Tools: segnals_plan_fleet, segnals_get_fleet_plan, segnals_apply_fleet_plan ✋, segnals_stop_all_fleet
 *
 * A master key changes its fleet only through plans: it sends many changes as one plan, the server
 * checks them against the settings catalog, the fleet's policy and every key rule, and answers the
 * diff, the risk and every refusal, changing no bot. A checked plan is then applied by its id, as
 * checked, or not at all. The server enforces every rule; these tools never decide one.
 *
 * Routes: POST /fleet/plans and GET /fleet/plans/<id> (segnals-test S4); POST /fleet/plans/<id>/apply
 * and POST /fleet/stop-all (S7, written against SPEC 453 §3.5 and §3.8).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { SegnalsApiError } from "../errors.js";
import { fleetError, refusal } from "./fleet.js";
import { ok, type ToolResult } from "./helpers.js";

/** The exchanges a fleet bot runs on (§3.4 `allowed_exchanges`). */
export const PLAN_EXCHANGES = ["mt5", "bybit", "phemex"] as const;
/** The most items one plan holds: the API answers a longer list 400 and stores nothing. */
export const MOST_ITEMS = 500;
/** `bots.id` is a Postgres integer. */
const MOST_ID = 2 ** 31 - 1;

/**
 * The `Idempotency-Key` of the apply of one plan. It is derived from the plan id alone, so a repeated
 * apply of the same plan (a retry after a timeout, or a second call) gets the first result and does
 * nothing more (§3.5).
 */
export function idempotencyKey(planId: string): string {
  return `segnals-mcp-apply-${planId}`;
}

const botId = z.number().int().positive().max(MOST_ID).describe("The id of a bot in this fleet (segnals_get_fleet bot_ids)");
const config = z
  .record(z.string(), z.unknown())
  .describe(
    "Settings to set, nested by catalog path: { TRADING_PARAMS: { LEVERAGE: 3 } } sets TRADING_PARAMS.LEVERAGE. " +
      "Only paths segnals_get_settings_catalog lists for this engine, inside their range, with key_may_change true. " +
      "Never a credential.",
  );

/**
 * One change, as the API's plan check reads it (segnals-test `app/services/fleet/plans.py`, `ITEM_FIELDS`).
 * A field the action does not take is dropped here, as the API drops it: `risk_acknowledged` never
 * reaches a plan (§3.6).
 */
export const PLAN_ITEM = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    exchange: z.enum(PLAN_EXCHANGES).describe("The new bot's exchange: mt5, bybit or phemex"),
    connection_id: z
      .string()
      .min(1)
      .max(64)
      .describe("The account it trades on: one of the fleet's allowed connections (segnals_get_fleet connections[].id)"),
    name: z.string().max(100).optional().describe("The bot's name"),
    from: z
      .union([z.literal("default"), z.object({ bot_id: botId })])
      .optional()
      .describe('"default" (the engine\'s default config, the default) or { bot_id } to copy a fleet bot of the same engine'),
    config: config.optional(),
    start: z.boolean().optional().describe("true to start it once created. Default false: it stays stopped"),
  }),
  z.object({ action: z.literal("update"), bot_id: botId, config }),
  z.object({ action: z.literal("start"), bot_id: botId }),
  z.object({ action: z.literal("stop"), bot_id: botId }),
  z.object({ action: z.literal("delete"), bot_id: botId }),
]);

const planId = z.uuid().describe("The plan_id segnals_plan_fleet answered, for this same account");

/** The plan as the API answers it (`plan_answer`): only the fields these tools read. */
interface Plan {
  plan_id?: unknown;
  status?: unknown;
  expires_at?: unknown;
  counts?: unknown;
  needs_confirmation?: unknown;
  refusals?: unknown;
  items?: unknown;
  [field: string]: unknown;
}

function statusOf(plan: Plan): string | undefined {
  return typeof plan.status === "string" ? plan.status : undefined;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const SHOW_IT =
  "Show the person this plan before anything is applied: each item's diff (every setting before → after), the risk " +
  "per bot, the totals per account against the caps (accounts, caps), which items act on real money (real_money) " +
  "and which wait for the account holder's confirmation (needs_confirmation), and the warnings.";

/** What to do next with a plan in each status (§3.5, §3.6, §3.8). */
function nextFor(plan: Plan, id: string): string {
  switch (statusOf(plan)) {
    case "checked":
      return (
        `Nothing has changed yet. ${SHOW_IT} When the person approves exactly this plan, apply it with ` +
        `segnals_apply_fleet_plan({ plan_id: "${id}" }) to preview, then with confirm: true, before expires_at. ` +
        "For any other change, check a new plan; never apply one the person has not seen."
      );
    case "refused":
      return (
        "This plan was refused and can never be applied; nothing changed. Each refusal names the item (its position " +
        "in items, from 0; null for the plan as a whole), the setting path and a code. Fix those items and check a " +
        "new plan, or tell the person why it cannot be done. Do not send the same items again unchanged."
      );
    case "applying":
      return (
        "It is being applied. Starts are released in batches (25 a minute by default), so some items may still be " +
        "pending. Read it again with segnals_get_fleet_plan in a minute; do not apply it again."
      );
    case "applied":
      return "It is applied: every item is done, and each item's status says so. Tell the person what changed.";
    case "applied_with_errors":
      return (
        "It is applied with errors: the items whose status is not done failed, and their error says why. The other " +
        "items are done. Tell the person which failed and why; a fix is a new plan."
      );
    case "awaiting_confirmation":
      return (
        "Some items wait for the account holder's confirmation in Settings → Bot manager (a real-money change, or " +
        "every start when the fleet's confirm_every_start is set). Nothing waiting has started. Tell the person; you " +
        "cannot confirm it, and never say those bots started until this plan says applied."
      );
    case "failed":
      return "Applying it failed and was rolled back: no bot changed. Tell the person; to try again, check a new plan.";
    case "cancelled":
    case "declined":
    case "expired":
      return (
        `It ended without being applied (${String(plan.status)}). Nothing more happens with it. If the change is ` +
        "still wanted, check a new plan and show it to the person."
      );
    default:
      return "Tell the person the plan's status as Segnals gave it.";
  }
}

/** A one-line account of what applying a checked plan would do, from the plan's own counts. */
function previewLine(plan: Plan): string {
  const counts = (typeof plan.counts === "object" && plan.counts !== null ? plan.counts : {}) as Record<string, unknown>;
  const actions = ["create", "update", "start", "stop", "delete"]
    .filter((action) => count(counts[action]) > 0)
    .map((action) => `${count(counts[action])} ${action}`);
  const items = Array.isArray(plan.items) ? (plan.items as Record<string, unknown>[]) : [];
  const realMoney = items.filter((item) => item?.real_money === true).length;
  return (
    `Will apply ${items.length} item${items.length === 1 ? "" : "s"}` +
    (actions.length > 0 ? ` (${actions.join(", ")})` : "") +
    `; ${count(counts.new_running)} bot(s) will start running; ${realMoney} item(s) act on real money; ` +
    `${count(plan.needs_confirmation)} wait for the account holder's confirmation.`
  );
}

/** The API's own error codes of the plan routes, and what to do about each. */
const PLAN_NEXT_STEP = new Map<string, string>(
  Object.entries({
    plan_stale:
      "A bot of this plan changed after the check, so nothing was applied. Check the plan again with " +
      "segnals_plan_fleet and show the person the new diff before applying it.",
    rate_limited:
      "This fleet has used its hourly allowance for this action: 30 plan checks, 10 applies and 3 stop-alls an hour. " +
      "Wait as long as the message says before you try again; do not retry sooner.",
    invalid_plan: `Send items as a list of 1 to ${MOST_ITEMS} changes, each with its action.`,
    fleet_stopped_all:
      "The fleet was stopped with stop all, and only the account holder can resume it, in Settings → Bot manager. " +
      "Tell the person; a plan that starts a bot is refused until then.",
  }),
);

/** A 409 or 410 from the apply that carries no code of its own. */
const PLAN_NOT_APPLICABLE =
  "This plan cannot be applied in its present status. Read it with segnals_get_fleet_plan: a refused, expired, " +
  "cancelled or declined plan never applies, and an applied one is done. To make a change, check a new plan.";

/** The plan routes' own 404: the plan is not this key's to see. */
const PLAN_NOT_VISIBLE =
  "No plan with this id is visible to this key: it belongs to another fleet or account, or the id is wrong. Use the " +
  "plan_id that segnals_plan_fleet answered for this same account. A plan is never visible across accounts.";

interface PlanErrorOptions {
  /** A 404 without the API's JSON (Flask's own page): the route does not exist on this server. */
  routeMissing: string;
  /** A 404 with the API's JSON: the route exists and found nothing for this key. */
  notVisible?: string;
  /** A 409 or 410 with no code of its own. */
  conflict?: string;
  /** Said after the next step of every error of this tool. */
  also?: string;
}

/** A plan tool's error: what happened, then what to do next. */
function planError(error: unknown, options: PlanErrorOptions): ToolResult {
  const { routeMissing, notVisible = PLAN_NOT_VISIBLE, conflict, also } = options;
  let result: ToolResult;
  if (error instanceof SegnalsApiError && error.statusCode === 404) {
    result = refusal(error.message, error.apiError === undefined ? routeMissing : notVisible);
  } else if (
    conflict !== undefined &&
    error instanceof SegnalsApiError &&
    (error.statusCode === 409 || error.statusCode === 410) &&
    !PLAN_NEXT_STEP.has(error.apiError ?? "")
  ) {
    result = refusal(error.message, conflict);
  } else {
    result = fleetError(error, { notFound: routeMissing, more: PLAN_NEXT_STEP, what: "request" });
  }
  if (also !== undefined) result.content[0].text += ` ${also}`;
  return result;
}

const NO_PLAN_ROUTES =
  "This server has no plan routes: it predates the plan check (SPEC 453). Tell the person; nothing was planned or changed.";
const NO_APPLY_ROUTE =
  "This server cannot apply plans yet: it has no apply route (SPEC 453 S7). Nothing was applied. Tell the person.";
const NO_STOP_ALL_ROUTE =
  "This server has no stop-all route (SPEC 453 S7), so nothing was stopped.";
const NO_FLEET_TO_STOP = "Segnals found no fleet of this key to stop, so nothing was stopped.";
const STOP_ALL_FAILED =
  "Until a stop all succeeds, assume every bot of the fleet still runs: tell the person at once. The account holder " +
  "can stop each bot from the dashboard.";

export function registerFleetPlanTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_plan_fleet ──
  server.tool(
    "segnals_plan_fleet",
    `Check a plan of changes to this account's fleet. It changes no bot: the server judges every item against the settings catalog, the fleet's policy and caps, the account's bot limit and every key rule, stores the plan for 24 hours, and answers plan_id, status ("checked" or "refused"), expires_at, the counts per action, per item the diff (before → after for each changed setting), its risk and whether it is real money, the totals per account against the caps, needs_confirmation, refusals (each with the item's position, the path and a code) and warnings. Read segnals_get_settings_catalog and segnals_get_fleet first. Each item is one of: { action: "create", exchange, connection_id, name?, from?: "default" | { bot_id }, config?, start? }, { action: "update", bot_id, config }, { action: "start" | "stop" | "delete", bot_id }. Items are judged in order, so a start after an update is judged on the updated config. Plan one account per call; the plan acts only on the fleet of the key of the account you name. Then show the person the diff, and apply only a plan they approved with segnals_apply_fleet_plan. A fleet may check 30 plans an hour. Requires: a master key (manage:fleet). Example: segnals_plan_fleet({ items: [{ action: "create", exchange: "bybit", connection_id: "<id>", name: "BTC grid 1", config: { TRADING_PARAMS: { LEVERAGE: 3 } }, start: true }] })`,
    {
      items: z
        .array(PLAN_ITEM)
        .min(1)
        .max(MOST_ITEMS)
        .describe(`The changes, in the order they apply: 1 to ${MOST_ITEMS}, and at most the policy's max_items_per_plan`),
    },
    // It changes nothing on the account (§3.9): the stored plan is the check's answer, and only an apply acts on it.
    { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
    async ({ items }): Promise<ToolResult> => {
      try {
        const plan = await client.post<Plan>("/fleet/plans", { items });
        const id = typeof plan.plan_id === "string" ? plan.plan_id : "<plan_id>";
        return ok({ next_step: nextFor(plan, id), ...plan });
      } catch (error) {
        return planError(error, { routeMissing: NO_PLAN_ROUTES });
      }
    },
  );

  // ── segnals_get_fleet_plan ──
  server.tool(
    "segnals_get_fleet_plan",
    `Read one plan of this account's fleet: its status (checked, refused, applying, applied, applied_with_errors, awaiting_confirmation, failed, cancelled, declined, expired), expires_at, the counts, every item with its diff, risk and present status, the totals against the caps and the refusals. Use it to show the person a plan again, and after segnals_apply_fleet_plan to follow it: starts are released in batches, so read it until it says applied. Never say a real-money bot started until the plan says applied. Requires: a master key (manage:fleet). Example: segnals_get_fleet_plan({ plan_id: "<plan_id>" })`,
    { plan_id: planId },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ plan_id }): Promise<ToolResult> => {
      try {
        const plan = await client.get<Plan>(`/fleet/plans/${encodeURIComponent(plan_id)}`);
        return ok({ next_step: nextFor(plan, plan_id), ...plan });
      } catch (error) {
        return planError(error, { routeMissing: NO_PLAN_ROUTES });
      }
    },
  );

  // ── segnals_apply_fleet_plan ✋ ──
  server.tool(
    "segnals_apply_fleet_plan",
    `Apply a checked plan of this account's fleet, exactly as it was checked. This changes bots: it creates, updates, starts, stops and deletes them as the plan says.

TWO-STEP CONFIRMATION: call without confirm to preview: it reads the stored plan and changes nothing. Show the person that plan (every diff, the risk, real money, the caps) and wait for their approval. Then call again with confirm: true. Apply only a plan the person approved; for any other change, check a new plan with segnals_plan_fleet.
The apply carries an Idempotency-Key made from the plan id, so applying the same plan twice does nothing more. A plan whose bots changed since the check is refused (plan_stale) and nothing is applied. Starts are released in batches (25 a minute by default): follow them with segnals_get_fleet_plan, and never say a real-money bot started until the plan says applied. Items that need the account holder's confirmation wait for it in Settings → Bot manager; you cannot confirm them. A fleet may apply 10 plans an hour. Requires: a master key (manage:fleet). Example: segnals_apply_fleet_plan({ plan_id: "<plan_id>", confirm: true })`,
    {
      plan_id: planId,
      confirm: z.boolean().optional().default(false).describe("Set to true to apply, after the person approved the preview"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ({ plan_id, confirm }): Promise<ToolResult> => {
      const path = `/fleet/plans/${encodeURIComponent(plan_id)}`;
      if (!confirm) {
        try {
          const plan = await client.get<Plan>(path);
          const checked = statusOf(plan) === "checked";
          return ok({
            action: "apply_fleet_plan",
            preview: checked ? previewLine(plan) : `This plan is ${String(plan.status)} and cannot be applied.`,
            can_apply: checked,
            instruction: checked
              ? `${SHOW_IT} Only once the person approves exactly this plan, call segnals_apply_fleet_plan again with ` +
                `plan_id "${plan_id}" and confirm: true, before expires_at.`
              : nextFor(plan, plan_id),
            plan,
          });
        } catch (error) {
          return planError(error, { routeMissing: NO_PLAN_ROUTES });
        }
      }
      try {
        const result = await client.request<Plan>(`${path}/apply`, {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey(plan_id) },
        });
        return ok({ next_step: nextFor(result, plan_id), ...result });
      } catch (error) {
        return planError(error, { routeMissing: NO_APPLY_ROUTE, conflict: PLAN_NOT_APPLICABLE });
      }
    },
  );

  // ── segnals_stop_all_fleet ──
  server.tool(
    "segnals_stop_all_fleet",
    `Stop every running, starting or warming-up bot of this account's fleet at once, through the same stop as the dashboard's Stop, and cancel the fleet's plans not yet applied. No preview: it only reduces risk, so use it at once when the person asks to stop everything or something is going wrong. Bots outside the fleet are not touched. With this key, a protected bot, and for a test key a real-money bot, is skipped and named in the answer: tell the person those still run. Open positions are handled as the dashboard's Stop handles them. Afterwards the fleet is stopped_all: every plan that starts a bot is refused until the account holder resumes the fleet in Settings → Bot manager. You cannot resume it. A fleet may stop all 3 times an hour. Requires: a master key (manage:fleet). Example: segnals_stop_all_fleet()`,
    {},
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async (): Promise<ToolResult> => {
      try {
        const result = await client.post<Record<string, unknown>>("/fleet/stop-all");
        return ok({
          next_step:
            "Tell the person which bots stopped and which were skipped (they still run). The fleet is stopped_all " +
            "until the account holder resumes it in Settings → Bot manager; you cannot resume it.",
          ...result,
        });
      } catch (error) {
        return planError(error, {
          routeMissing: NO_STOP_ALL_ROUTE,
          notVisible: NO_FLEET_TO_STOP,
          also: STOP_ALL_FAILED,
        });
      }
    },
  );
}

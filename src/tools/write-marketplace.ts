/**
 * Write tools for marketplace — copy strategy and publish listing.
 *
 * Tools: segnals_copy_strategy ✋, segnals_publish_listing ✋
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";
import { SAFETY_DISCLAIMER } from "./meta.js";

/** Current disclaimer version — must match the backend's CURRENT_DISCLAIMER_VERSION */
const CURRENT_DISCLAIMER_VERSION = "2.0";

/** Current seller terms version — must match the backend's CURRENT_SELLER_TERMS_VERSION */
const CURRENT_SELLER_TERMS_VERSION = "2.0";

export function registerWriteMarketplaceTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_copy_strategy ✋ ──
  server.tool(
    "segnals_copy_strategy",
    `Copy a strategy from the marketplace to your bots. Requires scope: write:marketplace.

TWO-STEP CONFIRMATION: Call without confirm to preview the listing and cost. Call with confirm: true to copy.
FREE strategies: copied immediately. PAID strategies: initiates a crypto payment flow.
The buyer risk disclaimer is required — the agent must present the disclaimer to the user before confirming.`,
    {
      listing_id: z.union([z.string(), z.number()]).describe("Marketplace listing ID to copy"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ listing_id, confirm }) => {
      try {
        if (!confirm) {
          // Preview: fetch listing details to show the user
          let listingInfo: Record<string, unknown> = {};
          try {
            listingInfo = await client.get<Record<string, unknown>>(
              `/marketplace/${listing_id}`,
            );
          } catch {
            return ok({
              action: "copy_strategy",
              preview: `Could not fetch listing #${listing_id}. It may not exist or may not be active.`,
              instruction: "Verify the listing ID with segnals_browse_marketplace.",
            });
          }

          const price = Number(listingInfo.price_usd ?? 0);
          const isPaid = price > 0;

          return ok({
            action: "copy_strategy",
            preview: `Will copy strategy '${listingInfo.title}' by ${listingInfo.seller_name}` +
              ` (${listingInfo.exchange}). ` +
              (isPaid
                ? `Price: $${price.toFixed(2)} USD (crypto payment required). `
                : "Free strategy — will be copied immediately. ") +
              "A new bot will be created in 'stopped' state with the strategy's config.",
            listing: {
              id: listingInfo.id,
              title: listingInfo.title,
              seller_name: listingInfo.seller_name,
              exchange: listingInfo.exchange,
              price_usd: price,
              perf_source: listingInfo.perf_source,
            },
            disclaimer: SAFETY_DISCLAIMER,
            warnings: isPaid
              ? ["💰 This is a paid strategy. Payment is processed via crypto (NOWPayments)."]
              : [],
            instruction: "Present the disclaimer to the user, then call segnals_copy_strategy again with confirm: true",
          });
        }

        // Execute: copy the listing
        const result = await client.post<{
          msg: string;
          bot_id?: number;
          status: string;
          invoice_url?: string;
          payment_id?: number;
        }>(`/marketplace/${listing_id}/copy`, {
          disclaimer_version: CURRENT_DISCLAIMER_VERSION,
          client: "mcp",
        });

        // Free copy returns bot_id + status "paid" immediately
        // Paid copy returns invoice_url + status "pending"
        if (result.status === "paid") {
          return ok({
            action: "copy_strategy",
            executed: true,
            listing_id,
            bot_id: result.bot_id,
            message: result.msg,
            status: "copied",
            next_steps: result.bot_id
              ? [
                  `View config: segnals_get_bot({ bot_id: ${result.bot_id} })`,
                  `Start trading: segnals_start_bot({ bot_id: ${result.bot_id} })`,
                ]
              : [],
          });
        }

        // Paid: return invoice URL for user to complete payment
        return ok({
          action: "copy_strategy",
          executed: true,
          listing_id,
          message: result.msg,
          status: "pending_payment",
          invoice_url: result.invoice_url,
          payment_id: result.payment_id,
          note: "Direct the user to the invoice URL to complete the crypto payment. " +
            "The strategy will be copied automatically after payment confirmation.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_publish_listing ✋ ──
  server.tool(
    "segnals_publish_listing",
    `Publish a bot as a marketplace listing. Requires scope: write:marketplace. VIP tier required.

TWO-STEP CONFIRMATION: Call without confirm to preview. Call with confirm: true to publish.
The listing goes to 'pending_review' — an admin must approve it before it becomes active.
Seller terms acceptance is required.`,
    {
      source_bot_id: z.number().int().positive().describe("Bot ID to publish as a listing"),
      title: z.string().min(1).max(200).describe("Listing title"),
      description: z.string().min(1).max(2000).describe("Listing description"),
      price_usd: z.number().min(0).describe("Price in USD (0 = free)"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ source_bot_id, title, description, price_usd, confirm }) => {
      try {
        if (!confirm) {
          return ok({
            action: "publish_listing",
            preview: `Will publish bot #${source_bot_id} as marketplace listing '${title}'. ` +
              (price_usd > 0
                ? `Price: $${price_usd.toFixed(2)} USD.`
                : "Free listing.") +
              " The listing will be submitted for admin review before becoming active." +
              " Credentials are automatically scrubbed from the config snapshot.",
            listing: { source_bot_id, title, description, price_usd },
            warnings: [
              "📋 This listing will go through admin review before being published.",
              "🔒 Exchange API keys and MT5 passwords are automatically removed from the published config.",
            ],
            instruction: "To proceed, call segnals_publish_listing again with confirm: true",
          });
        }

        const result = await client.post<{ msg: string; listing_id: number }>(
          "/marketplace/listings",
          {
            source_bot_id,
            title,
            description,
            price_usd,
            seller_terms_version: CURRENT_SELLER_TERMS_VERSION,
            client: "mcp",
          },
        );

        return ok({
          action: "publish_listing",
          executed: true,
          listing_id: result.listing_id,
          message: result.msg,
          status: "pending_review",
          note: "An admin will review the listing. Once approved, it will appear in the marketplace.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}

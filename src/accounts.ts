/**
 * The accounts one program acts for: one labelled key, and one API client, per account.
 *
 * Nothing here crosses accounts. A tool call names one account and runs with that account's
 * client only; each key keeps its own server-side scopes, limits and rate limit.
 */

import { SegnalsClient } from "./client.js";
import { DEFAULT_ACCOUNT_LABEL, type AccountsConfig } from "./config.js";

export interface Account {
  readonly label: string;
  readonly client: SegnalsClient;
}

/**
 * A call named no account where several are held, or named a label nobody holds.
 * The message lists the labels. It never repeats what the caller sent: that could be a key.
 */
export class AccountChoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountChoiceError";
  }
}

export class Accounts {
  private readonly byLabel = new Map<string, Account>();

  constructor(accounts: readonly Account[]) {
    if (accounts.length === 0) {
      throw new Error("At least one account is needed.");
    }
    for (const account of accounts) {
      if (this.byLabel.has(account.label)) {
        throw new Error(`The label "${account.label}" repeats.`);
      }
      this.byLabel.set(account.label, account);
    }
  }

  /** One client per account of the config, each with its own key. */
  static fromConfig(config: AccountsConfig): Accounts {
    const { accounts, ...shared } = config;
    return new Accounts(
      accounts.map(({ label, apiKey }) => ({ label, client: new SegnalsClient({ ...shared, apiKey }) })),
    );
  }

  /** One account, labelled `default` unless another label is given. */
  static single(client: SegnalsClient, label: string = DEFAULT_ACCOUNT_LABEL): Accounts {
    return new Accounts([{ label, client }]);
  }

  get size(): number {
    return this.byLabel.size;
  }

  get labels(): string[] {
    return [...this.byLabel.keys()];
  }

  get all(): Account[] {
    return [...this.byLabel.values()];
  }

  /** The labels as an agent reads them: "vip-a", "vip-b". */
  describeLabels(): string {
    return this.labels.map((label) => `"${label}"`).join(", ");
  }

  /**
   * The account a call acts on: the one it names, or the only one held.
   *
   * @throws {AccountChoiceError} when several are held and none is named, or the name is unknown.
   */
  pick(label: unknown): Account {
    if (label === undefined || label === null || label === "") {
      if (this.size === 1) {
        return this.all[0];
      }
      throw new AccountChoiceError(
        `This program holds ${this.size} accounts: ${this.describeLabels()}. ` +
          `Name one with the account argument, for example account: "${this.labels[0]}". ` +
          "segnals_list_accounts shows each account's key mode.",
      );
    }
    const account = typeof label === "string" ? this.byLabel.get(label) : undefined;
    if (account === undefined) {
      throw new AccountChoiceError(
        `No account has that label. This program holds ${this.size === 1 ? "one account" : `${this.size} accounts`}: ` +
          `${this.describeLabels()}. Name one of them with the account argument.`,
      );
    }
    return account;
  }
}

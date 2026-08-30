/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import { Coins, TrendingUp, TrendingDown, Zap } from "lucide-react";

import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemHeader,
  LayoutSectionItemHeaderActions,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
} from "./settings-layout";
import { createDenClient, readDenSettings, type DenCreditsBalance, type DenCreditsTransaction, type DenCreditsTier } from "@/app/lib/den";

function tierLabel(tier: DenCreditsTier): string {
  return t(`credits.tier_${tier}`);
}

function formatTxType(type: DenCreditsTransaction["type"]): string {
  return t(`credits.tx_${type}`);
}

export function CreditsSection() {
  const orgId = readDenSettings().activeOrgId ?? null;
  const [balance, setBalance] = useState<DenCreditsBalance | null>(null);
  const [transactions, setTransactions] = useState<DenCreditsTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState(100);
  const [selectedTier, setSelectedTier] = useState<DenCreditsTier>("free");

  const fetchCredits = useCallback(async () => {
    if (!orgId) return;
    const settings = readDenSettings();
    const token = settings.authToken?.trim();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const client = createDenClient({ baseUrl: settings.baseUrl, token });
      const bal = await client.getCreditsBalance(orgId);
      setBalance(bal);
      setSelectedTier(bal.tier);
      const txs = await client.listCreditsTransactions(orgId, 20);
      setTransactions(txs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  async function handlePurchase() {
    if (!orgId || purchaseAmount <= 0) return;
    const settings = readDenSettings();
    const token = settings.authToken?.trim();
    if (!token) return;
    try {
      const client = createDenClient({ baseUrl: settings.baseUrl, token });
      const bal = await client.purchaseCredits(orgId, purchaseAmount);
      setBalance(bal);
      await fetchCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSetTier(tier: DenCreditsTier) {
    if (!orgId) return;
    const settings = readDenSettings();
    const token = settings.authToken?.trim();
    if (!token) return;
    try {
      const client = createDenClient({ baseUrl: settings.baseUrl, token });
      const bal = await client.setCreditsTier(orgId, tier);
      setBalance(bal);
      setSelectedTier(tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!orgId) {
    return (
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>{t("credits.section_title")}</LayoutSectionTitle>
          <LayoutSectionDescription>{t("credits.section_desc")}</LayoutSectionDescription>
        </LayoutSectionHeader>
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("credits.sign_in_required")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>{t("credits.sign_in_required_desc")}</LayoutSectionItemDescription>
          </LayoutSectionItemHeader>
        </LayoutSectionItem>
      </LayoutSection>
    );
  }

  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("credits.section_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("credits.section_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      {balance ? (
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("credits.balance_title")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>
              {t("credits.tier_label", { tier: tierLabel(balance.tier) })}
            </LayoutSectionItemDescription>
          </LayoutSectionItemHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Coins className="size-5 text-foreground" />
                <span className="text-2xl font-bold text-foreground">{balance.balance}</span>
                <span className="text-sm text-muted-foreground">{t("credits.points")}</span>
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-3.5" />
                  {t("credits.total_purchased", { count: balance.totalPurchased })}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="size-3.5" />
                  {t("credits.total_consumed", { count: balance.totalConsumed })}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="size-3.5" />
                  {t("credits.multiplier", { value: balance.multiplier })}
                </span>
              </div>
            </div>
          </div>
        </LayoutSectionItem>
      ) : null}

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("credits.tier_select_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("credits.tier_select_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <div className="flex items-center gap-1">
              {(["free", "pro", "enterprise"] as const).map((tier) => (
                <Button
                  key={tier}
                  variant={selectedTier === tier ? "default" : "outline"}
                  size="sm"
                  disabled={loading}
                  onClick={() => handleSetTier(tier)}
                >
                  {tierLabel(tier)}
                </Button>
              ))}
            </div>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("credits.purchase_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("credits.purchase_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={loading || purchaseAmount <= 0}
                onClick={handlePurchase}
              >
                <Coins className="size-4" />
                {t("credits.purchase_button")}
              </Button>
            </div>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>

      {transactions.length > 0 ? (
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("credits.transactions_title")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>
              {t("credits.transactions_count", { count: transactions.length })}
            </LayoutSectionItemDescription>
          </LayoutSectionItemHeader>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  {tx.amount >= 0 ? (
                    <TrendingUp className="size-4 text-muted-foreground" />
                  ) : (
                    <TrendingDown className="size-4 text-muted-foreground" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {formatTxType(tx.type)}
                      {tx.description ? ` · ${tx.description}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                </div>
                <span className={`text-sm font-medium ${tx.amount >= 0 ? "text-foreground" : "text-destructive"}`}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        </LayoutSectionItem>
      ) : null}

      {error ? (
        <p className="px-4 pb-2 text-sm text-destructive">{error}</p>
      ) : null}
    </LayoutSection>
  );
}
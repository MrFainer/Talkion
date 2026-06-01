"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, CreditCard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SelectTrigger } from "@/components/ui/select";
import { SelectValue } from "@/components/ui/select";
import { SelectContent } from "@/components/ui/select";
import { SelectItem } from "@/components/ui/select";

interface MercadoPagoCardPaymentBrickProps {
  amount: number;
  onSubmit: (cardToken: string) => Promise<void>;
  onError?: (error: Error) => void;
  buttonLabel?: string;
}

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function MercadoPagoCardPaymentBrick({ amount, onSubmit, onError, buttonLabel }: MercadoPagoCardPaymentBrickProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mpRef = useRef<any>(null);
  const initialized = useRef(false);

  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [docType, setDocType] = useState("CPF");
  const [docNumber, setDocNumber] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
    if (!publicKey) {
      setLoading(false);
      setError("Mercado Pago não configurado (public key ausente)");
      return;
    }

    const loadSdk = async () => {
      const scriptId = "mercadopago-sdk";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://sdk.mercadopago.com/js/v2";
        document.body.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Falha ao carregar SDK do Mercado Pago"));
        });
      }
      mpRef.current = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      setLoading(false);
    };

    loadSdk().catch((err) => {
      setLoading(false);
      setError(err.message || "Erro ao carregar SDK");
      onError?.(err);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpRef.current) return;

    setSubmitting(true);
    setError(null);

    try {
      const cardToken = await mpRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardholderName,
        identificationType: docType,
        identificationNumber: docNumber.replace(/\D/g, ""),
        cardExpirationMonth: expiryMonth,
        cardExpirationYear: expiryYear,
        securityCode,
      });

      await onSubmit(cardToken.id);
    } catch (err: any) {
      const message = err?.message || err?.cause?.message || "Erro ao validar cartão";
      setError(message);
      onError?.(new Error(message));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cardNumber">Número do Cartão</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          className="h-9"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardholderName">Nome do Titular</Label>
        <Input
          id="cardholderName"
          placeholder="Como está no cartão"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          className="h-9"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={expiryMonth} onValueChange={(val) => val !== null && setExpiryMonth(val)}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
              {Array.from({ length: 12 }, (_, i) => {
                const v = String(i + 1).padStart(2, "0");
                return <SelectItem key={v} value={v}>{v}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={expiryYear} onValueChange={(val) => val !== null && setExpiryYear(val)}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
              {Array.from({ length: 10 }, (_, i) => {
                const v = String(new Date().getFullYear() + i);
                return <SelectItem key={v} value={v}>{v}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="securityCode">CVV</Label>
        <Input
          id="securityCode"
          inputMode="numeric"
          placeholder="123"
          maxLength={4}
          value={securityCode}
          onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ""))}
          className="h-9"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="docNumber">CPF do Titular</Label>
        <Input
          id="docNumber"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={docNumber}
          onChange={(e) => setDocNumber(formatCPF(e.target.value))}
          className="h-9"
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
        ) : (
          <><CreditCard className="h-4 w-4" /> {buttonLabel || `Assinar Plano — R$ ${amount.toFixed(2)}/mês`}</>
        )}
      </button>
    </form>
  );
}

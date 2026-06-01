"use client";

import { useEffect, useRef } from "react";

interface MercadoPagoPaymentBrickProps {
  preferenceId: string;
  onError?: (error: Error) => void;
}

export function MercadoPagoPaymentBrick({ preferenceId, onError }: MercadoPagoPaymentBrickProps) {
  const containerId = `wallet-brick-${preferenceId}`;
  const initialized = useRef(false);

  useEffect(() => {
    if (!preferenceId || initialized.current) return;
    initialized.current = true;

    const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
    if (!publicKey) {
      onError?.(new Error("Mercado Pago não configurado (public key ausente)"));
      return;
    }

    let brickController: any = null;

    const initBrick = async () => {
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

      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });

      brickController = await (mp.bricks().create as any)("wallet", containerId, {
        initialization: {
          preferenceId,
        },
        callbacks: {
          onError: (brickError: any) => {
            console.error("Wallet Brick error:", brickError);
            onError?.(new Error(brickError?.message || "Erro no pagamento"));
          },
        },
      });
    };

    initBrick().catch((err) => {
      console.error("Failed to initialize Wallet Brick:", err);
      onError?.(err);
    });

    return () => {
      if (brickController?.unmount) {
        try {
          brickController.unmount();
        } catch {
        }
      }
    };
  }, [preferenceId]);

  return <div id={containerId} />;
}

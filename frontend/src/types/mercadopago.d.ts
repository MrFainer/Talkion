interface MercadoPago {
  new (publicKey: string, options?: { locale: string }): MercadoPagoInstance;
}

interface MercadoPagoInstance {
  createCardToken(payload: MercadoPagoCardTokenPayload): Promise<MercadoPagoCardTokenResponse>;
  getIdentificationTypes(): Promise<any[]>;
  bricks(): BricksBuilder;
}

interface BricksBuilder {
  create(type: 'payment', container: string, config: PaymentBrickConfig): Promise<BrickController>;
  create(type: 'cardPayment', container: string, config: CardPaymentBrickConfig): Promise<BrickController>;
}

interface BrickController {
  unmount(): void;
}

interface PaymentBrickConfig {
  initialization: {
    preferenceId: string;
  };
  customization?: {
    paymentMethods?: {
      maxInstallments?: number;
      minInstallments?: number;
      types?: {
        included?: string[];
        excluded?: string[];
      };
    };
    visual?: {
      style?: {
        theme?: 'default' | 'dark' | 'flat' | 'bootstrap';
        customVariables?: Record<string, string>;
      };
    };
  };
  callbacks: {
    onReady?: () => void;
    onSubmit?: (data: {
      selectedPaymentMethod: string;
      formData: Record<string, any>;
    }) => Promise<void>;
    onError?: (error: any) => void;
  };
}

interface CardPaymentBrickData {
  token: string;
  paymentMethodId: string | null;
  installments: string;
  issuerId: string | null;
}

interface CardPaymentBrickConfig {
  initialization: {
    amount: number;
  };
  customization?: {
    visual?: {
      style?: {
        theme?: 'default' | 'dark' | 'flat' | 'bootstrap';
        customVariables?: Record<string, string>;
        hideFormTitle?: boolean;
      };
      hidePaymentButton?: boolean;
      hideFormTitle?: boolean;
    };
    paymentMethods?: {
      maxInstallments?: number;
      types?: {
        included?: string[];
        excluded?: string[];
      };
    };
  };
  callbacks: {
    onReady?: () => void;
    onSubmit: (cardFormData: CardPaymentBrickData) => Promise<void>;
    onError: (error: any) => void;
  };
}

interface MercadoPagoCardTokenPayload {
  cardNumber: string;
  cardholderName: string;
  identificationType?: string;
  identificationNumber?: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
}

interface MercadoPagoCardTokenResponse {
  id: string;
  public_key: string;
  cardholder: { name: string; identification: any };
  status: string;
  date_created: string;
  date_due: string;
  first_six_digits: string;
  last_four_digits: string;
}

interface Window {
  MercadoPago: MercadoPago;
}

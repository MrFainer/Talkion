import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'node:crypto';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private api: AxiosInstance | null = null;

  constructor() {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      this.logger.warn(
        'MERCADO_PAGO_ACCESS_TOKEN not set. MP integration disabled.',
      );
      return;
    }
    this.logger.log(
      `Initializing MP API with token: ${token.substring(0, 20)}...`,
    );
    this.api = axios.create({
      baseURL: 'https://api.mercadopago.com',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private ensureConfigured() {
    if (!this.api) {
      throw new Error(
        'Mercado Pago não configurado. Defina MERCADO_PAGO_ACCESS_TOKEN.',
      );
    }
  }

  private async request(
    method: string,
    path: string,
    data?: any,
    params?: any,
    extraHeaders?: Record<string, string>,
  ) {
    this.ensureConfigured();
    const url = `https://api.mercadopago.com${path}`;
    this.logger.log(`MP API ${method} ${url}`);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
      const config: any = { method, url, headers };
      if (data) config.data = data;
      if (params) config.params = params;
      const res = await axios(config);
      this.logger.log(`MP API success: ${res.status}`);
      return res.data;
    } catch (e: any) {
      const status = e.response?.status;
      const body = JSON.stringify(e.response?.data);
      this.logger.error(`MP API error: ${status} - ${body}`);
      throw new Error(`Mercado Pago (${method} ${path}): ${status} - ${body}`);
    }
  }

  async findOrCreateCustomer(
    email: string,
    name: string,
    userId: string,
  ): Promise<string> {
    try {
      this.logger.log(`Searching customer by email: ${email}`);
      const data = await this.request('GET', '/v1/customers/search', null, {
        email,
      });
      const existing = data?.results?.[0];
      if (existing?.id) {
        this.logger.log(`Customer found: ${existing.id} for ${email}`);
        return existing.id;
      }
    } catch (e: any) {
      this.logger.warn(`Customer search failed, will create new: ${e.message}`);
    }

    this.logger.log(`Creating customer: ${email}`);
    const data = await this.request('POST', '/v1/customers', {
      email,
      first_name: name,
    });
    this.logger.log(`Customer created: ${data.id} for ${email}`);
    return data.id;
  }

  async getCard(customerId: string, cardId: string) {
    const data = await this.request(
      'GET',
      `/v1/customers/${customerId}/cards/${cardId}`,
    );
    return {
      cardId: data.id,
      lastFourDigits: data.last_four_digits || '',
      holderName: data.cardholder?.name || '',
    };
  }

  async listCustomerCards(customerId: string) {
    const data = await this.request('GET', `/v1/customers/${customerId}/cards`);
    const cards = Array.isArray(data) ? data : [];
    return cards.map((card: any) => ({
      cardId: card.id,
      lastFourDigits: card.last_four_digits || '',
      holderName: card.cardholder?.name || '',
    }));
  }

  async createCardTokenFromSavedCard(cardId: string, securityCode?: string): Promise<string> {
    const body: Record<string, any> = {
      card_id: cardId,
    };
    if (securityCode) {
      body.security_code = securityCode;
    }
    const data = await this.request('POST', '/v1/card_tokens', body);
    return data.id;
  }

  async createOneTimePaymentWithCardId(
    customerId: string,
    cardId: string,
    amount: number,
    description: string,
    userId: string,
    userEmail: string,
    paymentMethodId?: string,
  ) {
    const cardToken = await this.createCardTokenFromSavedCard(cardId);
    const idempotencyKey = crypto.randomUUID();
    const body: Record<string, any> = {
      transaction_amount: amount,
      description,
      installments: 1,
      token: cardToken,
      payer: {
        email: userEmail,
        id: customerId,
        type: 'customer',
      },
      external_reference: userId,
    };
    if (paymentMethodId) {
      body.payment_method_id = paymentMethodId;
    }
    const data = await this.request(
      'POST',
      '/v1/payments',
      body,
      null,
      { 'X-Idempotency-Key': idempotencyKey },
    );
    this.logger.log(
      `One-time payment (saved card) created: ${data.id} - ${data.status}`,
    );
    return {
      id: data.id,
      status: data.status,
    };
  }

  async associateCard(customerId: string, cardToken: string) {
    this.logger.log(`Associating card for customer ${customerId}`);
    const data = await this.request(
      'POST',
      `/v1/customers/${customerId}/cards`,
      { token: cardToken },
    );
    this.logger.log(`Card associated: ${data.id} with customer ${customerId}`);
    return {
      cardId: data.id,
      lastFourDigits: data.last_four_digits || '',
      holderName: data.cardholder?.name || '',
      paymentMethodId: data.payment_method?.id || null,
    };
  }

  async createPendingSubscription(
    customerId: string,
    cardId: string,
    planPrice: number,
    planName: string,
    userId: string,
    userEmail: string,
  ) {
    const body: Record<string, any> = {
      reason: `Talkion - ${planName}`,
      external_reference: userId,
      payer_email: userEmail,
      card_id: cardId,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planPrice,
        currency_id: 'BRL',
      },
      back_url: process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/subscriptions`
        : 'https://httpbin.org/post',
    };
    this.logger.log(`Creating PreApproval: ${JSON.stringify(body)}`);
    const data = await this.request('POST', '/preapproval', body);
    this.logger.log(`Preapproval created: ${data.id} - status: ${data.status}`);
    return {
      subscriptionId: data.id,
      status: data.status || 'pending',
      nextBillingDate: data.next_payment_date || null,
      initPoint: data.init_point || null,
    };
  }

  async createSubscription(
    customerId: string,
    cardId: string,
    planPrice: number,
    planName: string,
    userId: string,
    userEmail: string,
    startDate?: Date,
    subscriptionCardToken?: string,
  ) {
    const body: Record<string, any> = {
      reason: `Talkion - ${planName}`,
      external_reference: userId,
      payer_email: userEmail,
      back_url: 'https://httpbin.org/post',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planPrice,
        currency_id: 'BRL',
      },
      status: 'authorized',
    };
    if (subscriptionCardToken) {
      body.card_token_id = subscriptionCardToken;
    } else {
      body.card_id = cardId;
    }
    if (startDate) {
      body.auto_recurring.start_date = startDate.toISOString();
    }
    this.logger.log(`Creating PreApproval: ${JSON.stringify(body)}`);
    const data = await this.request('POST', '/preapproval', body);
    this.logger.log(`Preapproval created: ${data.id}`);
    return {
      subscriptionId: data.id,
      status: data.status || 'pending',
      nextBillingDate: data.next_payment_date || null,
    };
  }

  async getSubscription(mpSubscriptionId: string) {
    return this.request('GET', `/preapproval/${mpSubscriptionId}`);
  }

  async cancelSubscription(mpSubscriptionId: string) {
    return this.request('PUT', `/preapproval/${mpSubscriptionId}`, {
      status: 'cancelled',
    });
  }

  async pauseSubscription(mpSubscriptionId: string) {
    return this.request('PUT', `/preapproval/${mpSubscriptionId}`, {
      status: 'paused',
    });
  }

  async updateSubscriptionAmount(
    mpSubscriptionId: string,
    transactionAmount: number,
  ) {
    this.logger.log(
      `Updating preapproval ${mpSubscriptionId} amount to ${transactionAmount}`,
    );
    return this.request('PUT', `/preapproval/${mpSubscriptionId}`, {
      auto_recurring: {
        transaction_amount: transactionAmount,
      },
    });
  }

  async getPayment(mpPaymentId: string) {
    return this.request('GET', `/v1/payments/${mpPaymentId}`);
  }

  async searchPaymentsByPreapproval(mpSubscriptionId: string) {
    const params: any = {
      preapproval_id: mpSubscriptionId,
      limit: 100,
      sort: 'date_approved',
      criteria: 'desc',
    };
    const data = await this.request('GET', '/v1/payments/search', null, params);
    return Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
  }

  async searchPaymentsByExternalReference(externalReference: string) {
    const params: any = {
      external_reference: externalReference,
      limit: 100,
      sort: 'date_created',
      criteria: 'desc',
    };
    const data = await this.request('GET', '/v1/payments/search', null, params);
    return Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
  }

  async createOneTimePayment(
    customerId: string,
    cardToken: string,
    amount: number,
    description: string,
    userId: string,
    userEmail: string,
  ) {
    const idempotencyKey = crypto.randomUUID();
    const data = await this.request(
      'POST',
      '/v1/payments',
      {
        transaction_amount: amount,
        description,
        installments: 1,
        token: cardToken,
        payer: {
          email: userEmail,
          id: customerId,
          type: 'customer',
        },
        external_reference: userId,
      },
      null,
      { 'X-Idempotency-Key': idempotencyKey },
    );
    this.logger.log(`One-time payment created: ${data.id} - ${data.status}`);
    const card = data.card || {};
    return {
      id: data.id,
      status: data.status,
      cardId: card.id || null,
      lastFourDigits: card.last_four_digits || null,
      holderName: card.cardholder?.name || null,
    };
  }

  async createPreference(paymentData: {
    amount: number;
    description: string;
    userEmail: string;
    userId: string;
    externalReference?: string;
  }): Promise<{ initPoint: string; preferenceId: string }> {
    const data = await this.request('POST', '/checkout/preferences', {
      items: [
        {
          id: paymentData.description,
          title: paymentData.description,
          quantity: 1,
          unit_price: paymentData.amount,
          currency_id: 'BRL',
        },
      ],
      payer: { email: paymentData.userEmail },
      back_urls: {
        success: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions`,
      },
      external_reference: paymentData.externalReference || paymentData.userId,
      notification_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/webhooks/mercadopago`,
    });

    const initPoint = data.sandbox_init_point || data.init_point;
    if (!initPoint) {
      throw new Error(
        'Falha ao criar preferência: URL de pagamento não gerada',
      );
    }
    return { initPoint, preferenceId: data.id };
  }
}

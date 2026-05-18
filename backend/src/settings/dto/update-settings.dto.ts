export class UpdateSettingsDto {
  private_greeting_message?: string;
  speaking_intro_message?: string;
  news_intro_message?: string;
  private_delay_seconds?: number;
  private_simulate_typing?: boolean;

  group_greeting_message?: string;
  group_news_intro_message?: string;
  group_quiz_header_message?: string;
  group_quiz_footer_message?: string;
  group_delay_seconds?: number;
  group_simulate_typing?: boolean;

  ai_temperature?: number;
  ai_model?: string;
  min_delay?: number;
  max_delay?: number;
  messages_per_minute?: number;
  response_timeout?: number;
  system_prompt?: string;
  allowed_response_start?: string;
  allowed_response_end?: string;

  ignored_groups?: any;
  ignored_contacts?: any;
}

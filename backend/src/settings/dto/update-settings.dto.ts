export class UpdateSettingsDto {
  private_greeting_message?: string;
  private_message_idea?: string;
  private_greeting_idea?: string;
  private_speaking_intro_idea?: string;
  private_news_intro_idea?: string;
  speaking_intro_message?: string;
  news_intro_message?: string;

  group_greeting_message?: string;
  group_message_idea?: string;
  group_greeting_idea?: string;
  group_previous_quiz_header_idea?: string;
  group_quiz_header_idea?: string;
  group_news_intro_idea?: string;
  group_news_intro_message?: string;
  group_quiz_header_message?: string;
  group_quiz_footer_message?: string;

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

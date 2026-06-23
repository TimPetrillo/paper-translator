export interface ChatCompletionMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

export interface ApiErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
  message?: string;
}

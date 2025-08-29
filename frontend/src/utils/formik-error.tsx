import { v4 as uuidv4 } from 'uuid';

export interface ErrorMessage {
  id: string;
  message: string;
}

export function collectFormikErrorMessages(error: any): ErrorMessage[] {
  const messages: string[] = [];

  const collect = (err: any) => {
    if (!err) {
      return;
    }

    if (typeof err === 'string') {
      messages.push(err);
    } else if (Array.isArray(err)) {
      err.forEach(collect);
    } else if (typeof err === 'object') {
      Object.values(err).forEach(collect);
    }
  };

  collect(error);

  const unique = Array.from(new Set(messages));
  return unique.map((msg) => ({ id: uuidv4(), message: msg }));
}

import type { Language } from './i18n';

export const donationMessages: Record<Language, {
  eyebrow: string;
  title: string;
  text: string;
  copy: string;
  copied: string;
  network: string;
  warning: string;
}> = {
  en: {
    eyebrow: 'Support the project',
    title: 'Like Wallet Platform? Support the developer ☕',
    text: 'If this project saved you time or taught you something useful, you can support its development with a crypto donation.',
    copy: 'Copy',
    copied: 'Copied',
    network: 'Network',
    warning: 'Please send funds only through the network shown for each address.',
  },
  ru: {
    eyebrow: 'Поддержать проект',
    title: 'Нравится Wallet Platform? Поддержите разработчика ☕',
    text: 'Если проект сэкономил вам время или помог разобраться в крипте, его развитие можно поддержать небольшим пожертвованием.',
    copy: 'Копировать',
    copied: 'Скопировано',
    network: 'Сеть',
    warning: 'Пожалуйста, отправляйте средства только через сеть, указанную рядом с адресом.',
  },
};

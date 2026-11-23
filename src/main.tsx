import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { ConfirmHost } from './ui/confirm';
import './styles.css';

// Service worker: офлайн-работа и установка на телефон.
// Новая версия подхватывается автоматически при следующем открытии.
registerSW({ immediate: true });

render(
  <>
    <App />
    <ConfirmHost />
  </>,
  document.getElementById('app')!,
);

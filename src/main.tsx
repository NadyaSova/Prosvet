import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './styles.css';

// Service worker: офлайн-работа и установка на телефон.
// Новая версия подхватывается автоматически при следующем открытии.
registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);

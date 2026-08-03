import { registerTheme } from '../theme-api';
import { ChatTheme } from './ChatTheme';

registerTheme({
  id: 'chat',
  label: 'Chat',
  documentTitle: 'Assistant',
  status: 'ready',
  Component: ChatTheme,
});
